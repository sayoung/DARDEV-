import { Injectable } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { type SessionUser, type UserLookup } from './user-lookup.js';

const ROLE_BY_PRISMA: Record<PrismaRole, Role> = {
  [PrismaRole.ADMIN]: Role.ADMIN,
  [PrismaRole.EDITOR]: Role.EDITOR,
  [PrismaRole.HOTEL_MANAGER]: Role.HOTEL_MANAGER,
  [PrismaRole.PARTNER]: Role.PARTNER,
};

@Injectable()
export class PrismaUserLookup implements UserLookup {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, active: true },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      role: ROLE_BY_PRISMA[user.role],
      active: user.active,
    };
  }
}
