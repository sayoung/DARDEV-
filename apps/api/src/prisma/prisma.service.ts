import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error: unknown) {
      // NF-04 : /api/health doit répondre même si PostgreSQL est arrêté.
      const message = error instanceof Error ? error.message : 'database unavailable';
      console.error(`PostgreSQL indisponible au démarrage : ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
