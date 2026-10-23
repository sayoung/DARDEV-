import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { EVENT_CHANNELS, EVENT_TYPES, type StatsDailyRecord } from '@xplor/shared';
import { aggregateEventsForDay, getDayUtcRange } from './stats-daily-aggregation.js';
import {
  PrismaStatsDailyRepository,
  type PrismaEventDelegate,
  type PrismaRawEventRow,
  type PrismaStatsDailyDelegate,
  type StatsDailyCreateData,
  type StatsDailyPrismaClient,
  type StatsDailyTransactionClient,
} from './stats-daily-repository.js';

class InMemoryPrismaClient implements StatsDailyPrismaClient {
  public eventsInDb: PrismaRawEventRow[] = [];
  public statsInDb: StatsDailyCreateData[] = [];
  public transactionCalls = 0;
  public deleteCalls: Array<{ day: Date }> = [];
  public createCalls: Array<{ data: StatsDailyCreateData[] }> = [];
  public failDelete = false;
  public failCreate = false;

  public event: PrismaEventDelegate = {
    findMany: (args): Promise<PrismaRawEventRow[]> => {
      const gteTime = args.where.occurredAt.gte.getTime();
      const ltTime = args.where.occurredAt.lt.getTime();
      const filtered = this.eventsInDb.filter((e) => {
        const time = e.occurredAt.getTime();
        return time >= gteTime && time < ltTime;
      });
      return Promise.resolve(filtered);
    },
  };

  public statsDaily: PrismaStatsDailyDelegate = {
    deleteMany: (args): Promise<{ count: number }> => {
      if (this.failDelete) {
        return Promise.reject(new Error('Erreur simulée dans deleteMany'));
      }
      this.deleteCalls.push({ day: args.where.day });
      const targetTime = args.where.day.getTime();
      const beforeCount = this.statsInDb.length;
      this.statsInDb = this.statsInDb.filter(
        (s) => s.day.getTime() !== targetTime,
      );
      return Promise.resolve({ count: beforeCount - this.statsInDb.length });
    },
    createMany: (args): Promise<{ count: number }> => {
      if (this.failCreate) {
        return Promise.reject(new Error('Erreur simulée dans createMany'));
      }
      this.createCalls.push(args);
      this.statsInDb.push(...args.data);
      return Promise.resolve({ count: args.data.length });
    },
  };

  async $transaction<T>(
    fn: (tx: StatsDailyTransactionClient) => Promise<T>,
  ): Promise<T> {
    this.transactionCalls += 1;
    const backup = [...this.statsInDb];
    try {
      return await fn({ statsDaily: this.statsDaily });
    } catch (error) {
      this.statsInDb = backup;
      throw error;
    }
  }
}

