import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { ProcessingStatus, AssetKind, AssetResponse } from '@xplor/shared';
import { needsPolling, waitUntilAssetReady } from './media-polling.js';
import * as catalogApi from '../api/catalog.js';

vi.mock('../api/catalog.js', () => ({
  getAsset: vi.fn(),
}));

describe('needsPolling', () => {
  const createAsset = (status: ProcessingStatus): AssetResponse => ({
    id: 'asset-1',
    filename: 'mock.jpg',
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

describe('waitUntilAssetReady', () => {
  const createAsset = (status: ProcessingStatus): AssetResponse => ({
    id: 'asset-1',
    filename: 'mock.jpg',
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('READY après 2 tentatives', async () => {
    const getAssetMock = vi.mocked(catalogApi.getAsset);
    getAssetMock
      .mockResolvedValueOnce(createAsset(ProcessingStatus.PROCESSING))
      .mockResolvedValueOnce(createAsset(ProcessingStatus.READY));

    const promise = waitUntilAssetReady('asset-1', { intervalMs: 1000 });
    
    // Fast-forward first timer
    await vi.runOnlyPendingTimersAsync();
    
    const result = await promise;
    expect(result.processingStatus).toBe(ProcessingStatus.READY);
    expect(getAssetMock).toHaveBeenCalledTimes(2);
  });

  it('ERROR rejette immédiatement', async () => {
    const getAssetMock = vi.mocked(catalogApi.getAsset);
    getAssetMock.mockResolvedValueOnce(createAsset(ProcessingStatus.ERROR));

    await expect(waitUntilAssetReady('asset-1')).rejects.toThrow('Asset processing failed');
    expect(getAssetMock).toHaveBeenCalledTimes(1);
  });

  it('timeout avec fake timers', async () => {
    const getAssetMock = vi.mocked(catalogApi.getAsset);
    getAssetMock.mockResolvedValue(createAsset(ProcessingStatus.PROCESSING));

    const promise = waitUntilAssetReady('asset-1', { intervalMs: 1000, maxAttempts: 3 });
    const assertion = expect(promise).rejects.toThrow('Timeout');

    // We need 3 attempts, so 2 intervals to wait
    await vi.runOnlyPendingTimersAsync();
    await vi.runOnlyPendingTimersAsync();
    
    await assertion;
    expect(getAssetMock).toHaveBeenCalledTimes(3);
  });
  
  it('abandon via AbortSignal pendant l\'attente', async () => {
    const getAssetMock = vi.mocked(catalogApi.getAsset);
    getAssetMock.mockResolvedValue(createAsset(ProcessingStatus.PROCESSING));

    const controller = new AbortController();
    const promise = waitUntilAssetReady('asset-1', { intervalMs: 1000, signal: controller.signal });
    const assertion = expect(promise).rejects.toThrow('Aborted');

    // Laissons l'exécution atteindre la promesse d'attente (setTimeout)
    await Promise.resolve();
    await Promise.resolve();

    // Déclenche l'abandon
    controller.abort();
    
    await assertion;
    expect(getAssetMock).toHaveBeenCalledTimes(1);
  });
});
