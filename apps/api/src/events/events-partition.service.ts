import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export interface EventsPrismaClient {
  $executeRaw(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<number>;
}

export function isDateValid(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Calcule les dates correspondant au premier jour (UTC) du mois courant
 * et des deux mois suivants.
 *
 * Lève une erreur si la date fournie est invalide.
 */
export function getPartitionDates(now: Date = new Date()): Date[] {
  if (!isDateValid(now)) {
    throw new Error('Date invalide');
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return [0, 1, 2].map((offset) => new Date(Date.UTC(year, month + offset, 1)));
}

/**
 * Formate une date au format de nom de table de partition : Event_YYYY_MM.
 *
 * Lève une erreur si la date fournie est invalide.
 */
export function formatPartitionName(date: Date): string {
  if (!isDateValid(date)) {
    throw new Error('Date invalide');
  }
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `Event_${year}_${month}`;
}

@Injectable()
export class EventsPartitionService implements OnModuleInit {
  private readonly logger = new Logger(EventsPartitionService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: EventsPrismaClient,
  ) {}

  /**
   * Crée les partitions pour le mois courant et les deux mois suivants
   * en appelant la fonction SQL create_event_partition($1::date).
   */
  async ensurePartitions(now: Date = new Date()): Promise<void> {
    const dates = getPartitionDates(now);
    for (const date of dates) {
      await this.prisma.$executeRaw`SELECT create_event_partition(${date}::date)`;
    }
  }

  /**
   * Initialisation du module : crée les partitions d'événements.
   * En cas d'échec (ex. PostgreSQL indisponible), journalise l'erreur sans
   * bloquer le démarrage de l'application (NF-04 : /api/health répond même si PG est arrêté).
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensurePartitions(new Date());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `PostgreSQL indisponible au démarrage pour le partitionnement des événements : ${message}`,
      );
    }
  }
}