describe('PrismaStatsDailyRepository', () => {
  const day1 = new Date('2026-10-22T00:00:00.000Z');
  const day2 = new Date('2026-10-23T00:00:00.000Z');

  describe('findEventsForDay', () => {
    it('récupère uniquement les événements dans l’intervalle de dates sans altérer Event', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      fakePrisma.eventsInDb = [
        {
          occurredAt: new Date('2026-10-21T23:59:59.999Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-outside-before',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T00:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-inside-start',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-22T23:59:59.999Z'),
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'ar',
          sessionId: 's-inside-end',
          type: EVENT_TYPES.TOUR_OPEN,
        },
        {
          occurredAt: new Date('2026-10-23T00:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-outside-after',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const repo = new PrismaStatsDailyRepository(fakePrisma);
      const dayStart = new Date('2026-10-22T00:00:00.000Z');
      const dayEnd = new Date('2026-10-23T00:00:00.000Z');

      const result = await repo.findEventsForDay(dayStart, dayEnd);
      expect(result).toHaveLength(2);
      const first = result[0];
      const second = result[1];
      if (first !== undefined) {
        expect(first.sessionId).toBe('s-inside-start');
        expect(first.channel).toBe(EVENT_CHANNELS.WEB);
        expect(first.type).toBe(EVENT_TYPES.SESSION_START);
      }
      if (second !== undefined) {
        expect(second.sessionId).toBe('s-inside-end');
        expect(second.channel).toBe(EVENT_CHANNELS.KIOSK);
        expect(second.type).toBe(EVENT_TYPES.TOUR_OPEN);
      }

      // Vérifie que les données brutes dans Event sont inchangées (lecture seule)
      expect(fakePrisma.eventsInDb).toHaveLength(4);
    });

    it('valide et rejette un canal invalide via Zod', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      fakePrisma.eventsInDb = [
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          channel: 'CANAL_INCONNU',
          lang: 'fr',
          sessionId: 's-invalid',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const repo = new PrismaStatsDailyRepository(fakePrisma);
      await expect(
        repo.findEventsForDay(
          new Date('2026-10-22T00:00:00.000Z'),
          new Date('2026-10-23T00:00:00.000Z'),
        ),
      ).rejects.toThrow(ZodError);
    });

    it('valide et rejette un type d’événement invalide via Zod', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      fakePrisma.eventsInDb = [
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-invalid-type',
          type: 'TYPE_INCONNU',
        },
      ];

      const repo = new PrismaStatsDailyRepository(fakePrisma);
      await expect(
        repo.findEventsForDay(
          new Date('2026-10-22T00:00:00.000Z'),
          new Date('2026-10-23T00:00:00.000Z'),
        ),
      ).rejects.toThrow(ZodError);
    });
  });

  describe('replaceStatsForDay', () => {
    it('remplace de manière idempotente les enregistrements d’un jour donné', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      const repo = new PrismaStatsDailyRepository(fakePrisma);

      fakePrisma.statsInDb = [
        {
          day: day1,
          bucketKey: 'hotel-a:tour-a:WEB:fr',
          hotelId: 'hotel-a',
          tourId: 'tour-a',
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessions: 3,
          toursOpened: 3,
          scenesViewed: 6,
          hotspotClicks: 1,
          audioPlays: 0,
          vrEntries: 0,
          qrShown: 0,
          sessionDurationMs: 60_000n,
        },
        {
          day: day2,
          bucketKey: 'hotel-b:tour-b:KIOSK:ar',
          hotelId: 'hotel-b',
          tourId: 'tour-b',
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'ar',
          sessions: 10,
          toursOpened: 12,
          scenesViewed: 30,
          hotspotClicks: 5,
          audioPlays: 2,
          vrEntries: 1,
          qrShown: 4,
          sessionDurationMs: 300_000n,
        },
      ];

      const newDay1Records: StatsDailyRecord[] = [
        {
          day: day1,
          bucketKey: 'hotel-a:tour-a:WEB:fr',
          hotelId: 'hotel-a',
          tourId: 'tour-a',
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessions: 5,
          toursOpened: 7,
          scenesViewed: 15,
          hotspotClicks: 4,
          audioPlays: 1,
          vrEntries: 0,
          qrShown: 1,
          sessionDurationMs: 120_000n,
        },
      ];

      await repo.replaceStatsForDay(day1, newDay1Records);

      expect(fakePrisma.transactionCalls).toBe(1);
      expect(fakePrisma.statsInDb).toHaveLength(2);

      const day1Entry = fakePrisma.statsInDb.find(
        (s) => s.day.getTime() === day1.getTime(),
      );
      expect(day1Entry).toBeDefined();
      if (day1Entry !== undefined) {
        expect(day1Entry.sessions).toBe(5);
        expect(day1Entry.sessionDurationMs).toBe(120_000n);
      }

      // day2 reste intact
      const day2Entry = fakePrisma.statsInDb.find(
        (s) => s.day.getTime() === day2.getTime(),
      );
      expect(day2Entry).toBeDefined();
      if (day2Entry !== undefined) {
        expect(day2Entry.sessions).toBe(10);
      }

      // Deuxième remplacement (idempotence) avec exactement le même contenu
      await repo.replaceStatsForDay(day1, newDay1Records);

      expect(fakePrisma.transactionCalls).toBe(2);
      expect(fakePrisma.statsInDb).toHaveLength(2);

      const day1AfterSecondRun = fakePrisma.statsInDb.filter(
        (s) => s.day.getTime() === day1.getTime(),
      );
      expect(day1AfterSecondRun).toHaveLength(1);
      const day1Second = day1AfterSecondRun[0];
      if (day1Second !== undefined) {
        expect(day1Second.sessions).toBe(5);
        expect(day1Second.sessionDurationMs).toBe(120_000n);
      }
    });

    it('supprime les anciens agrégats d’un jour sans événement sans toucher aux autres jours', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      const repo = new PrismaStatsDailyRepository(fakePrisma);

      fakePrisma.statsInDb = [
        {
          day: day1,
          bucketKey: 'hotel-a:tour-a:WEB:fr',
          hotelId: 'hotel-a',
          tourId: 'tour-a',
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessions: 2,
          toursOpened: 2,
          scenesViewed: 4,
          hotspotClicks: 0,
          audioPlays: 0,
          vrEntries: 0,
          qrShown: 0,
          sessionDurationMs: 30_000n,
        },
        {
          day: day2,
          bucketKey: 'hotel-b:tour-b:VR:en',
          hotelId: 'hotel-b',
          tourId: 'tour-b',
          channel: EVENT_CHANNELS.VR,
          lang: 'en',
          sessions: 1,
          toursOpened: 1,
          scenesViewed: 1,
          hotspotClicks: 0,
          audioPlays: 0,
          vrEntries: 1,
          qrShown: 0,
          sessionDurationMs: 15_000n,
        },
      ];

      // Jour sans événement : records est vide
      await repo.replaceStatsForDay(day1, []);

      // day1 a été supprimé
      expect(
        fakePrisma.statsInDb.find((s) => s.day.getTime() === day1.getTime()),
      ).toBeUndefined();
      // createMany n'a pas été appelé inutilement
      expect(fakePrisma.createCalls).toHaveLength(0);
      // day2 est resté intact
      expect(fakePrisma.statsInDb).toHaveLength(1);
      const remainingDay2 = fakePrisma.statsInDb[0];
      if (remainingDay2 !== undefined) {
        expect(remainingDay2.day.getTime()).toBe(day2.getTime());
      }
    });

    it('propage l’erreur et annule la suppression sans écriture partielle si createMany échoue', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      const repo = new PrismaStatsDailyRepository(fakePrisma);

      const initialDay1: StatsDailyCreateData = {
        day: day1,
        bucketKey: 'hotel-a:tour-a:WEB:fr',
        hotelId: 'hotel-a',
        tourId: 'tour-a',
        channel: EVENT_CHANNELS.WEB,
        lang: 'fr',
        sessions: 3,
        toursOpened: 3,
        scenesViewed: 6,
        hotspotClicks: 1,
        audioPlays: 0,
        vrEntries: 0,
        qrShown: 0,
        sessionDurationMs: 60_000n,
      };

      fakePrisma.statsInDb = [initialDay1];
      fakePrisma.failCreate = true;

      const newRecords: StatsDailyRecord[] = [
        {
          day: day1,
          bucketKey: 'hotel-a:tour-a:WEB:fr',
          hotelId: 'hotel-a',
          tourId: 'tour-a',
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessions: 10,
          toursOpened: 10,
          scenesViewed: 20,
          hotspotClicks: 2,
          audioPlays: 0,
          vrEntries: 0,
          qrShown: 0,
          sessionDurationMs: 120_000n,
        },
      ];

      await expect(repo.replaceStatsForDay(day1, newRecords)).rejects.toThrow(
        'Erreur simulée dans createMany',
      );

      // Vérifie que la base est restée dans son état initial (aucun enregistrement supprimé ni modifié)
      expect(fakePrisma.statsInDb).toHaveLength(1);
      const preserved = fakePrisma.statsInDb[0];
      if (preserved !== undefined) {
        expect(preserved.sessions).toBe(3);
        expect(preserved.sessionDurationMs).toBe(60_000n);
      }
    });

    it('propage l’erreur sans modifier la base si deleteMany échoue', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      const repo = new PrismaStatsDailyRepository(fakePrisma);

      const initialDay1: StatsDailyCreateData = {
        day: day1,
        bucketKey: 'hotel-a:tour-a:WEB:fr',
        hotelId: 'hotel-a',
        tourId: 'tour-a',
        channel: EVENT_CHANNELS.WEB,
        lang: 'fr',
        sessions: 3,
        toursOpened: 3,
        scenesViewed: 6,
        hotspotClicks: 1,
        audioPlays: 0,
        vrEntries: 0,
        qrShown: 0,
        sessionDurationMs: 60_000n,
      };

      fakePrisma.statsInDb = [initialDay1];
      fakePrisma.failDelete = true;

      await expect(repo.replaceStatsForDay(day1, [])).rejects.toThrow(
        'Erreur simulée dans deleteMany',
      );

      // Rien n'a été altéré
      expect(fakePrisma.statsInDb).toHaveLength(1);
      expect(fakePrisma.createCalls).toHaveLength(0);
    });
  });

  describe('sécurité et garanties d’écriture', () => {
    it('ne réalise aucune écriture sur Event (lecture seule garantie)', async () => {
      const fakePrisma = new InMemoryPrismaClient();
      const originalEvents: PrismaRawEventRow[] = [
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-read-only',
          type: EVENT_TYPES.SESSION_START,
        },
      ];
      fakePrisma.eventsInDb = [...originalEvents];

      const repo = new PrismaStatsDailyRepository(fakePrisma);

      // 1. Lecture
      await repo.findEventsForDay(
        new Date('2026-10-22T00:00:00.000Z'),
        new Date('2026-10-23T00:00:00.000Z'),
      );

      // 2. Remplacement des stats
      await repo.replaceStatsForDay(day1, []);

      // Event est inchangé : même longueur, même contenu
      expect(fakePrisma.eventsInDb).toHaveLength(1);
      const eventInDb = fakePrisma.eventsInDb[0];
      if (eventInDb !== undefined) {
        expect(eventInDb.sessionId).toBe('s-read-only');
      }

      // PrismaEventDelegate ne dispose d’aucune méthode d’écriture (create, update, delete)
      const eventDelegateKeys = Object.keys(fakePrisma.event);
      expect(eventDelegateKeys).toEqual(['findMany']);
    });

    it('s’intègre de bout en bout avec aggregateEventsForDay', async () => {
      const hotelId = '11111111-1111-4111-8111-111111111111';
      const tourId = '22222222-2222-4222-8222-222222222222';
      const fakePrisma = new InMemoryPrismaClient();
      fakePrisma.eventsInDb = [
        {
          occurredAt: new Date('2026-10-22T08:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-full-1',
          type: EVENT_TYPES.SESSION_START,
          hotelId,
          tourId,
        },
        {
          occurredAt: new Date('2026-10-22T08:05:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-full-1',
          type: EVENT_TYPES.SCENE_VIEW,
          hotelId,
          tourId,
        },
        {
          occurredAt: new Date('2026-10-22T08:10:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-full-1',
          type: EVENT_TYPES.SESSION_END,
          hotelId,
          tourId,
          durationMs: 45_000,
        },
      ];

      const repo = new PrismaStatsDailyRepository(fakePrisma);
      const { dayStart, dayEnd } = getDayUtcRange(day1);

      // Lecture des événements
      const events = await repo.findEventsForDay(dayStart, dayEnd);
      expect(events).toHaveLength(3);

      // Agrégation pure (events, targetDay)
      const records = aggregateEventsForDay(events, day1);
      expect(records).toHaveLength(1);

      // Persistance
      await repo.replaceStatsForDay(day1, records);
      expect(fakePrisma.statsInDb).toHaveLength(1);
      const saved = fakePrisma.statsInDb[0];
      if (saved !== undefined) {
        expect(saved.sessions).toBe(1);
        expect(saved.scenesViewed).toBe(1);
        expect(saved.sessionDurationMs).toBe(45_000n);
      }

      // Deuxième exécution : vérification de l'idempotence
      await repo.replaceStatsForDay(day1, records);
      expect(fakePrisma.statsInDb).toHaveLength(1);
    });

    it('accepte le type PrismaClient en paramètre', () => {
      const typeCheckFn = (prisma: PrismaClient) => new PrismaStatsDailyRepository(prisma);
      expect(typeof typeCheckFn).toBe('function');
    });
  });
});
