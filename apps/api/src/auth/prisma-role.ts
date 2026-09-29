import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';

const ROLE_BY_PRISMA: Record<PrismaRole, Role> = {
  [PrismaRole.ADMIN]: Role.ADMIN,
  [PrismaRole.EDITOR]: Role.EDITOR,
  [PrismaRole.HOTEL_MANAGER]: Role.HOTEL_MANAGER,
  [PrismaRole.PARTNER]: Role.PARTNER,
};

export function toSharedRole(role: PrismaRole): Role {
  return ROLE_BY_PRISMA[role];
}
