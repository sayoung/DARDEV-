import sharp from 'sharp';
import { tileGrid, TILE_BASE_WIDTH, TILE_BASE_HEIGHT, TileRectangle } from './tile-grid.js';

export interface TileResult {
  col: number;
  row: number;
  data: Buffer;
}

export async function generateTiles(input: Buffer): Promise<Array<TileResult>> {
  // 1. Resize input to 8192x4096 (fit 'fill') into a raw buffer to avoid re-decoding for each tile
  const baseImage = sharp(input)
    .resize(TILE_BASE_WIDTH, TILE_BASE_HEIGHT, { fit: 'fill' });
  
  const { data, info } = await baseImage.raw().toBuffer({ resolveWithObject: true });

  const grid = tileGrid();
  const results: Array<TileResult> = [];
  const BATCH_SIZE = 8;

  for (let i = 0; i < grid.length; i += BATCH_SIZE) {
    const batch = grid.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (rect: TileRectangle) => {
      const tileBuffer = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels,
        }
      })
      .extract({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      })
      .jpeg({ quality: 82 })
      .toBuffer();

      return {
        col: rect.col,
        row: rect.row,
        data: tileBuffer,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
