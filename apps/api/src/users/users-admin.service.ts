import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import {
  AdminUserListQuerySchema,
  AdminUserSchema,
  LANGS,
  PaginatedAdminUsersResponseSchema,
  type AdminUser,
  type AdminUserListQuery,
  type Lang,
  type PaginatedAdminUsersResponse,
} from '@xplor/shared';

import { toPrismaRole, toSharedRole } from '../auth/prisma-role.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface UserAdminHotelLink {
  hotelId: string;
}

export interface UserAdminRow {
  id: string;
  email: string;
  name: string;
  role: PrismaRole;
  active: boolean;
  totpEnabled: boolean;
  lastLoginAt: Date | string | null;
  uiLang: string;
  hotels: UserAdminHotelLink[];
}

export interface UserAdminFindManyArgs {
  where?: Prisma.UserWhereInput;
  select?: Prisma.UserSelect;
  orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
  skip?: number;
  take?: number;
}

export interface UserAdminCountArgs {
  where?: Prisma.UserWhereInput;
}

export interface UserAdminFindUniqueArgs {
  where: Prisma.UserWhereUniqueInput;
  select?: Prisma.UserSelect;
}

export interface UsersAdminPrismaClient {
  user: {
    findMany(args?: UserAdminFindManyArgs): Promise<UserAdminRow[]>;
    count(args?: UserAdminCountArgs): Promise<number>;
    findUnique(args: UserAdminFindUniqueArgs): Promise<UserAdminRow | null>;
  };
}

/**
 * Sélection explicite des champs pour l'administration.
 * Exclut formellement les secrets d'authentification (passwordHash, totpSecret).
 */
export const USER_ADMIN_SELECT: Prisma.UserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  totpEnabled: true,
  lastLoginAt: true,
  uiLang: true,
  hotels: {
    select: {
      hotelId: true,
    },
  },
};

function toUiLang(value: string): Lang {
  for (const lang of LANGS) {
    if (lang === value) {
      return lang;
    }
  }
  return 'fr';
}

export function toAdminUser(row: UserAdminRow): AdminUser {
  const lastLoginAt =
    row.lastLoginAt instanceof Date
      ? row.lastLoginAt.toISOString()
      : typeof row.lastLoginAt === 'string'
        ? row.lastLoginAt
        : null;

  return AdminUserSchema.parse({
    id: row.id,
    email: row.email,
    name: row.name,
    role: toSharedRole(row.role),
    active: row.active,
    totpEnabled: row.totpEnabled,
    lastLoginAt,
    uiLang: toUiLang(row.uiLang),
    hotelIds: row.hotels.map((h) => h.hotelId),
  });
}

export function buildUserAdminWhereInput(query: AdminUserListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.role !== undefined) {
    where.role = toPrismaRole(query.role);
  }

  if (query.active !== undefined) {
    where.active = query.active;
  }

  if (query.q !== undefined && query.q.length > 0) {
    where.OR = [
      { email: { contains: query.q, mode: 'insensitive' } },
      { name: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  return where;
}

@Injectable()
export class UsersAdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: UsersAdminPrismaClient,
  ) {}

  async list(query?: unknown): Promise<PaginatedAdminUsersResponse> {
    const validated = AdminUserListQuerySchema.safeParse(query ?? {});
    if (!validated.success) {
      throw new BadRequestException('Paramètres de recherche d’utilisateurs invalides');
    }
    const validQuery = validated.data;
    const where = buildUserAdminWhereInput(validQuery);

    const skip = (validQuery.page - 1) * validQuery.pageSize;
    const take = validQuery.pageSize;

    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_ADMIN_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: AdminUser[] = records.map((record) => toAdminUser(record));

    return PaginatedAdminUsersResponseSchema.parse({
      items,
      total,
      page: validQuery.page,
      pageSize: validQuery.pageSize,
    });
  }

  async get(id: string): Promise<AdminUser> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });

    if (row === null) {
      throw new NotFoundException(`Utilisateur introuvable : ${id}`);
    }

    return toAdminUser(row);
  }
}
