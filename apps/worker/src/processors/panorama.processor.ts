import { Worker, type Job, type WorkerOptions } from 'bullmq';
import { AssetKind, Prisma, ProcessingStatus } from '@prisma/client';

import {
  panoramaDerivativeRecord,
  renderPanoramaDerivatives,
  tileObjectKey,
  TILE_COLS,
  TILE_ROWS,
} from '../derivatives/panorama.derivatives.js';
import { getPrisma } from '../prisma.js';
import {
  PANORAMA_CONCURRENCY,
  PANORAMA_QUEUE_NAME,
  panoramaConnection,
  type PanoramaJobData,
} from '../queues/panorama.queue.js';
import type { StorageService } from '../storage/storage.service.js';

export async function processPanoramaJob(
  job: Job<PanoramaJobData>,
  storage: StorageService,
): Promise<void> {
  const { assetId } = job.data;
  const initialYaw = job.data.initialYaw ?? 0;
  const asset = await getPrisma().asset.findUnique({ where: { id: assetId } });
  if (asset === null) {
    throw new Error(`Média introuvable : ${assetId}`);
  }

  try {
    if (asset.kind !== AssetKind.PANORAMA) {
      throw new Error(`Le média ${assetId} n'est pas un panorama.`);
    }
    if (!Number.isFinite(initialYaw)) {
      throw new Error("La vue initiale (initialYaw) n'est pas un nombre.");
    }
    const original = await storage.download(asset.originalKey);
    const rendered = await renderPanoramaDerivatives(original, initialYaw);
    if (rendered.tiles.length !== TILE_COLS * TILE_ROWS) {
      throw new Error(
        `Grille de tuiles incomplète : ${String(rendered.tiles.length)} au lieu de ${String(TILE_COLS * TILE_ROWS)}.`,
      );
    }
    const record = panoramaDerivativeRecord(assetId, asset.contentHash);
    const derivatives: Prisma.InputJsonObject = {
      preview: record.preview,
      web: record.web,
      thumb: record.thumb,
      tiles: {
        width: record.tiles.width,
        cols: record.tiles.cols,
        rows: record.tiles.rows,
        baseUrl: record.tiles.baseUrl,
      },
    };
    await storage.upload(record.preview, rendered.preview, 'image/jpeg');
    await storage.upload(record.web, rendered.web, 'image/jpeg');
    await storage.upload(record.thumb, rendered.thumb, 'image/jpeg');
    for (let row = 0; row < TILE_ROWS; row += 1) {
      for (let col = 0; col < TILE_COLS; col += 1) {
        const tile = rendered.tiles[row * TILE_COLS + col];
        if (tile === undefined) {
          throw new Error(`Tuile manquante ${String(col)}_${String(row)}.`);
        }
        await storage.upload(tileObjectKey(assetId, asset.contentHash, col, row), tile, 'image/jpeg');
      }
    }
    await getPrisma().asset.update({
      where: { id: assetId },
      data: {
        processingStatus: ProcessingStatus.READY,
        processingLog: null,
        derivatives,
      },
    });
  } catch (error: unknown) {
    const message = readableError(error);
    try {
      await getPrisma().asset.update({
        where: { id: assetId },
        data: {
          processingStatus: ProcessingStatus.ERROR,
          processingLog: message,
        },
      });
    } catch (updateError: unknown) {
      const updateMessage = readableError(updateError);
      throw new Error(`${message} (journal non enregistré : ${updateMessage})`, { cause: error });
    }
    throw error;
  }
}

export function panoramaWorkerOptions(redisUrl: string): WorkerOptions {
  return {
    connection: panoramaConnection(redisUrl),
    concurrency: PANORAMA_CONCURRENCY,
  };
}

/** Démarre le processeur avec une concurrence de 2 (F-11). */
export function createPanoramaWorker(
  redisUrl: string,
  storage: StorageService,
  prefix?: string,
): Worker<PanoramaJobData> {
  return new Worker<PanoramaJobData>(
    PANORAMA_QUEUE_NAME,
    (job: Job<PanoramaJobData>) => processPanoramaJob(job, storage),
    {
      ...panoramaWorkerOptions(redisUrl),
      ...(prefix === undefined ? {} : { prefix }),
    },
  );
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Erreur inconnue pendant le traitement du panorama.';
}
