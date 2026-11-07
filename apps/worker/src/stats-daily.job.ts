import { Queue, Worker } from 'bullmq';
import {
  STATS_DAILY_INTERVAL_MS,
  STATS_DAILY_JOB_ID,
  STATS_DAILY_QUEUE_NAME,
} from '@xplor/shared';
import {
  aggregateEventsForDay,
  getDayUtcRange,
  getYesterdayAndTodayUtc,
} from './stats-daily-aggregation.js';
import type { StatsDailyRepository } from './stats-daily-repository.js';

export {
  STATS_DAILY_INTERVAL_MS,
  STATS_DAILY_JOB_ID,
  STATS_DAILY_QUEUE_NAME,
};

export interface StatsDailyJobDaySummary {
  day: string;
  bucketsCount: number;
}

export interface StatsDailyJobResult {
  yesterday: StatsDailyJobDaySummary;
  today: StatsDailyJobDaySummary;
}

export interface RecalculateStatsDailyDeps {
  repo: StatsDailyRepository;
  log?: (message: string) => void;
}

export const MAX_STATS_DAILY_RANGE_DAYS = 92;

/**
 * Recalcule les agrégats StatsDaily pour chaque jour UTC de from à to inclus.
 * Parcourt chaque jour UTC (getDayUtcRange → findEventsForDay → aggregateEventsForDay → replaceStatsForDay),
 * journalise une ligne par jour via deps.log et refuse (throw) si from > to ou si la période dépasse 92 jours.
 */
