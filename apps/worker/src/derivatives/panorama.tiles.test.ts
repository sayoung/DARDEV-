import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { generateTiles, TileResult } from './panorama.tiles.js';

describe('generateTiles', () => {
  it('should generate 128 tiles from a 4096x2048 image with specific constraints for tile 15,7', async () => {
    // Generate a 4096x2048 JPEG in memory
    const inputImage = await sharp({
      create: {
        width: 4096,
        height: 2048,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toBuffer();

    const tiles = await generateTiles(inputImage);

    // Assert: 128 tiles (16 cols * 8 rows = 128)
    expect(tiles).toHaveLength(128);

    // Assert: tile (15,7) is 512x512 and format jpeg
    const lastTile = tiles.find((t: TileResult) => t.col === 15 && t.row === 7);
    expect(lastTile).toBeDefined();
    
    if (lastTile) {
      const metadata = await sharp(lastTile.data).metadata();
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(512);
      expect(metadata.format).toBe('jpeg');
    }
  }, 30000); // 30s timeout

  it('should reject when input is invalid', async () => {
    const invalidInput = Buffer.from('not an image');
    await expect(generateTiles(invalidInput)).rejects.toThrow();
  });
});
