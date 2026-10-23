import { describe, expect, it } from 'vitest';
import { EVENT_CHANNELS, EVENT_TYPES, type StatsDailyRecord } from '@xplor/shared';
import {
  STATS_DAILY_INTERVAL_MS,
  STATS_DAILY_JOB_ID,
  STATS_DAILY_QUEUE_NAME,
  defaultCreateQueue,
  defaultCreateStatsDailyQueue,
  defaultCreateStatsDailyWorker,
  defaultCreateWorker,
  recalculateStatsDaily,
  startStatsDailyJob,
  type StatsDailyJobProcessor,
  type StatsDailyQueueLike,
  type StatsDailyWorkerLike,
} from './stats-daily.job.js';
import type { StatsDailySourceEvent } from './stats-daily-aggregation.js';
import type { StatsDailyRepository } from './stats-daily-repository.js';

class FakeQueueWithScheduler implements StatsDailyQueueLike {
  public upsertCalls: Array<{
    jobSchedulerId: string;
    repeatOpts: { every: number };
    jobTemplate?: {
      name?: string;
      data?: Record<string, unknown>;
      opts?: Record<string, unknown>;
    };
  }> = [];
  public closeCalls = 0;
  public failUpsert = false;

  upsertJobScheduler(
    jobSchedulerId: string,
    repeatOpts: { every: number },
    jobTemplate?: {
      name?: string;
      data?: Record<string, unknown>;
      opts?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    if (this.failUpsert) {
      return Promise.reject(new Error('Erreur de planification Redis'));
    }
    this.upsertCalls.push({ jobSchedulerId, repeatOpts, jobTemplate });
    return Promise.resolve(undefined);
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

class FakeQueueWithAdd implements StatsDailyQueueLike {
  public addCalls: Array<{
    name: string;
    data: unknown;
    opts?: {
      jobId?: string;
      repeat?: { every: number };
    };
  }> = [];
  public closeCalls = 0;
  public failAdd = false;

  add(
    name: string,
    data: unknown,
    opts?: {
      jobId?: string;
      repeat?: { every: number };
    },
  ): Promise<unknown> {
    if (this.failAdd) {
      return Promise.reject(new Error('Erreur ajout Redis'));
    }
    this.addCalls.push({ name, data, opts });
    return Promise.resolve(undefined);
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

class FakeQueueUnsupported implements StatsDailyQueueLike {
  public closeCalls = 0;

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

class FakeWorker implements StatsDailyWorkerLike {
  public closeCalls = 0;
  public failClose = false;

  close(): Promise<void> {
    this.closeCalls += 1;
    if (this.failClose) {
      return Promise.reject(new Error('Erreur arrêt worker'));
    }
    return Promise.resolve();
  }
}

class FakeWorkerFactoryHolder {
  public lastQueueName = '';
  public lastProcessor: StatsDailyJobProcessor | null = null;
  public lastOptions: { connection: { url: string } } = {
    connection: { url: '' },
  };
  public worker: FakeWorker = new FakeWorker();

  create(
    queueName: string,
    processor: StatsDailyJobProcessor,
    options: { connection: { url: string } },
  ): StatsDailyWorkerLike {
    this.lastQueueName = queueName;
    this.lastProcessor = processor;
    this.lastOptions = options;
    return this.worker;
  }
}

class FakeStatsDailyRepo implements StatsDailyRepository {
  public findCalls: Array<{ dayStart: Date; dayEnd: Date }> = [];
  public replaceCalls: Array<{ day: Date; records: readonly StatsDailyRecord[] }> = [];
  public eventsToReturn: StatsDailySourceEvent[] = [];
  public failFind = false;
  public failReplace = false;

  findEventsForDay(
    dayStart: Date,
    dayEnd: Date,
  ): Promise<StatsDailySourceEvent[]> {
    if (this.failFind) {
      return Promise.reject(new Error('Erreur lecture Event'));
    }
    this.findCalls.push({ dayStart, dayEnd });
    return Promise.resolve(this.eventsToReturn);
  }

  replaceStatsForDay(
    day: Date,
    records: readonly StatsDailyRecord[],
  ): Promise<void> {
    if (this.failReplace) {
      return Promise.reject(new Error('Erreur écriture StatsDaily'));
    }
    this.replaceCalls.push({ day, records });
    return Promise.resolve();
  }
}

describe('stats-daily.job', () => {
  describe('constantes du job', () => {
    it('expose la configuration du job BullMQ horaire', () => {
      expect(STATS_DAILY_QUEUE_NAME).toBe('stats-daily-aggregation');
      expect(STATS_DAILY_JOB_ID).toBe('stats-daily-aggregation');
      expect(STATS_DAILY_INTERVAL_MS).toBe(60 * 60 * 1000);
    });
  });

  describe('recalculateStatsDaily', () => {
    it('traite hier et aujourd’hui et remplace les agrégats de chaque jour', async () => {
      const repo = new FakeStatsDailyRepo();
      const now = new Date('2026-10-23T14:30:00.000Z');

      // Un événement hier et un événement aujourd’hui
      repo.eventsToReturn = [
        {
          occurredAt: new Date('2026-10-22T10:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-yesterday',
          type: EVENT_TYPES.SESSION_START,
        },
        {
          occurredAt: new Date('2026-10-23T09:00:00.000Z'),
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          sessionId: 's-today',
          type: EVENT_TYPES.SESSION_START,
        },
      ];

      const logs: string[] = [];
      const result = await recalculateStatsDaily(
        { repo, log: (m) => logs.push(m) },
        now,
      );

      expect(repo.findCalls).toHaveLength(2);
      expect(repo.replaceCalls).toHaveLength(2);

      // Hier
      expect(repo.findCalls[0]?.dayStart.toISOString()).toBe('2026-10-22T00:00:00.000Z');
      expect(repo.findCalls[0]?.dayEnd.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(repo.replaceCalls[0]?.day.toISOString()).toBe('2026-10-22T00:00:00.000Z');
      expect(result.yesterday.day).toBe('2026-10-22');
      expect(result.yesterday.bucketsCount).toBe(1);

      // Aujourd'hui
      expect(repo.findCalls[1]?.dayStart.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(repo.findCalls[1]?.dayEnd.toISOString()).toBe('2026-10-24T00:00:00.000Z');
      expect(repo.replaceCalls[1]?.day.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(result.today.day).toBe('2026-10-23');
      expect(result.today.bucketsCount).toBe(1);

      expect(logs).toHaveLength(1);
      const logMsg = logs[0];
      if (logMsg !== undefined) {
        expect(logMsg).toContain('2026-10-22');
        expect(logMsg).toContain('2026-10-23');
      }
    });

    it('gère une absence d’événements sans lever d’erreur', async () => {
      const repo = new FakeStatsDailyRepo();
      const now = new Date('2026-10-23T14:30:00.000Z');
      repo.eventsToReturn = [];

      const result = await recalculateStatsDaily({ repo }, now);

      expect(result.yesterday.bucketsCount).toBe(0);
      expect(result.today.bucketsCount).toBe(0);
      expect(repo.replaceCalls).toHaveLength(2);
      const call1 = repo.replaceCalls[0];
      if (call1 !== undefined) {
        expect(call1.records).toHaveLength(0);
      }
      const call2 = repo.replaceCalls[1];
      if (call2 !== undefined) {
        expect(call2.records).toHaveLength(0);
      }
    });

    it('propage l’erreur sans masquer l’échec si la lecture d’événements échoue', async () => {
      const repo = new FakeStatsDailyRepo();
      repo.failFind = true;
      const now = new Date('2026-10-23T14:30:00.000Z');

      await expect(recalculateStatsDaily({ repo }, now)).rejects.toThrow(
        'Erreur lecture Event',
      );
    });

    it('propage l’erreur sans masquer l’échec si le remplacement StatsDaily échoue', async () => {
      const repo = new FakeStatsDailyRepo();
      repo.failReplace = true;
      const now = new Date('2026-10-23T14:30:00.000Z');

      await expect(recalculateStatsDaily({ repo }, now)).rejects.toThrow(
        'Erreur écriture StatsDaily',
      );
    });
  });

  describe('startStatsDailyJob', () => {
    it('planifie avec upsertJobScheduler (BullMQ v5+) et démarre le worker', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const holder = new FakeWorkerFactoryHolder();
      const logs: string[] = [];

      const handle = await startStatsDailyJob({
        redisUrl: 'redis://localhost:6379',
        recalculate: () =>
          Promise.resolve({
            yesterday: { day: '2026-10-22', bucketsCount: 2 },
            today: { day: '2026-10-23', bucketsCount: 3 },
          }),
        log: (m) => logs.push(m),
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => holder.create(name, proc, opts),
      });

      // Vérifie la planification horaire répétable
      expect(fakeQueue.upsertCalls).toHaveLength(1);
      const upsert = fakeQueue.upsertCalls[0];
      if (upsert !== undefined) {
        expect(upsert.jobSchedulerId).toBe(STATS_DAILY_JOB_ID);
        expect(upsert.repeatOpts.every).toBe(STATS_DAILY_INTERVAL_MS);
      }

      // Vérifie les paramètres du worker
      expect(holder.lastQueueName).toBe(STATS_DAILY_QUEUE_NAME);
      expect(holder.lastOptions.connection.url).toBe('redis://localhost:6379');

      // Exécute le processeur pour vérifier le traitement et la journalisation
      if (holder.lastProcessor !== null) {
        const result = await holder.lastProcessor({});
        expect(result.yesterday.bucketsCount).toBe(2);
        expect(result.today.bucketsCount).toBe(3);
        expect(logs).toHaveLength(1);
      } else {
        expect.fail('Le processeur aurait dû être fourni au worker');
      }

      // Fermeture propre du worker et de la file
      await handle.close();
      expect(holder.worker.closeCalls).toBe(1);
      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('propage l’erreur si recalculate échoue lors de l’exécution du processeur', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const holder = new FakeWorkerFactoryHolder();

      await startStatsDailyJob({
        redisUrl: 'redis://localhost:6379',
        recalculate: () => Promise.reject(new Error('Erreur interne de recalcul')),
        log: () => undefined,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => holder.create(name, proc, opts),
      });

      if (holder.lastProcessor !== null) {
        await expect(holder.lastProcessor({})).rejects.toThrow('Erreur interne de recalcul');
      } else {
        expect.fail('Le processeur aurait dû être fourni au worker');
      }
    });

    it('se replie sur queue.add avec repeat si upsertJobScheduler n’est pas disponible', async () => {
      const fakeQueue = new FakeQueueWithAdd();
      const holder = new FakeWorkerFactoryHolder();

      const handle = await startStatsDailyJob({
        redisUrl: 'redis://localhost:6379',
        recalculate: () =>
          Promise.resolve({
            yesterday: { day: '2026-10-22', bucketsCount: 0 },
            today: { day: '2026-10-23', bucketsCount: 0 },
          }),
        log: () => undefined,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => holder.create(name, proc, opts),
      });

      expect(fakeQueue.addCalls).toHaveLength(1);
      const addCall = fakeQueue.addCalls[0];
      if (addCall !== undefined) {
        expect(addCall.name).toBe(STATS_DAILY_JOB_ID);
        expect(addCall.opts?.repeat?.every).toBe(STATS_DAILY_INTERVAL_MS);
      }

      await handle.close();
      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('lève une erreur et ferme la file si la file ne supporte ni upsert ni add', async () => {
      const fakeQueue = new FakeQueueUnsupported();
      const holder = new FakeWorkerFactoryHolder();

      await expect(
        startStatsDailyJob({
          redisUrl: 'redis://localhost:6379',
          recalculate: () =>
            Promise.resolve({
              yesterday: { day: '2026-10-22', bucketsCount: 0 },
              today: { day: '2026-10-23', bucketsCount: 0 },
            }),
          log: () => undefined,
          createQueue: () => fakeQueue,
          createWorker: (name, proc, opts) => holder.create(name, proc, opts),
        }),
      ).rejects.toThrow("La file d'attente ne supporte ni upsertJobScheduler ni add avec repeat");

      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file si la planification Redis échoue', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      fakeQueue.failUpsert = true;
      const holder = new FakeWorkerFactoryHolder();

      await expect(
        startStatsDailyJob({
          redisUrl: 'redis://localhost:6379',
          recalculate: () =>
            Promise.resolve({
              yesterday: { day: '2026-10-22', bucketsCount: 0 },
              today: { day: '2026-10-23', bucketsCount: 0 },
            }),
          log: () => undefined,
          createQueue: () => fakeQueue,
          createWorker: (name, proc, opts) => holder.create(name, proc, opts),
        }),
      ).rejects.toThrow('Erreur de planification Redis');

      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file si la création du worker échoue', async () => {
      const fakeQueue = new FakeQueueWithScheduler();

      await expect(
        startStatsDailyJob({
          redisUrl: 'redis://localhost:6379',
          recalculate: () =>
            Promise.resolve({
              yesterday: { day: '2026-10-22', bucketsCount: 0 },
              today: { day: '2026-10-23', bucketsCount: 0 },
            }),
          log: () => undefined,
          createQueue: () => fakeQueue,
          createWorker: () => {
            throw new Error('Erreur création worker');
          },
        }),
      ).rejects.toThrow('Erreur création worker');

      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file même si worker.close() échoue lors du shutdown', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const holder = new FakeWorkerFactoryHolder();
      holder.worker.failClose = true;

      const handle = await startStatsDailyJob({
        redisUrl: 'redis://localhost:6379',
        recalculate: () =>
          Promise.resolve({
            yesterday: { day: '2026-10-22', bucketsCount: 0 },
            today: { day: '2026-10-23', bucketsCount: 0 },
          }),
        log: () => undefined,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => holder.create(name, proc, opts),
      });

      await expect(handle.close()).rejects.toThrow('Erreur arrêt worker');
      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('fabriques par défaut instancient Queue et Worker avec options', () => {
      expect(typeof defaultCreateStatsDailyQueue).toBe('function');
      expect(typeof defaultCreateStatsDailyWorker).toBe('function');
      expect(typeof defaultCreateQueue).toBe('function');
      expect(typeof defaultCreateWorker).toBe('function');
    });
  });
});
