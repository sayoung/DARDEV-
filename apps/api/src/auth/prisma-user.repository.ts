import { Injectable } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { LANGS, type Lang } from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { toSharedRole } from './prisma-role.js';
import { type AuthTx } from './unit-of-work.js';
import {
  type AuthUser,
  type LoginStateUpdate,
  type PasswordUpdate,
  type UserRepository,
} from './user.repository.js';

const authUserSelect = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  role: true,
  uiLang: true,
  active: true,
  failedLoginCount: true,
  lockedUntil: true,
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: PrismaRole;
  uiLang: string;
  active: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
};

/** Valeur hors fr/ar/en : repli sur le français, langue par défaut du schéma. */
function toUiLang(value: string): Lang {
  for (const lang of LANGS) {
    if (lang === value) {
      return lang;
    }
  }
  return 'fr';
}

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    role: toSharedRole(user.role),
    uiLang: toUiLang(user.uiLang),
    active: user.active,
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: authUserSelect,
    });
    return user === null ? null : toAuthUser(user);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: authUserSelect,
    });
    return user === null ? null : toAuthUser(user);
  }

  async updateLoginState(id: string, state: LoginStateUpdate): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginCount: state.failedLoginCount,
        lockedUntil: state.lockedUntil,
        ...(state.lastLoginAt !== undefined ? { lastLoginAt: state.lastLoginAt } : {}),
      },
    });
  }

  async updatePassword(id: string, state: PasswordUpdate, db?: AuthTx): Promise<void> {
    const args = {
      where: { id },
      data: {
        passwordHash: state.passwordHash,
        failedLoginCount: state.failedLoginCount,
        lockedUntil: state.lockedUntil,
      },
    };
    if (db) {
      await db.user.update(args);
      return;
    }
    await this.prisma.user.update(args);
  }
}
