import { describe, it, expect } from 'vitest';
import { ProcessingStatus, AssetKind, AssetResponse } from '@xplor/shared';
import { needsPolling } from './media-polling.js';

describe('needsPolling', () => {
  const createAsset = (status: ProcessingStatus): AssetResponse => ({
    id: 'asset-1',
    createdAt: new Date().toISOString(),
    kind: AssetKind.PANORAMA,
    sizeBytes: 1024,
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    processingStatus: status,
    processingLog: null,
    copyright: null,
    thumbnailUrl: null,
    derivatives: {},
    panorama: null,
  });

  it('retourne false pour une liste vide', () => {
    expect(needsPolling([])).toBe(false);
  });

  it('retourne false si tous les items sont READY', () => {
    expect(needsPolling([createAsset(ProcessingStatus.READY), createAsset(ProcessingStatus.READY)])).toBe(false);
  });

  it('retourne true si au moins un item est PENDING', () => {
    expect(needsPolling([createAsset(ProcessingStatus.READY), createAsset(ProcessingStatus.PENDING)])).toBe(true);
  });

  it('retourne true si au moins un item est PROCESSING', () => {
    expect(needsPolling([createAsset(ProcessingStatus.PROCESSING), createAsset(ProcessingStatus.READY)])).toBe(true);
  });

  it('retourne false si les items sont ERROR ou READY', () => {
    expect(needsPolling([createAsset(ProcessingStatus.ERROR), createAsset(ProcessingStatus.READY)])).toBe(false);
  });
});
