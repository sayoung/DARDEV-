import { PanoramaJobDataSchema, PanoramaJobData, panoramaDerivativeKeys, panoramaTileKey } from '@xplor/shared';
import { AssetRepository } from '../asset-repository.js';
import { sha256Hex } from '../derivatives/content-hash.js';
import { FlatDerivatives } from '../derivatives/panorama.derivatives.js';
import { TileResult } from '../derivatives/panorama.tiles.js';

export interface WorkerStorage {
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
}

export interface PanoramaProcessorDeps {
  repo: AssetRepository;
  storage: Pick<WorkerStorage, 'getObject' | 'putObject'>;
  generateFlat: (input: Buffer) => Promise<FlatDerivatives>;
  generateTiles: (input: Buffer) => Promise<Array<TileResult>>;
}

export async function processPanoramaJob(data: PanoramaJobData, deps: PanoramaProcessorDeps): Promise<void> {
  const parsed = PanoramaJobDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Données du job invalides.");
  }
  const { assetId } = parsed.data;

  const asset = await deps.repo.findForProcessing(assetId);
  if (!asset) {
    throw new Error(`Asset ${assetId} introuvable.`);
  }

  if (asset.kind !== 'PANORAMA') {
    throw new Error(`L'asset ${assetId} n'est pas un PANORAMA (trouvé: ${asset.kind}).`);
  }

  const originalBuffer = await deps.storage.getObject(asset.originalKey);
  const contentHash = sha256Hex(originalBuffer);

  const flatDerivatives = await deps.generateFlat(originalBuffer);
  const tiles = await deps.generateTiles(originalBuffer);

  const keys = panoramaDerivativeKeys(assetId, contentHash);

  await deps.storage.putObject(keys.preview, flatDerivatives.preview, 'image/jpeg');
  await deps.storage.putObject(keys.web, flatDerivatives.web, 'image/jpeg');
  await deps.storage.putObject(keys.thumb, flatDerivatives.thumb, 'image/jpeg');

  const tilePromises = tiles.map(tile => {
    const tileKey = panoramaTileKey(keys.tilesPrefix, tile.col, tile.row);
    return deps.storage.putObject(tileKey, tile.data, 'image/jpeg');
  });

  await Promise.all(tilePromises);

  await deps.repo.markReady(assetId, contentHash, {
    preview: keys.preview,
    web: keys.web,
    thumb: keys.thumb,
    tilesPrefix: keys.tilesPrefix,
    tileGrid: {
      cols: 16,
      rows: 8,
      size: 512,
    }
  });
}
