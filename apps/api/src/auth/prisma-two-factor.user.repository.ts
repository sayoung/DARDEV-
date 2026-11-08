import { Inject, Injectable } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { toSharedRole } from './prisma-role.js';
import {
  type TwoFactorTotpUpdate,
  type TwoFactorUser,
  type TwoFactorUserRepository,
} from './two-factor.service.js';

export type TwoFactorPrismaClient = {
  user: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        role: true;
        totpSecret: true;
        totpEnabled: true;
      };
    }) => Promise<{
      id: string;
      role: PrismaRole;
      totpSecret: string | null;
      totpEnabled: boolean;
    } | null>;
    update: (args: {
      where: { id: string };
      data: {
        totpSecret?: string | null;
        totpEnabled?: boolean;
      };
    }) => Promise<unknown>;
  };
};

@Injectable()
export class PrismaTwoFactorUserRepository implements TwoFactorUserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: TwoFactorPrismaClient) {}

  async findById(id: string): Promise<TwoFactorUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        totpSecret: true,
        totpEnabled: true,
      },
    });

    if (user === null) {
      return null;
    }

    return {
      id: user.id,
      role: toSharedRole(user.role),
      totpSecret: user.totpSecret,
      totpEnabled: user.totpEnabled,
    };
  }

  async updateTotp(id: string, update: TwoFactorTotpUpdate): Promise<void> {
    const data: { totpSecret?: string | null; totpEnabled?: boolean } = {};
    if (update.totpSecret !== undefined) {
      data.totpSecret = update.totpSecret;
    }
    if (update.totpEnabled !== undefined) {
      data.totpEnabled = update.totpEnabled;
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
