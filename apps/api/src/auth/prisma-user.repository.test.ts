import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaUserRepository } from './prisma-user.repository.js';
import type { AuthTx } from './unit-of-work.js';

type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: PrismaRole;
  uiLang: string;
  active: boolean;
  lastLoginAt: Date | null;
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
  lastLoginAt: null,
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
      lastLoginAt: null,
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

  it('lit le compte sur le client de transaction', async () => {
    const { repository } = repositoryFor(null);
    const txCalls: unknown[] = [];
    const tx = {
      user: {
        findUnique: (args: unknown) => {
          txCalls.push(args);
          return Promise.resolve(row);
        },
      },
    };

    await expect(repository.findById('user-1', tx as unknown as AuthTx)).resolves.toMatchObject({
      id: 'user-1',
      active: true,
    });
    expect(txCalls).toEqual([
      {
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          role: true,
          uiLang: true,
          active: true,
          lastLoginAt: true,
          failedLoginCount: true,
          lockedUntil: true,
        },
      },
    ]);
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

  it('écrit le mot de passe sur Prisma, ou sur le client de transaction', async () => {
    const { repository, calls } = repositoryFor(row);
    const txCalls: unknown[] = [];
    const tx = {
      user: {
        update: (args: unknown) => {
          txCalls.push(args);
          return Promise.resolve(row);
        },
      },
    };
    const state = { passwordHash: 'hash-neuf', failedLoginCount: 0, lockedUntil: null };

    await repository.updatePassword('user-1', state);
    await repository.updatePassword(
      'user-1',
      { ...state, passwordHash: 'hash-tx' },
      tx as unknown as AuthTx,
    );

    expect(calls[0]).toMatchObject({
      op: 'update',
      args: { where: { id: 'user-1' }, data: state },
    });
    expect(txCalls).toEqual([
      {
        where: { id: 'user-1' },
        data: { passwordHash: 'hash-tx', failedLoginCount: 0, lockedUntil: null },
      },
    ]);
  });

  it('crée un compte invité inactif et l’active', async () => {
    const calls: { op: string; args: unknown }[] = [];
    const created = {
      ...row,
      email: 'nouveau@xplor.test',
      name: 'Nouveau',
      passwordHash: 'hash-secret',
      role: PrismaRole.EDITOR,
      uiLang: 'ar',
      active: false,
      failedLoginCount: 0,
    };
    const prisma = {
      user: {
        create: (args: unknown) => {
          calls.push({ op: 'create', args });
          return Promise.resolve(created);
        },
        update: (args: unknown) => {
          calls.push({ op: 'update', args });
          return Promise.resolve(created);
        },
      },
    };
    const repository = new PrismaUserRepository(prisma as unknown as PrismaService);

    await expect(
      repository.createInvited({
        email: 'nouveau@xplor.test',
        name: 'Nouveau',
        passwordHash: 'hash-secret',
        role: Role.EDITOR,
        uiLang: 'ar',
      }),
    ).resolves.toMatchObject({
      email: 'nouveau@xplor.test',
      name: 'Nouveau',
      passwordHash: 'hash-secret',
      role: Role.EDITOR,
      uiLang: 'ar',
      active: false,
    });
    expect(calls[0]).toEqual({
      op: 'create',
      args: {
        data: {
          email: 'nouveau@xplor.test',
          name: 'Nouveau',
          passwordHash: 'hash-secret',
          role: PrismaRole.EDITOR,
          uiLang: 'ar',
          active: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          role: true,
          uiLang: true,
          active: true,
          lastLoginAt: true,
          failedLoginCount: true,
          lockedUntil: true,
        },
      },
    });

    const txCalls: unknown[] = [];
    const tx = {
      user: {
        update: (args: unknown) => {
          txCalls.push(args);
          return Promise.resolve(created);
        },
      },
    };
    await repository.activate('user-1', 'hash-choisi', tx as unknown as AuthTx);
    await repository.activate('user-1', 'hash-direct');

    expect(txCalls).toEqual([
      { where: { id: 'user-1' }, data: { passwordHash: 'hash-choisi', active: true } },
    ]);
    expect(calls[1]).toEqual({
      op: 'update',
      args: { where: { id: 'user-1' }, data: { passwordHash: 'hash-direct', active: true } },
    });
  });

  it('écrit la création et la mise à jour d’invitation sur la transaction', async () => {
    const txCalls: { op: string; args: unknown }[] = [];
    const tx = {
      user: {
        create: (args: unknown) => {
          txCalls.push({ op: 'create', args });
          return Promise.resolve({ ...row, active: false, lastLoginAt: null });
        },
        update: (args: unknown) => {
          txCalls.push({ op: 'update', args });
          return Promise.resolve({ ...row, name: 'Renouvelé', role: PrismaRole.PARTNER });
        },
      },
    };
    const repository = new PrismaUserRepository({ user: {} } as unknown as PrismaService);

    await repository.createInvited(
      {
        email: 'nouveau@xplor.test',
        name: 'Nouveau',
        passwordHash: 'hash-secret',
        role: Role.EDITOR,
        uiLang: 'ar',
      },
      tx as unknown as AuthTx,
    );
    await expect(
      repository.updateInvited(
        'user-1',
        { name: 'Renouvelé', role: Role.PARTNER, uiLang: 'en' },
        tx as unknown as AuthTx,
      ),
    ).resolves.toMatchObject({ name: 'Renouvelé', role: Role.PARTNER, lastLoginAt: null });

    expect(txCalls[0]).toMatchObject({ op: 'create' });
    expect(txCalls[1]).toEqual({
      op: 'update',
      args: {
        where: { id: 'user-1' },
        data: { name: 'Renouvelé', role: PrismaRole.PARTNER, uiLang: 'en' },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          role: true,
          uiLang: true,
          active: true,
          lastLoginAt: true,
          failedLoginCount: true,
          lockedUntil: true,
        },
      },
    });
  });
});
