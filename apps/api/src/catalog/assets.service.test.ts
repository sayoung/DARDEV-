import { HttpException } from '@nestjs/common';
import { AssetKind, ProcessingStatus, type AssetListQuery } from '@xplor/shared';
import { type Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

import { PrismaService } from '../prisma/prisma.service.js';
import { type PanoramaQueueService } from '../queue/panorama-queue.service.js';
import { type StorageService } from '../storage/storage.service.js';
import { AssetsService } from './assets.service.js';
import { ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE } from './catalog.errors.js';

const OLDER_ID = '01990000-0000-7000-8000-000000000001';
const MIDDLE_ID = '01990000-0000-7000-8000-000000000002';
const NEWER_ID = '01990000-0000-7000-8000-000000000003';
const UNKNOWN_ID = '01990000-0000-7000-8000-0000000000aa';

interface AssetRow {
  id: string;
  kind: AssetKind;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  processingStatus: ProcessingStatus;
  processingLog: string | null;
  copyright: string | null;
  createdAt: Date;
  originalKey: string;
}

interface OrderKey {
  createdAt?: 'asc' | 'desc';
  id?: 'asc' | 'desc';
}

interface ListArgs {
  where?: { kind?: AssetKind; processingStatus?: { in?: ProcessingStatus[] } };
  orderBy?: OrderKey[];
  skip?: number;
  take?: number;
  select?: Record<string, boolean>;
}

const listAll: AssetListQuery = { page: 1, pageSize: 20 };

function row(
  id: string,
  kind: AssetKind,
  createdAt: string,
  extra: Partial<Pick<AssetRow, 'width' | 'height' | 'copyright' | 'processingStatus' | 'processingLog'>> = {},
): AssetRow {
  return {
    id,
    kind,
    mimeType: kind === AssetKind.AUDIO ? 'audio/mpeg' : 'image/jpeg',
    sizeBytes: 128,
    width: extra.width === undefined ? null : extra.width,
    height: extra.height === undefined ? null : extra.height,
    processingStatus: extra.processingStatus ?? ProcessingStatus.PENDING,
    processingLog: extra.processingLog === undefined ? null : extra.processingLog,
    copyright: extra.copyright === undefined ? null : extra.copyright,
    createdAt: new Date(createdAt),
    originalKey: `unit/${id}`,
  };
}

function harness(rows: AssetRow[]): { 
  service: AssetsService; 
  lists: ListArgs[]; 
  creates: Prisma.AssetCreateArgs[]; 
  updates: Prisma.AssetUpdateArgs[]; 
  storage: StorageService;
  panoramaQueue: PanoramaQueueService;
} {
  const lists: ListArgs[] = [];
  const creates: Prisma.AssetCreateArgs[] = [];
  const updates: Prisma.AssetUpdateArgs[] = [];

  const prisma = {
    asset: {
      count: ({ where }: { where: { kind?: AssetKind } }): Promise<number> =>
        Promise.resolve(rows.filter((item) => matches(item, where)).length),
      findMany: (args: ListArgs): Promise<AssetRow[]> => {
        lists.push(args);
        const filtered = rows.filter((item) => matches(item, args.where || {}));
        const orderBy = args.orderBy;
        const sorted = orderBy ? [...filtered].sort((left, right) => compare(left, right, orderBy)) : filtered;
        const result = (args.skip !== undefined && args.take !== undefined) ? sorted.slice(args.skip, args.skip + args.take) : sorted;
        return Promise.resolve(result);
      },
      findUnique: ({ where }: { where: { id: string } }): Promise<AssetRow | null> =>
        Promise.resolve(rows.find((item) => item.id === where.id) ?? null),
      create: (args: Prisma.AssetCreateArgs) => {
        creates.push(args);
        return Promise.resolve({ ...args.data, id: '01990000-0000-7000-8000-newasset0001' } as unknown as AssetRow);
      },
      update: (args: Prisma.AssetUpdateArgs) => {
        updates.push(args);
        const existing = rows.find(r => r.id === args.where.id);
        return Promise.resolve({ ...existing, ...args.data } as unknown as AssetRow);
      }
    },
  } as unknown as PrismaService;

  const storage = {
    generatePresignedUploadUrl: (key: string) => {
      return Promise.resolve(`https://fake-s3.com/${key}?signed=true`);
    },
    headObject: () => Promise.resolve(null),
    getRange: () => Promise.resolve(Buffer.alloc(0)),
  } as unknown as StorageService;

  const panoramaQueue = {
    enqueue: () => Promise.resolve(),
  } as unknown as PanoramaQueueService;

  return { service: new AssetsService(prisma, storage, panoramaQueue), lists, creates, updates, storage, panoramaQueue };
}

function matches(item: AssetRow, where: { kind?: AssetKind; processingStatus?: { in?: ProcessingStatus[] } }): boolean {
  if (where.kind !== undefined && item.kind !== where.kind) {
    return false;
  }
  if (where.processingStatus?.in !== undefined) {
    if (!where.processingStatus.in.includes(item.processingStatus)) {
      return false;
    }
  }
  return true;
}

function compare(left: AssetRow, right: AssetRow, orderBy: readonly OrderKey[]): number {
  for (const key of orderBy) {
    if (key.createdAt !== undefined) {
      const delta = left.createdAt.getTime() - right.createdAt.getTime();
      if (delta !== 0) {
        return key.createdAt === 'desc' ? -delta : delta;
      }
    }
    if (key.id !== undefined && left.id !== right.id) {
      const delta = left.id < right.id ? -1 : 1;
      return key.id === 'desc' ? -delta : delta;
    }
  }
  return 0;
}

const sample = [
  row(OLDER_ID, AssetKind.IMAGE, '2026-09-01T00:00:00.000Z', {
    width: 800,
    height: 600,
    copyright: 'Libre',
    processingStatus: ProcessingStatus.READY,
  }),
  row(NEWER_ID, AssetKind.AUDIO, '2026-09-03T00:00:00.000Z'),
  row(MIDDLE_ID, AssetKind.PANORAMA, '2026-09-02T00:00:00.000Z'),
];

describe('AssetsService', () => {
  it('trie createdAt décroissant, puis id croissant, et pagine', async () => {
    const tiedEarly = row(OLDER_ID, AssetKind.IMAGE, '2026-09-02T00:00:00.000Z');
    const tiedLate = row(NEWER_ID, AssetKind.VIDEO, '2026-09-02T00:00:00.000Z');
    const { service, lists } = harness([tiedLate, tiedEarly]);
    const page = await service.list({ page: 1, pageSize: 1 });
    expect(lists[0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    expect(page).toEqual({
      items: [
        {
          id: OLDER_ID,
          kind: AssetKind.IMAGE,
          mimeType: 'image/jpeg',
          sizeBytes: 128,
          width: null,
          height: null,
          processingStatus: ProcessingStatus.PENDING,
          processingLog: null,
          copyright: null,
          createdAt: '2026-09-02T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 1,
      total: 2,
    });
    const next = await service.list({ page: 2, pageSize: 1 });
    expect(next.items.map((item) => item.id)).toEqual([NEWER_ID]);
    expect(next.total).toBe(2);
  });

  it('filtre sur kind et n’expose pas la clé de stockage', async () => {
    const { service, lists } = harness(sample);
    const images = await service.list({ ...listAll, kind: AssetKind.IMAGE });
    expect(lists[0]).toMatchObject({ where: { kind: AssetKind.IMAGE } });
    expect(images.total).toBe(1);
    expect(images.items).toEqual([
      {
        id: OLDER_ID,
        kind: AssetKind.IMAGE,
        mimeType: 'image/jpeg',
        sizeBytes: 128,
        width: 800,
        height: 600,
        processingStatus: ProcessingStatus.READY,
        processingLog: null,
        copyright: 'Libre',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    expect(images.items[0]).not.toHaveProperty('originalKey');

    const all = await service.list(listAll);
    expect(lists[1]).toMatchObject({ where: {} });
    expect(all.items.map((item) => item.id)).toEqual([NEWER_ID, MIDDLE_ID, OLDER_ID]);
    expect(all.total).toBe(3);
  });

  it('relit un média par identifiant', async () => {
    const { service } = harness(sample);
    const found = await service.get(OLDER_ID);
    expect(found.id).toBe(OLDER_ID);
    expect(found.kind).toBe(AssetKind.IMAGE);
    expect(found.copyright).toBe('Libre');
  });

  it('répond 404 ASSET_NOT_FOUND si le média est inconnu', async () => {
    const { service } = harness(sample);
    const error = await service.get(UNKNOWN_ID).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) {
      return;
    }
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      error: { code: ASSET_NOT_FOUND, message: ASSET_NOT_FOUND_MESSAGE },
    });
  });

  describe('createUploadUrl', () => {
    it('crée un média, génère une URL signée et nettoie le filename', async () => {
      const { service, creates, updates } = harness([]);
      const result = await service.createUploadUrl({
        kind: AssetKind.IMAGE,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        filename: 'mon_image (1).jpg!',
      });

      expect(creates).toHaveLength(1);
      expect(creates[0]?.data).toMatchObject({
        kind: AssetKind.IMAGE,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        processingStatus: ProcessingStatus.PENDING,
      });

      expect(updates).toHaveLength(1);
      expect(updates[0]?.data.originalKey).toBe('uploads/01990000-0000-7000-8000-newasset0001/mon_image--1-.jpg-');

      expect(result.assetId).toBe('01990000-0000-7000-8000-newasset0001');
      expect(result.uploadUrl).toBe('https://fake-s3.com/uploads/01990000-0000-7000-8000-newasset0001/mon_image--1-.jpg-?signed=true');
      expect(result.uploadMethod).toBe('PUT');
      expect(result.expiresInSeconds).toBe(900);
    });

    it('refuse d’emblée un panorama qui n’est pas un JPEG', async () => {
      const { service, creates } = harness([]);
      const error = await service.createUploadUrl({
        kind: AssetKind.PANORAMA,
        mimeType: 'image/png',
        sizeBytes: 1024,
        filename: 'pano.png',
      }).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) {
        return;
      }
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'INVALID_FORMAT' },
      });
      expect(creates).toHaveLength(0);
    });
  });

  describe('complete', () => {
    const PANO_ID = '01990000-0000-7000-8000-000000000004';

    it('met en file un panorama 4096x2048 conforme', async () => {
      const asset = row(PANO_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const { service, storage, panoramaQueue, updates } = harness([asset]);
      const imageBuffer = await sharp({
        create: { width: 4096, height: 2048, channels: 3, background: { r: 255, g: 0, b: 0 } }
      }).jpeg().toBuffer();
      
      vi.spyOn(storage, 'headObject').mockResolvedValue({ sizeBytes: imageBuffer.length, contentType: 'image/jpeg' });
      vi.spyOn(storage, 'getRange').mockResolvedValue(imageBuffer);
      const enqueueSpy = vi.spyOn(panoramaQueue, 'enqueue');

      const result = await service.complete(PANO_ID);

      expect(updates).toHaveLength(1);
      expect(updates[0]?.data).toMatchObject({
        width: 4096,
        height: 2048,
        sizeBytes: imageBuffer.length,
        processingStatus: ProcessingStatus.PROCESSING,
      });
      expect(enqueueSpy).toHaveBeenCalledWith(PANO_ID);
      expect(result.processingStatus).toBe(ProcessingStatus.PROCESSING);
    });

    it('refuse 4000x2000 avec 422 INVALID_DIMENSIONS et message attendu/reçu', async () => {
      const asset = row(PANO_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const { service, storage, updates } = harness([asset]);
      const imageBuffer = await sharp({
        create: { width: 4000, height: 2000, channels: 3, background: { r: 255, g: 0, b: 0 } }
      }).jpeg().toBuffer();
      
      vi.spyOn(storage, 'headObject').mockResolvedValue({ sizeBytes: imageBuffer.length, contentType: 'image/jpeg' });
      vi.spyOn(storage, 'getRange').mockResolvedValue(imageBuffer);

      const error = await service.complete(PANO_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({
        error: { 
          code: 'INVALID_DIMENSIONS',
          message: 'attendu : >= 4096 ; reçu : 4000',
        },
      });
      expect(updates).toHaveLength(1);
      expect(updates[0]?.data.processingStatus).toBe(ProcessingStatus.ERROR);
      expect(updates[0]?.data.processingLog).toBe('attendu : >= 4096 ; reçu : 4000');
    });

    it('refuse ratio 8000x4100 en INVALID_RATIO', async () => {
      const asset = row(PANO_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const { service, storage, updates } = harness([asset]);
      const imageBuffer = await sharp({
        create: { width: 8000, height: 4100, channels: 3, background: { r: 255, g: 0, b: 0 } }
      }).jpeg().toBuffer();
      
      vi.spyOn(storage, 'headObject').mockResolvedValue({ sizeBytes: imageBuffer.length, contentType: 'image/jpeg' });
      vi.spyOn(storage, 'getRange').mockResolvedValue(imageBuffer);

      const error = await service.complete(PANO_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'INVALID_RATIO' },
      });
      expect(updates[0]?.data.processingStatus).toBe(ProcessingStatus.ERROR);
    });

    it('répond 409 sur un asset déjà PROCESSING', async () => {
      const asset = row(PANO_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PROCESSING });
      const { service } = harness([asset]);

      const error = await service.complete(PANO_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'ASSET_ALREADY_COMPLETED' },
      });
    });

    it('répond 422 UPLOAD_MISSING', async () => {
      const asset = row(PANO_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const { service, storage } = harness([asset]);
      vi.spyOn(storage, 'headObject').mockResolvedValue(null);

      const error = await service.complete(PANO_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'UPLOAD_MISSING' },
      });
    });
  });

  describe('reprocess', () => {
    const ASSET_ID = '01990000-0000-7000-8000-000000000005';

    it('répond 404 si l\'asset est introuvable', async () => {
      const { service } = harness([]);
      const error = await service.reprocess(ASSET_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({
        error: { code: ASSET_NOT_FOUND },
      });
    });

    it('répond 422 si l\'asset n\'est pas un panorama', async () => {
      const asset = row(ASSET_ID, AssetKind.IMAGE, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.READY });
      const { service } = harness([asset]);
      const error = await service.reprocess(ASSET_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'ASSET_NOT_REPROCESSABLE', message: 'L\'asset n\'est pas un panorama' },
      });
    });

    it('répond 409 si l\'asset est en statut PENDING', async () => {
      const asset = row(ASSET_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const { service } = harness([asset]);
      const error = await service.reprocess(ASSET_ID).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) return;
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        error: { code: 'ASSET_NOT_UPLOADED' },
      });
    });

    it('passe en PROCESSING et enqueue si le statut est READY ou ERROR', async () => {
      const asset = row(ASSET_ID, AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.ERROR, processingLog: 'erreur' });
      const { service, panoramaQueue, updates } = harness([asset]);
      const enqueueSpy = vi.spyOn(panoramaQueue, 'enqueue');

      const result = await service.reprocess(ASSET_ID);
      expect(updates).toHaveLength(1);
      expect(updates[0]?.data).toMatchObject({
        processingStatus: ProcessingStatus.PROCESSING,
        processingLog: null,
      });
      expect(enqueueSpy).toHaveBeenCalledWith(ASSET_ID, 'reprocess');
      expect(result.processingStatus).toBe(ProcessingStatus.PROCESSING);
      expect(result.processingLog).toBeNull();
    });
  });

  describe('reprocessAllPanoramas', () => {
    it('relance uniquement les panoramas READY ou ERROR', async () => {
      const p1 = row('01990000-0000-7000-8000-000000000101', AssetKind.PANORAMA, '2026-10-01T00:00:00.000Z', { processingStatus: ProcessingStatus.READY });
      const p2 = row('01990000-0000-7000-8000-000000000102', AssetKind.PANORAMA, '2026-10-02T00:00:00.000Z', { processingStatus: ProcessingStatus.ERROR });
      const p3 = row('01990000-0000-7000-8000-000000000103', AssetKind.PANORAMA, '2026-10-03T00:00:00.000Z', { processingStatus: ProcessingStatus.PENDING });
      const p4 = row('01990000-0000-7000-8000-000000000104', AssetKind.PANORAMA, '2026-10-04T00:00:00.000Z', { processingStatus: ProcessingStatus.PROCESSING });
      const i1 = row('01990000-0000-7000-8000-000000000105', AssetKind.IMAGE, '2026-10-05T00:00:00.000Z', { processingStatus: ProcessingStatus.READY });
      
      const { service, panoramaQueue, updates } = harness([p1, p2, p3, p4, i1]);
      
      const enqueueSpy = vi.spyOn(panoramaQueue, 'enqueue');
      
      const count = await service.reprocessAllPanoramas();
      
      expect(count).toBe(2);
      expect(enqueueSpy).toHaveBeenCalledTimes(2);
      expect(enqueueSpy).toHaveBeenCalledWith('01990000-0000-7000-8000-000000000101', 'reprocess');
      expect(enqueueSpy).toHaveBeenCalledWith('01990000-0000-7000-8000-000000000102', 'reprocess');
      expect(updates).toHaveLength(2);
    });
  });
});
