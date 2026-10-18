import { Queue, Worker } from 'bullmq';

/**
 * Nom de la file BullMQ pour le contrôle périodique des kiosques hors ligne (F-54).
 */
export const KIOSK_OFFLINE_QUEUE_NAME = 'kiosk-offline-check';

/**
 * Identifiant fixe du job et du scheduler pour éviter les doublons dans BullMQ.
 */
export const KIOSK_OFFLINE_JOB_ID = 'kiosk-offline-check';

/**
 * Intervalle de répétition de la vérification : 15 minutes en millisecondes.
 */
export const KIOSK_OFFLINE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Résultat attendu de la fonction de contrôle des kiosques hors-ligne.
 */
export interface KioskOfflineCheckResult {
  alerted: string[];
}

/**
 * Fonction de vérification des kiosques hors-ligne (ex: runKioskOfflineCheck).
 */
export type KioskOfflineCheckFn = () => Promise<KioskOfflineCheckResult>;

/**
 * Fonction de journalisation des messages du worker.
 */
export type KioskOfflineLogFn = (message: string) => void;

/**
 * Processeur de tâche BullMQ exécuté lors du déclenchement du job.
 */
export type KioskOfflineJobProcessor = (
  job: unknown,
) => Promise<KioskOfflineCheckResult>;

/**
 * Interface minimale d'une file BullMQ pour la planification et la fermeture.
 */
export interface KioskOfflineQueueLike {
  upsertJobScheduler?(
    jobSchedulerId: string,
    repeatOpts: { every: number },
    jobTemplate?: {
      name?: string;
      data?: Record<string, unknown>;
      opts?: Record<string, unknown>;
    },
  ): Promise<unknown>;
  add?(
    name: string,
    data: unknown,
    opts?: {
      jobId?: string;
      repeat?: { every: number };
    },
  ): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * Interface minimale d'un worker BullMQ pour la fermeture.
 */
export interface KioskOfflineWorkerLike {
  close(): Promise<void>;
}

/**
 * Fabrique de file BullMQ injectable pour les tests.
 */
export type QueueFactory = (
  queueName: string,
  options: { connection: { url: string } },
) => KioskOfflineQueueLike;

/**
 * Fabrique de worker BullMQ injectable pour les tests.
 */
export type WorkerFactory = (
  queueName: string,
  processor: KioskOfflineJobProcessor,
  options: { connection: { url: string } },
) => KioskOfflineWorkerLike;

/**
 * Options d'initialisation du job de surveillance des kiosques hors-ligne.
 */
export interface StartKioskOfflineJobOptions {
  redisUrl: string;
  check: KioskOfflineCheckFn;
  log: KioskOfflineLogFn;
  createQueue?: QueueFactory;
  createWorker?: WorkerFactory;
}

/**
 * Poignée de contrôle du job permettant la fermeture propre des ressources.
 */
export interface KioskOfflineJobHandle {
  close(): Promise<void>;
}

/**
 * Fabrique par défaut pour instancier la file BullMQ réelle.
 */
export function defaultCreateQueue(
  queueName: string,
  options: { connection: { url: string } },
): KioskOfflineQueueLike {
  return new Queue(queueName, options);
}

/**
 * Fabrique par défaut pour instancier le worker BullMQ réel.
 */
export function defaultCreateWorker(
  queueName: string,
  processor: KioskOfflineJobProcessor,
  options: { connection: { url: string } },
): KioskOfflineWorkerLike {
  return new Worker(
    queueName,
    async (job) => {
      return processor(job);
    },
    options,
  );
}

/**
 * Planifie la tâche de vérification des kiosques hors ligne toutes les 15 minutes
 * et démarre un Worker BullMQ pour traiter les exécutions (F-54 câblage 3/4).
 */
export async function startKioskOfflineJob(
  opts: StartKioskOfflineJobOptions,
): Promise<KioskOfflineJobHandle> {
  const createQueue = opts.createQueue ?? defaultCreateQueue;
  const createWorker = opts.createWorker ?? defaultCreateWorker;
  const connection = { url: opts.redisUrl };

  const queue = createQueue(KIOSK_OFFLINE_QUEUE_NAME, { connection });

  try {
    if (typeof queue.upsertJobScheduler === 'function') {
      await queue.upsertJobScheduler(
        KIOSK_OFFLINE_JOB_ID,
        { every: KIOSK_OFFLINE_INTERVAL_MS },
        {
          name: KIOSK_OFFLINE_JOB_ID,
          data: {},
        },
      );
    } else if (typeof queue.add === 'function') {
      await queue.add(
        KIOSK_OFFLINE_JOB_ID,
        {},
        {
          jobId: KIOSK_OFFLINE_JOB_ID,
          repeat: { every: KIOSK_OFFLINE_INTERVAL_MS },
        },
      );
    } else {
      throw new Error(
        "La file d'attente ne supporte ni upsertJobScheduler ni add avec repeat",
      );
    }
  } catch (scheduleError) {
    await queue.close();
    throw scheduleError;
  }

  let worker: KioskOfflineWorkerLike;
  try {
    worker = createWorker(
      KIOSK_OFFLINE_QUEUE_NAME,
      async () => {
        const result = await opts.check();
        opts.log(
          `Vérification des kiosques hors ligne : ${String(result.alerted.length)} kiosque(s) alerté(s)`,
        );
        return result;
      },
      { connection },
    );
  } catch (workerError) {
    await queue.close();
    throw workerError;
  }

  return {
    close: async (): Promise<void> => {
      try {
        await worker.close();
      } finally {
        await queue.close();
      }
    },
  };
}
