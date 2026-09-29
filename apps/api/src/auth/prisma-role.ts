import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';

const ROLE_BY_PRISMA: Record<PrismaRole, Role> = {
  [PrismaRole.ADMIN]: Role.ADMIN,
  [PrismaRole.EDITOR]: Role.EDITOR,
  [PrismaRole.HOTEL_MANAGER]: Role.HOTEL_MANAGER,
  [PrismaRole.PARTNER]: Role.PARTNER,
};

const PRISMA_BY_ROLE: Record<Role, PrismaRole> = {
  [Role.ADMIN]: PrismaRole.ADMIN,
  [Role.EDITOR]: PrismaRole.EDITOR,
  [Role.HOTEL_MANAGER]: PrismaRole.HOTEL_MANAGER,
  [Role.PARTNER]: PrismaRole.PARTNER,
};

export function toSharedRole(role: PrismaRole): Role {
  return ROLE_BY_PRISMA[role];
}

export function toPrismaRole(role: Role): PrismaRole {
  return PRISMA_BY_ROLE[role];
}
