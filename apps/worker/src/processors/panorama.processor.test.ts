import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { processPanoramaJob, PanoramaProcessorDeps, WorkerStorage } from './panorama.processor.js';
import { PanoramaJobData } from '@xplor/shared';
import { AssetRepository } from '../asset-repository.js';

interface MockedRepo extends AssetRepository {
  findForProcessing: Mock<AssetRepository['findForProcessing']>;
  markReady: Mock<AssetRepository['markReady']>;
  markError: Mock<AssetRepository['markError']>;
}

interface MockedStorage extends WorkerStorage {
  getObject: Mock<WorkerStorage['getObject']>;
  putObject: Mock<WorkerStorage['putObject']>;
}

describe('processPanoramaJob', () => {
  let mockRepo: MockedRepo;
  let mockStorage: MockedStorage;
  let deps: PanoramaProcessorDeps;

  beforeEach(() => {
    const repoFindForProcessing = vi.fn<AssetRepository['findForProcessing']>();
    const repoMarkReady = vi.fn<AssetRepository['markReady']>();
    const repoMarkError = vi.fn<AssetRepository['markError']>();
    
    mockRepo = {
      findForProcessing: repoFindForProcessing,
      markReady: repoMarkReady,
      markError: repoMarkError,
    };
    
    const storageGetObject = vi.fn<WorkerStorage['getObject']>();
    const storagePutObject = vi.fn<WorkerStorage['putObject']>();

    mockStorage = {
      getObject: storageGetObject,
      putObject: storagePutObject,
    };

    deps = {
      repo: mockRepo,
      storage: mockStorage,
      generateFlat: vi.fn(),
      generateTiles: vi.fn(),
    };
  });


  it('écrit les 3 dérivés et les 128 tuiles puis appelle markReady', async () => {
    const data: PanoramaJobData = { assetId: '123e4567-e89b-12d3-a456-426614174000' };
    
    mockRepo.findForProcessing.mockResolvedValue({
      id: data.assetId,
      kind: 'PANORAMA',
      originalKey: 'uploads/123.jpg',
      processingStatus: 'PENDING',
      derivatives: null,
    });
    
    const originalBuffer = Buffer.from('fake-image');
    mockStorage.getObject.mockResolvedValue(originalBuffer);
    
    const fakePreview = Buffer.from('preview');
    const fakeWeb = Buffer.from('web');
    const fakeThumb = Buffer.from('thumb');
    deps.generateFlat = vi.fn().mockResolvedValue({
      preview: fakePreview,
      web: fakeWeb,
      thumb: fakeThumb,
      width: 8192,
      height: 4096,
    });
    
    const fakeTiles = Array.from({ length: 128 }, (_, i) => ({
      col: i % 16,
      row: Math.floor(i / 16),
      data: Buffer.from(`tile-${String(i)}`),
    }));
    deps.generateTiles = vi.fn().mockResolvedValue(fakeTiles);
    
    await processPanoramaJob(data, deps);
    
    expect(mockRepo.findForProcessing).toHaveBeenCalledWith(data.assetId);
    expect(mockStorage.getObject).toHaveBeenCalledWith('uploads/123.jpg');
    
    // Le sha256Hex de 'fake-image' est 'a8eb701c6f567b08661c2604364dd595455b811d2759d2029b465935b561c86b'
    const expectedHash = 'a8eb701c6f567b08661c2604364dd595455b811d2759d2029b465935b561c86b';
    
    expect(mockStorage.putObject).toHaveBeenCalledWith(`panoramas/${data.assetId}/${expectedHash}/preview.jpg`, fakePreview, 'image/jpeg');
    expect(mockStorage.putObject).toHaveBeenCalledWith(`panoramas/${data.assetId}/${expectedHash}/web.jpg`, fakeWeb, 'image/jpeg');
    expect(mockStorage.putObject).toHaveBeenCalledWith(`panoramas/${data.assetId}/${expectedHash}/thumb.jpg`, fakeThumb, 'image/jpeg');
    
    expect(mockStorage.putObject).toHaveBeenCalledTimes(3 + 128);
    
    expect(mockRepo.markReady).toHaveBeenCalledWith(data.assetId, expectedHash, {
      preview: `panoramas/${data.assetId}/${expectedHash}/preview.jpg`,
      web: `panoramas/${data.assetId}/${expectedHash}/web.jpg`,
      thumb: `panoramas/${data.assetId}/${expectedHash}/thumb.jpg`,
      tilesPrefix: `panoramas/${data.assetId}/${expectedHash}/tiles/`,
      tileGrid: {
        cols: 16,
        rows: 8,
        size: 512,
      },
    });
  });

  it('lève une erreur si l\'asset est absent sans rien écrire', async () => {
    const data: PanoramaJobData = { assetId: '123e4567-e89b-12d3-a456-426614174000' };
    mockRepo.findForProcessing.mockResolvedValue(null);
    
    await expect(processPanoramaJob(data, deps)).rejects.toThrow('Asset 123e4567-e89b-12d3-a456-426614174000 introuvable.');
    
    expect(mockStorage.getObject).not.toHaveBeenCalled();
    expect(mockStorage.putObject).not.toHaveBeenCalled();
    expect(mockRepo.markReady).not.toHaveBeenCalled();
  });

  it('lève une erreur si le kind n\'est pas PANORAMA', async () => {
    const data: PanoramaJobData = { assetId: '123e4567-e89b-12d3-a456-426614174000' };
    mockRepo.findForProcessing.mockResolvedValue({
      id: data.assetId,
      kind: 'VIDEO',
      originalKey: 'uploads/vid.mp4',
      processingStatus: 'PENDING',
      derivatives: null,
    });
    
    await expect(processPanoramaJob(data, deps)).rejects.toThrow('n\'est pas un PANORAMA');
    
    expect(mockStorage.getObject).not.toHaveBeenCalled();
  });

  it('remonte l\'erreur de generateFlat sans appeler markReady', async () => {
    const data: PanoramaJobData = { assetId: '123e4567-e89b-12d3-a456-426614174000' };
    mockRepo.findForProcessing.mockResolvedValue({
      id: data.assetId,
      kind: 'PANORAMA',
      originalKey: 'uploads/123.jpg',
      processingStatus: 'PENDING',
      derivatives: null,
    });
    mockStorage.getObject.mockResolvedValue(Buffer.from('bad-image'));
    deps.generateFlat = vi.fn().mockRejectedValue(new Error('Erreur de sharp'));
    
    await expect(processPanoramaJob(data, deps)).rejects.toThrow('Erreur de sharp');
    
    expect(mockStorage.putObject).not.toHaveBeenCalled();
    expect(mockRepo.markReady).not.toHaveBeenCalled();
  });
});
