import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaUnitOfWork, type AuthTx } from './unit-of-work.js';

describe('PrismaUnitOfWork', () => {
  it('exécute le travail dans $transaction et propage le résultat', async () => {
    const tx = { marker: true };
    const prisma = {
      $transaction: (work: (db: AuthTx) => Promise<unknown>) => work(tx as unknown as AuthTx),
    };
    const unit = new PrismaUnitOfWork(prisma as unknown as PrismaService);

    await expect(
      unit.run((db) => {
        expect(db).toBe(tx);
        return Promise.resolve('ok');
      }),
    ).resolves.toBe('ok');
  });

  it('propage un échec pour que Prisma annule la transaction', async () => {
    const prisma = {
      $transaction: (work: (db: AuthTx) => Promise<unknown>) => work({} as AuthTx),
    };
    const unit = new PrismaUnitOfWork(prisma as unknown as PrismaService);

    await expect(unit.run(() => Promise.reject(new Error('echec')))).rejects.toThrow('echec');
  });
});
