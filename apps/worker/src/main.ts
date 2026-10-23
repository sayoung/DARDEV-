import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PANORAMA_QUEUE_NAME, PANORAMA_WORKER_CONCURRENCY } from '@xplor/shared';

import { loadEnv } from './env.js';
import { createS3Client, S3WorkerStorage } from './storage.js';
import { PrismaAssetRepository } from './asset-repository.js';
import { startPanoramaWorker } from './panorama.worker.js';
import { generateFlatDerivatives } from './derivatives/panorama.derivatives.js';
import { generateTiles } from './derivatives/panorama.tiles.js';

import { createSmtpSender } from './smtp-sender.js';
import { createPrismaKioskOfflineStore } from './kiosk-offline-repository.js';
import {
  runKioskOfflineCheck,
  type KioskOfflineMailMessage,
} from './kiosk-offline-check.js';
import { startKioskOfflineJob } from './kiosk-offline.job.js';
import { PrismaStatsDailyRepository } from './stats-daily-repository.js';
import {
  recalculateStatsDaily,
  startStatsDailyJob,
} from './stats-daily.job.js';

function loadLocalEnvFile(): void {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
  if (!existsSync(path)) {
    return;
  }
  process.loadEnvFile(path);
}

export interface BootFactories {
  createPrisma: () => PrismaClient;
  startWorker: typeof startPanoramaWorker;
  startKioskOfflineJob: typeof startKioskOfflineJob;
  startStatsDailyJob: typeof startStatsDailyJob;
  createSmtpSender?: typeof createSmtpSender;
}

const defaultFactories: BootFactories = {
  createPrisma: () => new PrismaClient(),
  startWorker: startPanoramaWorker,
  startKioskOfflineJob,
  startStatsDailyJob,
};

export async function boot(
  source: Record<string, string | undefined>,
  log: (message: string) => void,
  factories: BootFactories = defaultFactories,
): Promise<() => Promise<void>> {
  const env = loadEnv(source);

  if (env.STORAGE_PROVIDER === 'local') {
    throw new Error('Le worker ne supporte pas STORAGE_PROVIDER=local. Utilisez s3 (pas de stockage disque partagé entre API et worker).');
  }

  const s3Client = createS3Client(env);
  const storage = new S3WorkerStorage(s3Client, env.S3_BUCKET);

  const senderFactory = factories.createSmtpSender ?? createSmtpSender;
  const smtpSender = senderFactory(env);

  const prisma = factories.createPrisma();

  let worker: { close(): Promise<void> } | undefined;
  let statsDailyJob: { close(): Promise<void> } | undefined;
  let kioskOfflineJob: { close(): Promise<void> } | undefined;

  try {
    const repo = new PrismaAssetRepository(prisma);

    worker = factories.startWorker({
      redisUrl: env.REDIS_URL,
      deps: {
        repo,
        storage,
        generateFlat: generateFlatDerivatives,
        generateTiles: generateTiles,
      },
      log,
    });

    log(`worker prêt (file ${PANORAMA_QUEUE_NAME}, concurrence ${String(PANORAMA_WORKER_CONCURRENCY)})`);

    const statsDailyRepo = new PrismaStatsDailyRepository(prisma);
    statsDailyJob = await factories.startStatsDailyJob({
      redisUrl: env.REDIS_URL,
      recalculate: () =>
        recalculateStatsDaily({
          repo: statsDailyRepo,
          log,
        }),
      log,
    });

    const store = createPrismaKioskOfflineStore(prisma);
    const sendMail = (mail: KioskOfflineMailMessage): Promise<void> =>
      smtpSender.sendMail(mail);

    kioskOfflineJob = await factories.startKioskOfflineJob({
      redisUrl: env.REDIS_URL,
      check: () => runKioskOfflineCheck({ ...store, sendMail }, new Date()),
      log,
    });

    const activeWorker = worker;
    const activeStatsDailyJob = statsDailyJob;
    const activeKioskJob = kioskOfflineJob;

    return async () => {
      try {
        await activeKioskJob.close();
      } finally {
        try {
          await activeStatsDailyJob.close();
        } finally {
          try {
            await activeWorker.close();
          } finally {
            try {
              smtpSender.close();
            } finally {
              await prisma.$disconnect();
            }
          }
        }
      }
    };
  } catch (error) {
    try {
      if (kioskOfflineJob !== undefined) {
        await kioskOfflineJob.close();
      }
    } finally {
      try {
        if (statsDailyJob !== undefined) {
          await statsDailyJob.close();
        }
      } finally {
        try {
          if (worker !== undefined) {
            await worker.close();
          }
        } finally {
          try {
            smtpSender.close();
          } finally {
            await prisma.$disconnect();
          }
        }
      }
    }
    throw error;
  }
}

if (process.env.VITEST !== 'true') {
  loadLocalEnvFile();
  boot(process.env, (message) => {
    console.log(message);
  }).then((shutdown) => {
    let shuttingDown = false;
    const handleSignal = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void shutdown().then(
        () => process.exit(0),
        () => process.exit(1)
      );
    };
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(message);
    process.exit(1);
  });
}
