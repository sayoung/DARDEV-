import {
  EventChannelSchema,
  EventTypeSchema,
  type EventChannel,
  type StatsDailyRecord,
} from '@xplor/shared';
import type { StatsDailySourceEvent } from './stats-daily-aggregation.js';

export interface StatsDailyRepository {
  findEventsForDay(
    dayStart: Date,
    dayEnd: Date,
  ): Promise<StatsDailySourceEvent[]>;
  replaceStatsForDay(
    day: Date,
    records: readonly StatsDailyRecord[],
  ): Promise<void>;
}

export interface StatsDailyCreateData {
  day: Date;
  bucketKey: string;
  hotelId: string | null;
  tourId: string | null;
  channel: EventChannel;
  lang: string;
  sessions: number;
  toursOpened: number;
  scenesViewed: number;
  hotspotClicks: number;
  audioPlays: number;
  vrEntries: number;
  qrShown: number;
  sessionDurationMs: bigint;
}

export interface PrismaStatsDailyDelegate {
  deleteMany(args: { where: { day: Date } }): Promise<{ count: number }>;
  createMany(args: { data: StatsDailyCreateData[] }): Promise<{ count: number }>;
}

export interface PrismaRawEventRow {
  hotelId?: string | null;
  tourId?: string | null;
  channel: unknown;
  lang: string;
  sessionId: string;
  type: unknown;
  durationMs?: number | null;
  occurredAt: Date;
}

export interface PrismaEventDelegate {
  findMany(args: {
    where: {
      occurredAt: {
        gte: Date;
        lt: Date;
      };
    };
    select: {
      hotelId: true;
      tourId: true;
      channel: true;
      lang: true;
      sessionId: true;
      type: true;
      durationMs: true;
      occurredAt: true;
    };
  }): Promise<PrismaRawEventRow[]>;
}

export interface StatsDailyTransactionClient {
  statsDaily: PrismaStatsDailyDelegate;
}

export interface StatsDailyPrismaClient {
  event: PrismaEventDelegate;
  statsDaily: PrismaStatsDailyDelegate;
  $transaction<T>(
    fn: (tx: StatsDailyTransactionClient) => Promise<T>,
  ): Promise<T>;
}

export class PrismaStatsDailyRepository implements StatsDailyRepository {
  constructor(private readonly prisma: StatsDailyPrismaClient) {}

  /**
   * Récupère les événements bruts survenus dans l'intervalle [dayStart, dayEnd).
   * Ne modifie jamais la table Event (lecture seule).
   * Valide les types et canaux via les schémas Zod partagés.
   */
  async findEventsForDay(
    dayStart: Date,
    dayEnd: Date,
  ): Promise<StatsDailySourceEvent[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        occurredAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        hotelId: true,
        tourId: true,
        channel: true,
        lang: true,
        sessionId: true,
        type: true,
        durationMs: true,
        occurredAt: true,
      },
    });

    return rows.map((row) => ({
      hotelId: row.hotelId ?? null,
      tourId: row.tourId ?? null,
      channel: EventChannelSchema.parse(row.channel),
      lang: row.lang,
      sessionId: row.sessionId,
      type: EventTypeSchema.parse(row.type),
      durationMs: row.durationMs ?? null,
      occurredAt: row.occurredAt,
    }));
  }

  /**
   * Remplace de manière idempotente les agrégats StatsDaily d'un jour donné dans une transaction :
   * 1. Supprime les agrégats existants pour ce jour (`deleteMany`).
   * 2. Insère les nouveaux agrégats (`createMany`), s'il y en a.
   */
  async replaceStatsForDay(
    day: Date,
    records: readonly StatsDailyRecord[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.statsDaily.deleteMany({
        where: {
          day,
        },
      });

      if (records.length > 0) {
        const createData: StatsDailyCreateData[] = records.map((record) => ({
          day: record.day,
          bucketKey: record.bucketKey,
          hotelId: record.hotelId,
          tourId: record.tourId,
          channel: record.channel,
          lang: record.lang,
          sessions: record.sessions,
          toursOpened: record.toursOpened,
          scenesViewed: record.scenesViewed,
          hotspotClicks: record.hotspotClicks,
          audioPlays: record.audioPlays,
          vrEntries: record.vrEntries,
          qrShown: record.qrShown,
          sessionDurationMs: record.sessionDurationMs,
        }));

        await tx.statsDaily.createMany({
          data: createData,
        });
      }
    });
  }
}
