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

function repositoryFor(found: typeof row | null, markCount = 1) {
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
        return Promise.resolve({ count: markCount });
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

  it('marque un jeton encore libre, sur Prisma ou sur la transaction', async () => {
    const { repository, calls } = repositoryFor(row);
    const txCalls: unknown[] = [];
    const tx = {
      userToken: {
        updateMany: (args: unknown) => {
          txCalls.push(args);
          return Promise.resolve({ count: 1 });
        },
      },
    };
    const usedAt = new Date('2026-09-29T12:30:00.000Z');
    const expected = { where: { id: 'token-1', usedAt: null }, data: { usedAt } };

    await expect(repository.markUsed('token-1', usedAt)).resolves.toBe(true);
    await expect(repository.markUsed('token-1', usedAt, tx as unknown as AuthTx)).resolves.toBe(
      true,
    );

    expect(calls).toEqual([{ op: 'updateMany', args: expected }]);
    expect(txCalls).toEqual([expected]);
  });

  it('ne marque pas un jeton déjà pris', async () => {
    const { repository } = repositoryFor(row, 0);
    const usedAt = new Date('2026-09-29T12:30:00.000Z');

    await expect(repository.markUsed('token-1', usedAt)).resolves.toBe(false);
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

  it('crée et invalide sur le client de transaction', async () => {
    const { repository, calls } = repositoryFor(row);
    const txCalls: { op: string; args: unknown }[] = [];
    const tx = {
      userToken: {
        create: (args: unknown) => {
          txCalls.push({ op: 'create', args });
          return Promise.resolve(row);
        },
        updateMany: (args: unknown) => {
          txCalls.push({ op: 'updateMany', args });
          return Promise.resolve({ count: 1 });
        },
      },
    };
    const expiresAt = new Date('2026-09-29T13:00:00.000Z');

    await repository.create(
      {
        userId: 'user-1',
        type: 'INVITE',
        tokenHash: row.tokenHash,
        expiresAt,
      },
      tx as unknown as AuthTx,
    );
    await repository.invalidateUnused('user-1', 'INVITE', tx as unknown as AuthTx);

    expect(calls).toEqual([]);
    expect(txCalls[0]).toEqual({
      op: 'create',
      args: {
        data: {
          userId: 'user-1',
          type: 'INVITE',
          tokenHash: row.tokenHash,
          expiresAt,
        },
      },
    });
    expect(txCalls[1]).toMatchObject({
      op: 'updateMany',
      args: { where: { userId: 'user-1', type: 'INVITE', usedAt: null } },
    });
  });
});
