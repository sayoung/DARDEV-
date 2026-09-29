import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthTx } from './unit-of-work.js';
import { type UserTokenKind } from './user-token.js';

/** Jeton persisté. Seule l'empreinte est stockée, jamais le jeton en clair. */
export type UserTokenRecord = {
  id: string;
  userId: string;
  type: UserTokenKind;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type NewUserToken = {
  userId: string;
  type: UserTokenKind;
  tokenHash: string;
  expiresAt: Date;
};

/**
 * Surcouche Prisma des jetons d'invitation et de réinitialisation.
 * Remplacée par un faux dépôt dans les tests.
 */
export interface UserTokenRepository {
  create(input: NewUserToken): Promise<UserTokenRecord>;
  findByHash(tokenHash: string): Promise<UserTokenRecord | null>;
  markUsed(id: string, usedAt: Date, db?: AuthTx): Promise<void>;
  invalidateUnused(userId: string, type: UserTokenKind): Promise<void>;
}

export const USER_TOKEN_REPOSITORY = Symbol('USER_TOKEN_REPOSITORY');

type TokenRow = {
  id: string;
  userId: string;
  type: UserTokenKind;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

function toRecord(row: TokenRow): UserTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
  };
}

@Injectable()
export class PrismaUserTokenRepository implements UserTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NewUserToken): Promise<UserTokenRecord> {
    const row = await this.prisma.userToken.create({
      data: {
        userId: input.userId,
        type: input.type,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return toRecord(row);
  }

  async findByHash(tokenHash: string): Promise<UserTokenRecord | null> {
    const row = await this.prisma.userToken.findUnique({ where: { tokenHash } });
    return row === null ? null : toRecord(row);
  }

  async markUsed(id: string, usedAt: Date, db?: AuthTx): Promise<void> {
    const args = { where: { id }, data: { usedAt } };
    if (db) {
      await db.userToken.update(args);
      return;
    }
    await this.prisma.userToken.update(args);
  }

  async invalidateUnused(userId: string, type: UserTokenKind): Promise<void> {
    await this.prisma.userToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
