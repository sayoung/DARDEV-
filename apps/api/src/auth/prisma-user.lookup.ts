import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { toSharedRole } from './prisma-role.js';
import { type SessionUser, type UserLookup } from './user-lookup.js';

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
      role: toSharedRole(user.role),
      active: user.active,
    };
  }
}
