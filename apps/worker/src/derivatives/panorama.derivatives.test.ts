import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { generateFlatDerivatives } from './panorama.derivatives.js';

describe('generateFlatDerivatives', () => {
  it('should generate preview, web, and thumb derivatives from a valid panorama', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 4096,
        height: 2048,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await generateFlatDerivatives(inputBuffer);

    expect(result.width).toBe(4096);
    expect(result.height).toBe(2048);

    const previewMeta = await sharp(result.preview).metadata();
    expect(previewMeta.width).toBe(512);
    expect(previewMeta.height).toBe(256);
    expect(previewMeta.format).toBe('jpeg');

    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.width).toBe(4096);
    expect(webMeta.height).toBe(2048);
    expect(webMeta.format).toBe('jpeg');

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBe(400);
    expect(thumbMeta.height).toBe(225);
    expect(thumbMeta.format).toBe('jpeg');
  });

  it('should reject with an error when buffer is invalid', async () => {
    const invalidBuffer = Buffer.from('not an image');
    await expect(generateFlatDerivatives(invalidBuffer)).rejects.toThrow();
  });
});
