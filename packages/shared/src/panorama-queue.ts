import { z } from 'zod';

export const PANORAMA_QUEUE_NAME = 'panorama';
export const PANORAMA_JOB_ATTEMPTS = 3;
export const PANORAMA_JOB_BACKOFF_MS = 5000;
export const PANORAMA_WORKER_CONCURRENCY = 2;

export const PanoramaJobDataSchema = z.object({
  assetId: z.uuid(),
});

export type PanoramaJobData = z.infer<typeof PanoramaJobDataSchema>;

export function panoramaDerivativeKeys(assetId: string, contentHash: string) {
  const base = `panoramas/${assetId}/${contentHash}`;
  return {
    preview: `${base}/preview.jpg`,
    web: `${base}/web.jpg`,
    thumb: `${base}/thumb.jpg`,
    tilesPrefix: `${base}/tiles/`,
  };
}

export function panoramaTileKey(tilesPrefix: string, col: number, row: number) {
  return `${tilesPrefix}${col.toString()}_${row.toString()}.jpg`;
}
export const PANORAMA_GRID = { cols: 16, rows: 8, size: 512 };
