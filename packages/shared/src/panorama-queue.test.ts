import { describe, expect, it } from 'vitest';
import {
  PanoramaJobDataSchema,
  panoramaDerivativeKeys,
  panoramaTileKey,
} from './panorama-queue.js';

describe('panorama-queue', () => {
  describe('PanoramaJobDataSchema', () => {
    it('should validate a valid uuid', () => {
      const result = PanoramaJobDataSchema.safeParse({
        assetId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assetId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should reject an invalid uuid', () => {
      const result = PanoramaJobDataSchema.safeParse({
        assetId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('panoramaDerivativeKeys', () => {
    it('should return exact keys for given assetId and hash', () => {
      const assetId = 'asset-123';
      const hash = 'hash-abc';
      const expected = {
        preview: 'panoramas/asset-123/hash-abc/preview.jpg',
        web: 'panoramas/asset-123/hash-abc/web.jpg',
        thumb: 'panoramas/asset-123/hash-abc/thumb.jpg',
        tilesPrefix: 'panoramas/asset-123/hash-abc/tiles/',
      };
      expect(panoramaDerivativeKeys(assetId, hash)).toEqual(expected);
    });
  });

  describe('panoramaTileKey', () => {
    it('should return tile key for 15_7', () => {
      expect(panoramaTileKey('prefix/tiles/', 15, 7)).toBe('prefix/tiles/15_7.jpg');
    });
  });
});
