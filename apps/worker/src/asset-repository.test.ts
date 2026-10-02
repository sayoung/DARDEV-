import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAssetRepository } from './asset-repository.js';
import { PrismaClient, ProcessingStatus } from '@prisma/client';

vi.mock('@prisma/client', () => {
  const findUnique = vi.fn();
  const update = vi.fn();
  return {
    PrismaClient: class {
      asset = {
        findUnique,
        update,
      };
    },
    ProcessingStatus: {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      READY: 'READY',
      ERROR: 'ERROR',
    },
  };
});

describe('PrismaAssetRepository', () => {
  let prisma: PrismaClient;
  let repo: PrismaAssetRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = new PrismaClient();
    repo = new PrismaAssetRepository(prisma);
  });

  it('findForProcessing returns null if asset not found', async () => {
    const findUniqueSpy = vi.spyOn(prisma.asset, 'findUnique').mockResolvedValue(null);

    const result = await repo.findForProcessing('123');

    expect(result).toBeNull();
    expect(findUniqueSpy).toHaveBeenCalledWith({
      where: { id: '123' },
      select: {
        id: true,
        kind: true,
        originalKey: true,
        processingStatus: true,
        derivatives: true,
      },
    });
  });

  it('findForProcessing returns mapped asset if found', async () => {
    vi.spyOn(prisma.asset, 'findUnique').mockResolvedValue({
      id: '123',
      kind: 'PANORAMA',
      originalKey: 'raw/123.jpg',
      processingStatus: 'PENDING',
      derivatives: { foo: 'bar' },
      extraField: 'should-be-ignored',
    } as never);

    const result = await repo.findForProcessing('123');

    expect(result).toEqual({
      id: '123',
      kind: 'PANORAMA',
      originalKey: 'raw/123.jpg',
      processingStatus: 'PENDING',
      derivatives: { foo: 'bar' },
    });
  });

  it('markReady updates status, contentHash, derivatives and clears log', async () => {
    const updateSpy = vi.spyOn(prisma.asset, 'update').mockResolvedValue({} as never);

    await repo.markReady('123', 'hash456', { tiles: true });

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: '123' },
      data: {
        processingStatus: ProcessingStatus.READY,
        contentHash: 'hash456',
        derivatives: { tiles: true },
        processingLog: null,
      },
    });
  });

  it('markError updates status and saves log', async () => {
    const updateSpy = vi.spyOn(prisma.asset, 'update').mockResolvedValue({} as never);

    await repo.markError('123', 'Some error trace');

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: '123' },
      data: {
        processingStatus: ProcessingStatus.ERROR,
        processingLog: 'Some error trace',
      },
    });
  });
});