export async function recalculateStatsDailyRange(
  deps: RecalculateStatsDailyDeps,
  from: Date,
  to: Date,
): Promise<StatsDailyJobDaySummary[]> {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Les dates fournies sont invalides');
  }

  if (from.getTime() > to.getTime()) {
    throw new Error(
      'La date de début (from) doit être antérieure ou égale à la date de fin (to)',
    );
  }

  const startDay = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const endDay = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()),
  );

  const MS_PER_DAY = 86_400_000;
  const dayCount =
    Math.round((endDay.getTime() - startDay.getTime()) / MS_PER_DAY) + 1;

  if (dayCount > MAX_STATS_DAILY_RANGE_DAYS) {
    throw new Error(
      `La période demandée (${String(dayCount)} jours) dépasse la limite maximale de ${String(MAX_STATS_DAILY_RANGE_DAYS)} jours`,
    );
  }

  const summaries: StatsDailyJobDaySummary[] = [];
  const current = new Date(startDay.getTime());

  while (current.getTime() <= endDay.getTime()) {
    const { dayStart, dayEnd } = getDayUtcRange(current);
    const events = await deps.repo.findEventsForDay(dayStart, dayEnd);
    const aggregates = aggregateEventsForDay(events, current);
    await deps.repo.replaceStatsForDay(dayStart, aggregates);

    const dayStr = dayStart.toISOString().slice(0, 10);
    summaries.push({
      day: dayStr,
      bucketsCount: aggregates.length,
    });

    if (deps.log !== undefined) {
      deps.log(
        `Agrégation StatsDaily (${dayStr}) : ${String(aggregates.length)} compartiment(s)`,
      );
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return summaries;
}

/**
 * Recalcule les agrégats StatsDaily d'hier et d'aujourd'hui depuis la table Event.
 * Ne modifie jamais les événements bruts (lecture seule sur Event).
 * Remplace les agrégats de façon idempotente par jour en s'appuyant sur recalculateStatsDailyRange.
 */
export async function recalculateStatsDaily(
  deps: RecalculateStatsDailyDeps,
  now: Date = new Date(),
): Promise<StatsDailyJobResult> {
  const { yesterday, today } = getYesterdayAndTodayUtc(now);
  const summaries = await recalculateStatsDailyRange(
    { repo: deps.repo },
    yesterday,
    today,
  );

  const yesterdaySummary = summaries[0] ?? {
    day: yesterday.toISOString().slice(0, 10),
    bucketsCount: 0,
  };
  const todaySummary = summaries[1] ?? {
    day: today.toISOString().slice(0, 10),
    bucketsCount: 0,
  };

  const result: StatsDailyJobResult = {
    yesterday: yesterdaySummary,
    today: todaySummary,
  };

  if (deps.log !== undefined) {
    deps.log(
      `Agrégation StatsDaily : hier (${result.yesterday.day}) : ${String(result.yesterday.bucketsCount)} compartiment(s), aujourd'hui (${result.today.day}) : ${String(result.today.bucketsCount)} compartiment(s)`,
    );
  }

  return result;
}

export type StatsDailyRecalculateFn = () => Promise<StatsDailyJobResult>;
export type StatsDailyLogFn = (message: string) => void;
export type StatsDailyJobProcessor = (
  job: unknown,
) => Promise<StatsDailyJobResult>;

export interface StatsDailyQueueLike {
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

export interface StatsDailyWorkerLike {
  close(): Promise<void>;
}

export type StatsDailyQueueFactory = (
  queueName: string,
  options: { connection: { url: string } },
) => StatsDailyQueueLike;

export type StatsDailyWorkerFactory = (
  queueName: string,
  processor: StatsDailyJobProcessor,
  options: { connection: { url: string } },
) => StatsDailyWorkerLike;

export type QueueFactory = StatsDailyQueueFactory;
export type WorkerFactory = StatsDailyWorkerFactory;

export interface StartStatsDailyJobOptions {
  redisUrl: string;
  recalculate: StatsDailyRecalculateFn;
  log: StatsDailyLogFn;
  createQueue?: StatsDailyQueueFactory;
  createWorker?: StatsDailyWorkerFactory;
}

export interface StatsDailyJobHandle {
  close(): Promise<void>;
}

export function defaultCreateStatsDailyQueue(
  queueName: string,
  options: { connection: { url: string } },
): StatsDailyQueueLike {
  return new Queue(queueName, options);
}

export function defaultCreateStatsDailyWorker(
  queueName: string,
  processor: StatsDailyJobProcessor,
  options: { connection: { url: string } },
): StatsDailyWorkerLike {
  return new Worker(
    queueName,
    async (job) => {
      return processor(job);
    },
    options,
  );
}

export const defaultCreateQueue = defaultCreateStatsDailyQueue;
export const defaultCreateWorker = defaultCreateStatsDailyWorker;

/**
 * Planifie le job BullMQ horaire d'agrégation StatsDaily (hier et aujourd'hui)
 * et démarre un Worker BullMQ pour traiter les exécutions.
 */
export async function startStatsDailyJob(
  opts: StartStatsDailyJobOptions,
): Promise<StatsDailyJobHandle> {
  const createQueue = opts.createQueue ?? defaultCreateStatsDailyQueue;
  const createWorker = opts.createWorker ?? defaultCreateStatsDailyWorker;
  const connection = { url: opts.redisUrl };

  const queue = createQueue(STATS_DAILY_QUEUE_NAME, { connection });

  try {
    if (typeof queue.upsertJobScheduler === 'function') {
      await queue.upsertJobScheduler(
        STATS_DAILY_JOB_ID,
        { every: STATS_DAILY_INTERVAL_MS },
        {
          name: STATS_DAILY_JOB_ID,
          data: {},
        },
      );
    } else if (typeof queue.add === 'function') {
      await queue.add(
        STATS_DAILY_JOB_ID,
        {},
        {
          jobId: STATS_DAILY_JOB_ID,
          repeat: { every: STATS_DAILY_INTERVAL_MS },
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

  let worker: StatsDailyWorkerLike;
  try {
    worker = createWorker(
      STATS_DAILY_QUEUE_NAME,
      async () => {
        const result = await opts.recalculate();
        opts.log(
          `Agrégation StatsDaily terminée : hier ${result.yesterday.day} (${String(result.yesterday.bucketsCount)} compartiments), aujourd'hui ${result.today.day} (${String(result.today.bucketsCount)} compartiments)`,
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
