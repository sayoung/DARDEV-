import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaUserRepository } from './prisma-user.repository.js';

type StoredUser = {
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

const row: StoredUser = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada',
  passwordHash: 'hash-ada',
  role: PrismaRole.HOTEL_MANAGER,
  uiLang: 'en',
  active: true,
  failedLoginCount: 2,
  lockedUntil: null,
};

type EmailWhere = { email: { equals: string; mode: 'insensitive' } };

function repositoryFor(found: StoredUser | null) {
  const calls: { op: string; args: unknown }[] = [];
  const prisma = {
    user: {
      findFirst: (args: { where: EmailWhere }) => {
        calls.push({ op: 'findFirst', args });
        return Promise.resolve(found);
      },
      findUnique: (args: { where: { id: string } }) => {
        calls.push({ op: 'findUnique', args });
        return Promise.resolve(found);
      },
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push({ op: 'update', args });
        return Promise.resolve(found);
      },
    },
  };
  return {
    calls,
    repository: new PrismaUserRepository(prisma as unknown as PrismaService),
  };
}

describe('PrismaUserRepository', () => {
  it('retrouve un email sans tenir compte de la casse et mappe le rôle', async () => {
    const { repository, calls } = repositoryFor(row);

    await expect(repository.findByEmail('Ada@Xplor.test')).resolves.toEqual({
      id: 'user-1',
      email: 'ada@xplor.test',
      name: 'Ada',
      passwordHash: 'hash-ada',
      role: Role.HOTEL_MANAGER,
      uiLang: 'en',
      active: true,
      failedLoginCount: 2,
      lockedUntil: null,
    });
    const first = calls[0];
    expect(first?.op).toBe('findFirst');
    expect(first?.args).toMatchObject({
      where: { email: { equals: 'Ada@Xplor.test', mode: 'insensitive' } },
    });
  });

  it('ramène une langue inconnue au français', async () => {
    const { repository } = repositoryFor({ ...row, uiLang: 'es', role: PrismaRole.PARTNER });

    await expect(repository.findById('user-1')).resolves.toMatchObject({
      role: Role.PARTNER,
      uiLang: 'fr',
    });
  });

  it('renvoie null si le compte est absent', async () => {
    const { repository } = repositoryFor(null);

    await expect(repository.findByEmail('ada@xplor.test')).resolves.toBeNull();
    await expect(repository.findById('user-1')).resolves.toBeNull();
  });

  it("n'écrit lastLoginAt que lorsqu'il est fourni", async () => {
    const { repository, calls } = repositoryFor(row);
    const lockedUntil = new Date('2026-09-29T12:15:00.000Z');

    await repository.updateLoginState('user-1', { failedLoginCount: 3, lockedUntil });
    await repository.updateLoginState('user-1', {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date('2026-09-29T12:00:00.000Z'),
    });

    expect(calls[0]).toMatchObject({
      op: 'update',
      args: { data: { failedLoginCount: 3, lockedUntil } },
    });
    expect(calls[1]).toMatchObject({
      op: 'update',
      args: {
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date('2026-09-29T12:00:00.000Z'),
        },
      },
    });
    const first = calls[0];
    if (first?.op === 'update') {
      const args = first.args as { data: Record<string, unknown> };
      expect(args.data).not.toHaveProperty('lastLoginAt');
    }
  });
});
