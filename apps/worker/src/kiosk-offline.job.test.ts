import { describe, it, expect, vi } from 'vitest';
import {
  KIOSK_OFFLINE_QUEUE_NAME,
  KIOSK_OFFLINE_JOB_ID,
  KIOSK_OFFLINE_INTERVAL_MS,
  startKioskOfflineJob,
  defaultCreateQueue,
  defaultCreateWorker,
  type KioskOfflineQueueLike,
  type KioskOfflineWorkerLike,
  type KioskOfflineJobProcessor,
  type KioskOfflineCheckResult,
} from './kiosk-offline.job.js';

class FakeQueueWithScheduler implements KioskOfflineQueueLike {
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

class FakeQueueWithAdd implements KioskOfflineQueueLike {
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

class FakeQueueUnsupported implements KioskOfflineQueueLike {
  public closeCalls = 0;

  close(): Promise<void> {
    this.closeCalls += 1;
    return Promise.resolve();
  }
}

class FakeWorker implements KioskOfflineWorkerLike {
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
  public lastProcessor: KioskOfflineJobProcessor | null = null;
  public lastOptions: { connection: { url: string } } = {
    connection: { url: '' },
  };
  public worker: FakeWorker = new FakeWorker();

  create(
    queueName: string,
    processor: KioskOfflineJobProcessor,
    options: { connection: { url: string } },
  ): KioskOfflineWorkerLike {
    this.lastQueueName = queueName;
    this.lastProcessor = processor;
    this.lastOptions = options;
    return this.worker;
  }
}

describe('kiosk-offline.job (M5 F-54 câblage 3/4)', () => {
  const REDIS_URL = 'redis://localhost:6379';

  it('exporte la constante KIOSK_OFFLINE_QUEUE_NAME avec la valeur "kiosk-offline-check"', () => {
    expect(KIOSK_OFFLINE_QUEUE_NAME).toBe('kiosk-offline-check');
    expect(KIOSK_OFFLINE_JOB_ID).toBe('kiosk-offline-check');
    expect(KIOSK_OFFLINE_INTERVAL_MS).toBe(15 * 60 * 1000);
  });

  describe('planification à 15 min', () => {
    it('planifie une tâche répétée toutes les 15 min via upsertJobScheduler avec un jobId fixe', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      let capturedQueueName = '';
      let capturedRedisUrl = '';

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: (name, opts) => {
          capturedQueueName = name;
          capturedRedisUrl = opts.connection.url;
          return fakeQueue;
        },
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      expect(capturedQueueName).toBe(KIOSK_OFFLINE_QUEUE_NAME);
      expect(capturedRedisUrl).toBe(REDIS_URL);
      expect(fakeQueue.upsertCalls).toHaveLength(1);

      const call = fakeQueue.upsertCalls[0];
      if (call === undefined) {
        throw new Error('Appel upsertJobScheduler manquant');
      }

      expect(call.jobSchedulerId).toBe(KIOSK_OFFLINE_JOB_ID);
      expect(call.repeatOpts.every).toBe(15 * 60 * 1000);
      expect(call.jobTemplate?.name).toBe(KIOSK_OFFLINE_JOB_ID);

      await handle.close();
    });

    it('planifie une tâche répétée toutes les 15 min via repeat/add si upsertJobScheduler est absent', async () => {
      const fakeQueue = new FakeQueueWithAdd();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      expect(fakeQueue.addCalls).toHaveLength(1);
      const call = fakeQueue.addCalls[0];
      if (call === undefined) {
        throw new Error('Appel add manquant');
      }

      expect(call.name).toBe(KIOSK_OFFLINE_JOB_ID);
      expect(call.opts?.jobId).toBe(KIOSK_OFFLINE_JOB_ID);
      expect(call.opts?.repeat?.every).toBe(15 * 60 * 1000);

      await handle.close();
    });

    it('lève une erreur et ferme la file si ni upsertJobScheduler ni add ne sont disponibles', async () => {
      const fakeQueue = new FakeQueueUnsupported();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      await expect(
        startKioskOfflineJob({
          redisUrl: REDIS_URL,
          check: checkMock,
          log: logMock,
          createQueue: () => fakeQueue,
          createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
        }),
      ).rejects.toThrow("La file d'attente ne supporte ni upsertJobScheduler ni add avec repeat");

      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file et propage l\'erreur si la planification échoue', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      fakeQueue.failUpsert = true;
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      await expect(
        startKioskOfflineJob({
          redisUrl: REDIS_URL,
          check: checkMock,
          log: logMock,
          createQueue: () => fakeQueue,
          createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
        }),
      ).rejects.toThrow('Erreur de planification Redis');

      expect(fakeQueue.closeCalls).toBe(1);
    });
  });

  describe('exécution du check et journalisation', () => {
    it('appelle check et journalise le nombre de kiosques alertés lors du traitement d\'un job', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>().mockResolvedValue({
        alerted: ['kiosk-01', 'kiosk-02'],
      });
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      expect(workerHolder.lastQueueName).toBe(KIOSK_OFFLINE_QUEUE_NAME);
      expect(workerHolder.lastOptions.connection.url).toBe(REDIS_URL);

      const processor = workerHolder.lastProcessor;
      if (processor === null) {
        throw new Error('Processeur worker non capturé');
      }

      const result = await processor({});
      expect(checkMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ alerted: ['kiosk-01', 'kiosk-02'] });

      expect(logMock).toHaveBeenCalledTimes(1);
      const logMessage = logMock.mock.calls[0]?.[0];
      expect(logMessage).toContain('2');
      expect(logMessage).toContain('kiosque(s) alerté(s)');

      await handle.close();
    });

    it('journalise 0 kiosque alerté lorsque la liste des alertes est vide', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>().mockResolvedValue({
        alerted: [],
      });
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      const processor = workerHolder.lastProcessor;
      if (processor === null) {
        throw new Error('Processeur worker non capturé');
      }

      const result = await processor({});
      expect(result).toEqual({ alerted: [] });
      expect(logMock).toHaveBeenCalledTimes(1);
      const logMessage = logMock.mock.calls[0]?.[0];
      expect(logMessage).toContain('0');

      await handle.close();
    });
  });

  describe('erreur du check remontée à BullMQ', () => {
    it('propage l\'erreur renvoyée par check vers BullMQ sans journaliser de succès', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      const dbError = new Error('Base de données inaccessible');
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>().mockRejectedValue(dbError);
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      const processor = workerHolder.lastProcessor;
      if (processor === null) {
        throw new Error('Processeur worker non capturé');
      }

      await expect(processor({})).rejects.toThrow('Base de données inaccessible');
      expect(logMock).not.toHaveBeenCalled();

      await handle.close();
    });
  });

  describe('fermeture', () => {
    it('ferme le worker et la file d\'attente', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      await handle.close();

      expect(workerHolder.worker.closeCalls).toBe(1);
      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file d\'attente même si la fermeture du worker échoue', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const workerHolder = new FakeWorkerFactoryHolder();
      workerHolder.worker.failClose = true;
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      const handle = await startKioskOfflineJob({
        redisUrl: REDIS_URL,
        check: checkMock,
        log: logMock,
        createQueue: () => fakeQueue,
        createWorker: (name, proc, opts) => workerHolder.create(name, proc, opts),
      });

      await expect(handle.close()).rejects.toThrow('Erreur arrêt worker');
      expect(workerHolder.worker.closeCalls).toBe(1);
      expect(fakeQueue.closeCalls).toBe(1);
    });

    it('ferme la file si createWorker lève une exception à la création', async () => {
      const fakeQueue = new FakeQueueWithScheduler();
      const checkMock = vi.fn<() => Promise<KioskOfflineCheckResult>>();
      const logMock = vi.fn<(m: string) => void>();

      await expect(
        startKioskOfflineJob({
          redisUrl: REDIS_URL,
          check: checkMock,
          log: logMock,
          createQueue: () => fakeQueue,
          createWorker: () => {
            throw new Error('Échec instanciation worker');
          },
        }),
      ).rejects.toThrow('Échec instanciation worker');

      expect(fakeQueue.closeCalls).toBe(1);
    });
  });

  describe('fabriques par défaut', () => {
    it('defaultCreateQueue instancie une file BullMQ avec sa méthode close', async () => {
      const queue = defaultCreateQueue('kiosk-offline-test-queue', {
        connection: { url: REDIS_URL },
      });
      expect(typeof queue.close).toBe('function');
      await queue.close();
    });

    it('defaultCreateWorker instancie un worker BullMQ avec sa méthode close', async () => {
      const worker = defaultCreateWorker(
        'kiosk-offline-test-queue',
        () => Promise.resolve({ alerted: [] }),
        { connection: { url: REDIS_URL } },
      );
      expect(typeof worker.close).toBe('function');
      await worker.close();
    });
  });
});
