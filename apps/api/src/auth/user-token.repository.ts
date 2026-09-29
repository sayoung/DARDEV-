import { Inject, Injectable } from '@nestjs/common';

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
  create(input: NewUserToken, db?: AuthTx): Promise<UserTokenRecord>;
  findByHash(tokenHash: string): Promise<UserTokenRecord | null>;
  /** `true` seulement si `usedAt` était encore null. */
  markUsed(id: string, usedAt: Date, db?: AuthTx): Promise<boolean>;
  invalidateUnused(userId: string, type: UserTokenKind, db?: AuthTx): Promise<void>;
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: NewUserToken, db?: AuthTx): Promise<UserTokenRecord> {
    const args = {
      data: {
        userId: input.userId,
        type: input.type,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    };
    const row = db ? await db.userToken.create(args) : await this.prisma.userToken.create(args);
    return toRecord(row);
  }

  async findByHash(tokenHash: string): Promise<UserTokenRecord | null> {
    const row = await this.prisma.userToken.findUnique({ where: { tokenHash } });
    return row === null ? null : toRecord(row);
  }

  async markUsed(id: string, usedAt: Date, db?: AuthTx): Promise<boolean> {
    const args = { where: { id, usedAt: null }, data: { usedAt } };
    const result = db
      ? await db.userToken.updateMany(args)
      : await this.prisma.userToken.updateMany(args);
    return result.count === 1;
  }

  async invalidateUnused(userId: string, type: UserTokenKind, db?: AuthTx): Promise<void> {
    const args = {
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    };
    if (db) {
      await db.userToken.updateMany(args);
      return;
    }
    await this.prisma.userToken.updateMany(args);
  }
}
