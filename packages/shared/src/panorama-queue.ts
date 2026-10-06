import { z } from 'zod';

export const PANORAMA_QUEUE_NAME = 'panorama';
export const PANORAMA_JOB_ATTEMPTS = 3;
export const PANORAMA_JOB_BACKOFF_MS = 5000;
export const PANORAMA_WORKER_CONCURRENCY = 2;

export const PanoramaDerivativesSchema = z.object({
  preview: z.string(),
  web: z.string(),
  thumb: z.string(),
  tilesPrefix: z.string(),
  tileGrid: z.object({
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
    size: z.number().int().positive(),
  }),
});
export type PanoramaDerivatives = z.infer<typeof PanoramaDerivativesSchema>;

export const PanoramaJobDataSchema = z.object({
  assetId: z.uuid(),
});

export type PanoramaJobData = z.infer<typeof PanoramaJobDataSchema>;

export function panoramaAssetPrefix(assetId: string) {
  return `panoramas/${assetId}/`;
}

export function panoramaDerivativeKeys(assetId: string, contentHash: string) {
  const base = `${panoramaAssetPrefix(assetId)}${contentHash}`;
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
