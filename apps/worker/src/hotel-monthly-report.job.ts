import { Queue, Worker } from 'bullmq';
import {
  HOTEL_MONTHLY_REPORT_CRON_PATTERN,
  HOTEL_MONTHLY_REPORT_JOB_ID,
  HOTEL_MONTHLY_REPORT_QUEUE_NAME,
} from '@xplor/shared';
import type { MonthlyReportsResult } from './hotel-monthly-report.service.js';

export {
  HOTEL_MONTHLY_REPORT_CRON_PATTERN,
  HOTEL_MONTHLY_REPORT_JOB_ID,
  HOTEL_MONTHLY_REPORT_QUEUE_NAME,
};

export type HotelMonthlyReportSendFn = () => Promise<MonthlyReportsResult>;
export type HotelMonthlyReportLogFn = (message: string) => void;
export type HotelMonthlyReportJobProcessor = (
  job: unknown,
) => Promise<MonthlyReportsResult>;

export interface HotelMonthlyReportQueueLike {
  upsertJobScheduler?(
    jobSchedulerId: string,
    repeatOpts: { pattern?: string; every?: number },
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
      repeat?: { pattern?: string; every?: number };
    },
  ): Promise<unknown>;
  close(): Promise<void>;
}

export interface HotelMonthlyReportWorkerLike {
  close(): Promise<void>;
}

export type HotelMonthlyReportQueueFactory = (
  queueName: string,
  options: { connection: { url: string } },
) => HotelMonthlyReportQueueLike;

export type HotelMonthlyReportWorkerFactory = (
  queueName: string,
  processor: HotelMonthlyReportJobProcessor,
  options: { connection: { url: string } },
) => HotelMonthlyReportWorkerLike;

export interface StartHotelMonthlyReportJobOptions {
  redisUrl: string;
  sendReports: HotelMonthlyReportSendFn;
  log: HotelMonthlyReportLogFn;
  pattern?: string;
  createQueue?: HotelMonthlyReportQueueFactory;
  createWorker?: HotelMonthlyReportWorkerFactory;
}

export interface HotelMonthlyReportJobHandle {
  close(): Promise<void>;
}

export function defaultCreateHotelMonthlyReportQueue(
  queueName: string,
  options: { connection: { url: string } },
): HotelMonthlyReportQueueLike {
  return new Queue(queueName, options);
}

export function defaultCreateHotelMonthlyReportWorker(
  queueName: string,
  processor: HotelMonthlyReportJobProcessor,
  options: { connection: { url: string } },
): HotelMonthlyReportWorkerLike {
  return new Worker(
    queueName,
    async (job) => {
      return processor(job);
    },
    options,
  );
}

/**
 * Planifie le job BullMQ récurrent d'envoi des rapports mensuels le 1er du mois (F-83).
 * Démarre également un Worker BullMQ pour traiter les exécutions.
 */
export async function startHotelMonthlyReportJob(
  opts: StartHotelMonthlyReportJobOptions,
): Promise<HotelMonthlyReportJobHandle> {
  const createQueue = opts.createQueue ?? defaultCreateHotelMonthlyReportQueue;
  const createWorker = opts.createWorker ?? defaultCreateHotelMonthlyReportWorker;
  const connection = { url: opts.redisUrl };
  const pattern = opts.pattern ?? HOTEL_MONTHLY_REPORT_CRON_PATTERN;

  const queue = createQueue(HOTEL_MONTHLY_REPORT_QUEUE_NAME, { connection });

  try {
    if (typeof queue.upsertJobScheduler === 'function') {
      await queue.upsertJobScheduler(
        HOTEL_MONTHLY_REPORT_JOB_ID,
        { pattern },
        {
          name: HOTEL_MONTHLY_REPORT_JOB_ID,
          data: {},
        },
      );
    } else if (typeof queue.add === 'function') {
      await queue.add(
        HOTEL_MONTHLY_REPORT_JOB_ID,
        {},
        {
          jobId: HOTEL_MONTHLY_REPORT_JOB_ID,
          repeat: { pattern },
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

  let worker: HotelMonthlyReportWorkerLike;
  try {
    worker = createWorker(
      HOTEL_MONTHLY_REPORT_QUEUE_NAME,
      async () => {
        const result = await opts.sendReports();
        opts.log(
          `Rapports mensuels hôtels (${result.period.label}) : ${String(result.sentCount)} envoyé(s), ${String(result.failedCount)} échec(s), ${String(result.skippedCount)} ignoré(s)`,
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
