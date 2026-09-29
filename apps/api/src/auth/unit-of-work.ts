import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

/** Client d'une transaction Prisma interactive. */
export type AuthTx = Prisma.TransactionClient;

/**
 * Exécute lectures et écritures dans une seule transaction.
 * `PrismaUnitOfWork` en production, une exécution immédiate dans les tests.
 */
export interface UnitOfWork {
  run<T>(work: (db: AuthTx) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  run<T>(work: (db: AuthTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
