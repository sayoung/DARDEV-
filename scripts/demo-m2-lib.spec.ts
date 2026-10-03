import { describe, it, expect } from 'vitest';
import { ProcessingStatus } from '@xplor/shared';
import { listPanoramaFiles, isUnexpected, summarize } from './demo-m2-lib';

describe('demo-m2-lib', () => {
  describe('listPanoramaFiles', () => {
    it('filters jpg/jpeg, sorts, and detects invalide_', () => {
      const names = [
        'invalide_size.png', // Should be excluded
        'test.jpg',
        'invalide_ratio.JPG',
        'apple.jpeg',
      ];
      const result = listPanoramaFiles(names);
      expect(result).toEqual([
        { file: 'apple.jpeg', expectInvalid: false },
        { file: 'invalide_ratio.JPG', expectInvalid: true },
        { file: 'test.jpg', expectInvalid: false },
      ]);
    });
  });

  describe('isUnexpected', () => {
    it('returns false for valid READY', () => {
      expect(isUnexpected({ expectInvalid: false, status: ProcessingStatus.READY })).toBe(false);
    });

    it('returns true for valid ERROR', () => {
      expect(isUnexpected({ expectInvalid: false, status: ProcessingStatus.ERROR })).toBe(true);
    });

    it('returns true for valid TIMEOUT', () => {
      expect(isUnexpected({ expectInvalid: false, status: 'TIMEOUT' })).toBe(true);
    });

    it('returns true for invalide_ READY', () => {
      expect(isUnexpected({ expectInvalid: true, status: ProcessingStatus.READY })).toBe(true);
    });

    it('returns false for invalide_ ERROR (expected)', () => {
      expect(isUnexpected({ expectInvalid: true, status: ProcessingStatus.ERROR })).toBe(false);
    });
  });

  describe('summarize', () => {
    it('produces table lines and exitCode 0 if no unexpected', () => {
      const results = [
        {
          file: 'valid.jpg',
          dimensions: { width: 4000, height: 2000 },
          status: ProcessingStatus.READY,
          durationSeconds: 5,
          expectInvalid: false,
        },
        {
          file: 'invalide_test.jpg',
          status: ProcessingStatus.ERROR,
          expectInvalid: true,
          raison: 'Image trop petite',
        },
      ];
      const summary = summarize(results);
      expect(summary.exitCode).toBe(0);
      expect(summary.lines).toEqual([
        '| valid.jpg | 4000x2000 | READY | 5s | - |',
        '| invalide_test.jpg | - | ERROR | - | Image trop petite |',
      ]);
    });

    it('produces exitCode 1 if at least one unexpected', () => {
      const results = [
        {
          file: 'valid.jpg',
          status: ProcessingStatus.ERROR,
          expectInvalid: false,
          raison: 'Erreur inattendue',
        },
      ];
      const summary = summarize(results);
      expect(summary.exitCode).toBe(1);
      expect(summary.lines).toEqual([
        '| valid.jpg | - | ERROR | - | Erreur inattendue |',
      ]);
    });
  });
});
