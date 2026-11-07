import { describe, expect, it, vi } from 'vitest';
import {
  HOTEL_MONTHLY_REPORT_CRON_PATTERN,
  HOTEL_MONTHLY_REPORT_JOB_ID,
  HOTEL_MONTHLY_REPORT_QUEUE_NAME,
  startHotelMonthlyReportJob,
  type HotelMonthlyReportJobProcessor,
  type HotelMonthlyReportQueueLike,
  type HotelMonthlyReportWorkerLike,
} from './hotel-monthly-report.job.js';
import type { MonthlyReportsResult } from './hotel-monthly-report.service.js';

describe('hotel-monthly-report.job (F-83)', () => {
  const sampleResult: MonthlyReportsResult = {
    period: {
      from: '2026-10-01',
      to: '2026-10-31',
      label: 'octobre 2026',
    },
    totalHotels: 2,
    sentCount: 2,
    failedCount: 0,
    skippedCount: 0,
    details: [
      {
        hotelId: '01990000-0000-7000-8000-000000000001',
        hotelName: 'Hôtel A',
        status: 'SENT',
        recipients: ['a@hotel.local'],
      },
      {
        hotelId: '01990000-0000-7000-8000-000000000002',
        hotelName: 'Hôtel B',
        status: 'SENT',
        recipients: ['b@hotel.local'],
      },
    ],
  };

  it('planifie le job BullMQ récurrent via upsertJobScheduler avec le cron 0 6 1 * *', async () => {
    let capturedJobId = '';
    let capturedOpts: { pattern?: string } = {};
    const closeQueue = vi.fn().mockResolvedValue(undefined);
    const closeWorker = vi.fn().mockResolvedValue(undefined);
    const logs: string[] = [];

    let capturedProcessor: HotelMonthlyReportJobProcessor | undefined;

    const fakeQueue: HotelMonthlyReportQueueLike = {
      upsertJobScheduler: vi
        .fn()
        .mockImplementation(
          (jobId: string, repeatOpts: { pattern?: string }) => {
            capturedJobId = jobId;
            capturedOpts = repeatOpts;
            return Promise.resolve();
          },
        ),
      close: closeQueue,
    };

    const fakeWorker: HotelMonthlyReportWorkerLike = {
      close: closeWorker,
    };

    const sendReportsMock = vi.fn().mockResolvedValue(sampleResult);

    const handle = await startHotelMonthlyReportJob({
      redisUrl: 'redis://127.0.0.1:6379',
      sendReports: sendReportsMock,
      log: (msg: string) => {
        logs.push(msg);
      },
      createQueue: () => fakeQueue,
      createWorker: (
        name: string,
        processor: HotelMonthlyReportJobProcessor,
      ) => {
        expect(name).toBe(HOTEL_MONTHLY_REPORT_QUEUE_NAME);
        capturedProcessor = processor;
        return fakeWorker;
      },
    });

    expect(capturedJobId).toBe(HOTEL_MONTHLY_REPORT_JOB_ID);
    expect(capturedOpts.pattern).toBe(HOTEL_MONTHLY_REPORT_CRON_PATTERN);

    // Exécute le processeur
    if (capturedProcessor !== undefined) {
      const res = await capturedProcessor({});
      expect(res.sentCount).toBe(2);
      expect(sendReportsMock).toHaveBeenCalledTimes(1);
      expect(logs.some((l) => l.includes('2 envoyé(s)'))).toBe(true);
    }

    // Fermeture propre
    await handle.close();
    expect(closeWorker).toHaveBeenCalledTimes(1);
    expect(closeQueue).toHaveBeenCalledTimes(1);
  });

  it('se replie sur queue.add si upsertJobScheduler est absent', async () => {
    let capturedAddName = '';
    let capturedAddOpts: { repeat?: { pattern?: string } } | undefined;
    const closeQueue = vi.fn().mockResolvedValue(undefined);
    const closeWorker = vi.fn().mockResolvedValue(undefined);

    const fakeQueue: HotelMonthlyReportQueueLike = {
      add: vi.fn().mockImplementation((name: string, _data: unknown, opts?: { repeat?: { pattern?: string } }) => {
        capturedAddName = name;
        capturedAddOpts = opts;
        return Promise.resolve();
      }),
      close: closeQueue,
    };

    const fakeWorker: HotelMonthlyReportWorkerLike = {
      close: closeWorker,
    };

    const handle = await startHotelMonthlyReportJob({
      redisUrl: 'redis://127.0.0.1:6379',
      sendReports: vi.fn().mockResolvedValue(sampleResult),
      log: vi.fn(),
      createQueue: () => fakeQueue,
      createWorker: () => fakeWorker,
    });

    expect(capturedAddName).toBe(HOTEL_MONTHLY_REPORT_JOB_ID);
    expect(capturedAddOpts?.repeat?.pattern).toBe(HOTEL_MONTHLY_REPORT_CRON_PATTERN);

    await handle.close();
  });

  it('lève une erreur et ferme la file si ni upsertJobScheduler ni add n est disponible', async () => {
    const closeQueue = vi.fn().mockResolvedValue(undefined);
    const fakeQueue: HotelMonthlyReportQueueLike = {
      close: closeQueue,
    };

    await expect(
      startHotelMonthlyReportJob({
        redisUrl: 'redis://127.0.0.1:6379',
        sendReports: vi.fn(),
        log: vi.fn(),
        createQueue: () => fakeQueue,
        createWorker: () => ({ close: vi.fn() }),
      }),
    ).rejects.toThrow("La file d'attente ne supporte ni upsertJobScheduler ni add avec repeat");

    expect(closeQueue).toHaveBeenCalledTimes(1);
  });
});
