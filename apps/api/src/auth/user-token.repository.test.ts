import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { type AuthTx } from './unit-of-work.js';
import { PrismaUserTokenRepository } from './user-token.repository.js';

const row = {
  id: 'token-1',
  userId: 'user-1',
  type: 'PASSWORD_RESET' as const,
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date('2026-09-29T13:00:00.000Z'),
  usedAt: null,
  createdAt: new Date('2026-09-29T12:00:00.000Z'),
};

function repositoryFor(found: typeof row | null) {
  const calls: { op: string; args: unknown }[] = [];
  const prisma = {
    userToken: {
      create: (args: unknown) => {
        calls.push({ op: 'create', args });
        return Promise.resolve(row);
      },
      findUnique: (args: unknown) => {
        calls.push({ op: 'findUnique', args });
        return Promise.resolve(found);
      },
      update: (args: unknown) => {
        calls.push({ op: 'update', args });
        return Promise.resolve(row);
      },
      updateMany: (args: unknown) => {
        calls.push({ op: 'updateMany', args });
        return Promise.resolve({ count: 1 });
      },
    },
  };
  return {
    calls,
    repository: new PrismaUserTokenRepository(prisma as unknown as PrismaService),
  };
}

describe('PrismaUserTokenRepository', () => {
  it('crée un jeton à partir de son empreinte', async () => {
    const { repository, calls } = repositoryFor(row);
    const expiresAt = new Date('2026-09-29T13:00:00.000Z');

    await expect(
      repository.create({
        userId: 'user-1',
        type: 'PASSWORD_RESET',
        tokenHash: row.tokenHash,
        expiresAt,
      }),
    ).resolves.toEqual({
      id: 'token-1',
      userId: 'user-1',
      type: 'PASSWORD_RESET',
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: null,
    });
    expect(calls[0]).toEqual({
      op: 'create',
      args: {
        data: {
          userId: 'user-1',
          type: 'PASSWORD_RESET',
          tokenHash: row.tokenHash,
          expiresAt,
        },
      },
    });
  });

  it('retrouve un jeton par empreinte, ou null', async () => {
    const found = repositoryFor(row);
    const missing = repositoryFor(null);

    await expect(found.repository.findByHash(row.tokenHash)).resolves.toMatchObject({
      id: 'token-1',
      tokenHash: row.tokenHash,
    });
    await expect(missing.repository.findByHash('absent')).resolves.toBeNull();
    expect(found.calls[0]).toEqual({
      op: 'findUnique',
      args: { where: { tokenHash: row.tokenHash } },
    });
  });

  it('marque un jeton utilisé sur Prisma ou sur la transaction', async () => {
    const { repository, calls } = repositoryFor(row);
    const txCalls: unknown[] = [];
    const tx = {
      userToken: {
        update: (args: unknown) => {
          txCalls.push(args);
          return Promise.resolve(row);
        },
      },
    };
    const usedAt = new Date('2026-09-29T12:30:00.000Z');

    await repository.markUsed('token-1', usedAt);
    await repository.markUsed('token-1', usedAt, tx as unknown as AuthTx);

    expect(calls).toEqual([{ op: 'update', args: { where: { id: 'token-1' }, data: { usedAt } } }]);
    expect(txCalls).toEqual([{ where: { id: 'token-1' }, data: { usedAt } }]);
  });

  it('invalide les jetons encore inutilisés de ce compte et de ce type', async () => {
    const { repository, calls } = repositoryFor(row);

    await repository.invalidateUnused('user-1', 'PASSWORD_RESET');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: 'updateMany',
      args: { where: { userId: 'user-1', type: 'PASSWORD_RESET', usedAt: null } },
    });
    const first = calls[0];
    if (first?.op === 'updateMany') {
      const args = first.args as { data: { usedAt: Date } };
      expect(args.data.usedAt).toBeInstanceOf(Date);
    }
  });
});
