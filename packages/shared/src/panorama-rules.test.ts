import { describe, it, expect } from 'vitest';
import {
  validatePanoramaUpload,
  PanoramaUploadIssueCode,
} from './panorama-rules.js';

describe('validatePanoramaUpload', () => {
  it('devrait accepter un JPEG 8000x4000 de 20 Mo valide', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 20 * 1024 * 1024,
      width: 8000,
      height: 4000,
    });
    expect(issues).toHaveLength(0);
  });

  it('devrait accepter un panorama valide à la limite (4096x2048)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 10 * 1024 * 1024,
      width: 4096,
      height: 2048,
    });
    expect(issues).toHaveLength(0);
  });

  it('devrait refuser un panorama de dimensions insuffisantes (4000x2000)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 10 * 1024 * 1024,
      width: 4000,
      height: 2000,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(PanoramaUploadIssueCode.INVALID_DIMENSIONS);
  });

  it('devrait refuser un panorama avec un ratio incorrect (8000x4100)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 20 * 1024 * 1024,
      width: 8000,
      height: 4100,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(PanoramaUploadIssueCode.INVALID_RATIO);
  });

  it('devrait accepter un panorama dont le ratio est dans la tolérance (8000x4040)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 20 * 1024 * 1024,
      width: 8000,
      height: 4040,
    });
    expect(issues).toHaveLength(0);
  });

  it('devrait refuser une image non JPEG (ex: image/png)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/png',
      sizeBytes: 20 * 1024 * 1024,
      width: 8000,
      height: 4000,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(PanoramaUploadIssueCode.INVALID_FORMAT);
  });

  it('devrait refuser un fichier trop lourd (81 Mo)', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/jpeg',
      sizeBytes: 81 * 1024 * 1024,
      width: 8000,
      height: 4000,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe(PanoramaUploadIssueCode.FILE_TOO_LARGE);
  });

  it('devrait retourner plusieurs issues si plusieurs règles sont violées', () => {
    const issues = validatePanoramaUpload({
      mimeType: 'image/png',
      sizeBytes: 81 * 1024 * 1024,
      width: 4000,
      height: 2100,
    });
    expect(issues).toHaveLength(4);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain(PanoramaUploadIssueCode.INVALID_FORMAT);
    expect(codes).toContain(PanoramaUploadIssueCode.FILE_TOO_LARGE);
    expect(codes).toContain(PanoramaUploadIssueCode.INVALID_DIMENSIONS);
    expect(codes).toContain(PanoramaUploadIssueCode.INVALID_RATIO);
  });
});
