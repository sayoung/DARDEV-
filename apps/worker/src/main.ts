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
}

const defaultFactories: BootFactories = {
  createPrisma: () => new PrismaClient(),
  startWorker: startPanoramaWorker,
};

export async function boot(
  source: Record<string, string | undefined>,
  log: (message: string) => void,
  factories: BootFactories = defaultFactories,
): Promise<() => Promise<void>> {
  const env = loadEnv(source);

  const s3Client = createS3Client(env);
  const storage = new S3WorkerStorage(s3Client, env.S3_BUCKET);

  const prisma = factories.createPrisma();

  try {
    const repo = new PrismaAssetRepository(prisma);

    const worker = factories.startWorker({
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

    return async () => {
      await worker.close();
      await prisma.$disconnect();
    };
  } catch (error) {
    await prisma.$disconnect();
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
