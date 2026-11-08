import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import {
  AdminUserListQuerySchema,
  AdminUserSchema,
  LANGS,
  PaginatedAdminUsersResponseSchema,
  UpdateAdminUserRequestSchema,
  type AdminUser,
  type AdminUserListQuery,
  type Lang,
  type PaginatedAdminUsersResponse,
} from '@xplor/shared';

import { NOOP_AUDIT, type AuditRecorder } from '../audit/audit-recorder.js';
import { AuditService } from '../audit/audit.service.js';
import { toPrismaRole, toSharedRole } from '../auth/prisma-role.js';
import { SESSION_STORE, type SessionStore } from '../auth/session-store.js';
import { PrismaService } from '../prisma/prisma.service.js';

export { NOOP_AUDIT, type AuditRecorder };

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

export interface UserAdminUpdateArgs {
  where: Prisma.UserWhereUniqueInput;
  data: Prisma.UserUpdateInput;
  select?: Prisma.UserSelect;
}

export interface HotelAdminSummaryRow {
  id: string;
}

export interface HotelAdminFindManyArgs {
  where?: Prisma.HotelWhereInput;
  select?: Prisma.HotelSelect;
}

export interface UsersAdminTransactionClient {
  userHotel: {
    deleteMany(args?: { where?: Prisma.UserHotelWhereInput }): Promise<Prisma.BatchPayload>;
    createMany(args: { data: Prisma.UserHotelCreateManyInput[] }): Promise<Prisma.BatchPayload>;
  };
}

export interface UsersAdminPrismaClient {
  user: {
    findMany(args?: UserAdminFindManyArgs): Promise<UserAdminRow[]>;
    count(args?: UserAdminCountArgs): Promise<number>;
    findUnique(args: UserAdminFindUniqueArgs): Promise<UserAdminRow | null>;
    update(args: UserAdminUpdateArgs): Promise<UserAdminRow>;
  };
  hotel: {
    findMany(args: HotelAdminFindManyArgs): Promise<HotelAdminSummaryRow[]>;
  };
  $transaction<T>(fn: (tx: UsersAdminTransactionClient) => Promise<T>): Promise<T>;
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
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: UsersAdminPrismaClient,
    @Inject(SESSION_STORE)
    private readonly sessions: SessionStore,
    @Inject(AuditService)
    @Optional()
    private readonly audit: AuditRecorder = NOOP_AUDIT,
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

  async update(actorId: string, id: string, input: unknown): Promise<AdminUser> {
    const validated = UpdateAdminUserRequestSchema.safeParse(input);
    if (!validated.success) {
      throw new BadRequestException('Données de mise à jour d’utilisateur invalides');
    }
    const valid = validated.data;

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });

    if (existing === null) {
      throw new NotFoundException(`Utilisateur introuvable : ${id}`);
    }

    const isSelf = actorId === id;
    if (isSelf) {
      if (valid.active === false) {
        throw new ForbiddenException('Un administrateur ne peut pas se désactiver lui-même');
      }
      if (valid.role !== undefined && toPrismaRole(valid.role) !== existing.role) {
        throw new ForbiddenException('Un administrateur ne peut pas modifier son propre rôle');
      }
    }

    const isTargetActiveAdmin = existing.role === PrismaRole.ADMIN && existing.active;
    const isDeactivating = valid.active === false;
    const isDemoting = valid.role !== undefined && toPrismaRole(valid.role) !== PrismaRole.ADMIN;

    if (isTargetActiveAdmin && (isDeactivating || isDemoting)) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: PrismaRole.ADMIN,
          active: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictException(
          'Impossible de désactiver ou rétrograder le dernier administrateur actif',
        );
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (valid.name !== undefined) {
      data.name = valid.name;
    }
    if (valid.role !== undefined) {
      data.role = toPrismaRole(valid.role);
    }
    if (valid.active !== undefined) {
      data.active = valid.active;
    }
    if (valid.uiLang !== undefined) {
      data.uiLang = valid.uiLang;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_ADMIN_SELECT,
    });

    if (existing.role !== updated.role) {
      try {
        await this.audit.record({
          action: 'user.role_change',
          entityType: 'User',
          entityId: id,
          userId: actorId,
          diff: {
            from: toSharedRole(existing.role),
            to: toSharedRole(updated.role),
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Échec d'enregistrement d'audit: ${message}`);
      }
    }

    if (existing.active && !updated.active) {
      await this.sessions.destroyAllForUser(id);
    }

    return toAdminUser(updated);
  }

  async setHotels(id: string, hotelIds: string[]): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });

    if (user === null) {
      throw new NotFoundException(`Utilisateur introuvable : ${id}`);
    }

    if (
      user.role !== PrismaRole.HOTEL_MANAGER &&
      user.role !== PrismaRole.PARTNER
    ) {
      throw new UnprocessableEntityException(
        'L’affectation d’hôtels est réservée aux gestionnaires et partenaires',
      );
    }

    const uniqueHotelIds = Array.from(new Set(hotelIds));

    if (uniqueHotelIds.length > 0) {
      const existingHotels = await this.prisma.hotel.findMany({
        where: {
          id: { in: uniqueHotelIds },
        },
        select: { id: true },
      });

      if (existingHotels.length !== uniqueHotelIds.length) {
        throw new BadRequestException('Un ou plusieurs hôtels sont introuvables');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userHotel.deleteMany({
        where: { userId: id },
      });

      if (uniqueHotelIds.length > 0) {
        await tx.userHotel.createMany({
          data: uniqueHotelIds.map((hotelId) => ({
            userId: id,
            hotelId,
          })),
        });
      }
    });

    const updated = await this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_SELECT,
    });

    if (updated === null) {
      throw new NotFoundException(`Utilisateur introuvable : ${id}`);
    }

    return toAdminUser(updated);
  }
}
