import {
  AssetKind,
  ProcessingStatus,
  Role,
  TourStatus,
} from '@prisma/client';
import { AuditLogEntrySchema } from '@xplor/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { AuditService } from '../src/audit/audit.service.js';
import { TourPublicationService } from '../src/catalog/tour-publication.service.js';
import { ToursService } from '../src/catalog/tours.service.js';
import { createShareToken } from '../src/catalog/share-token.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { readDatabaseUrlTest } from './global-setup.js';

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaService({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});
const auditService = new AuditService(prisma);
const toursService = new ToursService(prisma, auditService);
const publicationService = new TourPublicationService(prisma, toursService, auditService);

const createdAuditLogIds: string[] = [];
const createdSceneIds: string[] = [];
const createdTourIds: string[] = [];
const createdAssetIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdCityIds: string[] = [];
const createdUserIds: string[] = [];

async function cleanupTestData(): Promise<void> {
  if (createdAuditLogIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: createdAuditLogIds } },
    });
    createdAuditLogIds.length = 0;
  }
  if (createdTourIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        entityType: 'Tour',
        entityId: { in: createdTourIds },
      },
    });
    await prisma.tour.updateMany({
      where: { id: { in: createdTourIds } },
      data: { startSceneId: null },
    });
  }
  if (createdSceneIds.length > 0) {
    await prisma.scene.deleteMany({
      where: { id: { in: createdSceneIds } },
    });
    createdSceneIds.length = 0;
  }
  if (createdTourIds.length > 0) {
    await prisma.tourCategory.deleteMany({
      where: { tourId: { in: createdTourIds } },
    });
    await prisma.tour.deleteMany({
      where: { id: { in: createdTourIds } },
    });
    createdTourIds.length = 0;
  }
  if (createdAssetIds.length > 0) {
    await prisma.asset.deleteMany({
      where: { id: { in: createdAssetIds } },
    });
    createdAssetIds.length = 0;
  }
  if (createdCategoryIds.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: createdCategoryIds } },
    });
    createdCategoryIds.length = 0;
  }
  if (createdCityIds.length > 0) {
    await prisma.city.deleteMany({
      where: { id: { in: createdCityIds } },
    });
    createdCityIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    createdUserIds.length = 0;
  }
}

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  try {
    await cleanupTestData();
  } finally {
    await prisma.$disconnect();
    if (savedDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = savedDatabaseUrl;
    }
  }
});

async function createTestUser(): Promise<string> {
  const timestamp = Date.now().toString();
  const user = await prisma.user.create({
    data: {
      email: `audit-pub-${timestamp}@xplor.local`,
      name: 'Éditeur Publication Audit',
      passwordHash: 'dummyhash-audit-pub',
      role: Role.EDITOR,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function createPublishableTour(userId: string): Promise<string> {
  const timestamp = Date.now().toString();

  const city = await prisma.city.create({
    data: {
      name: {
        fr: `Ville Test ${timestamp}`,
        ar: `مدينة الاختبار ${timestamp}`,
        en: `Test City ${timestamp}`,
      },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.020882,
      lng: -6.84165,
    },
  });
  createdCityIds.push(city.id);

  const category = await prisma.category.create({
    data: {
      name: {
        fr: `Catégorie Test ${timestamp}`,
        ar: `تصنيف الاختبار ${timestamp}`,
        en: `Test Category ${timestamp}`,
      },
      icon: 'landmark',
      color: '#6958A5',
      weight: 1,
    },
  });
  createdCategoryIds.push(category.id);

  const coverAsset = await prisma.asset.create({
    data: {
      kind: AssetKind.IMAGE,
      originalKey: `test/cover-${timestamp}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      contentHash: `hash-cover-${timestamp}`,
      processingStatus: ProcessingStatus.READY,
    },
  });
  createdAssetIds.push(coverAsset.id);

  const panoramaAsset = await prisma.asset.create({
    data: {
      kind: AssetKind.PANORAMA,
      originalKey: `test/pano-${timestamp}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      contentHash: `hash-pano-${timestamp}`,
      processingStatus: ProcessingStatus.READY,
      derivatives: {
        preview: 'derived/preview.jpg',
        web: 'derived/web.jpg',
        thumb: 'derived/thumb.jpg',
        tilesPrefix: 'derived/tiles/',
        tileGrid: { cols: 8, rows: 4, size: 512 },
      },
    },
  });
  createdAssetIds.push(panoramaAsset.id);

  const tour = await prisma.tour.create({
    data: {
      title: {
        fr: `Visite Publiable ${timestamp}`,
        ar: `جولة قابلة للنشر ${timestamp}`,
        en: `Publishable Tour ${timestamp}`,
      },
      summary: {
        fr: `Résumé de la visite ${timestamp}`,
        ar: `ملخص الجولة ${timestamp}`,
        en: `Tour summary ${timestamp}`,
      },
      cityId: city.id,
      coverAssetId: coverAsset.id,
      createdById: userId,
      shareToken: createShareToken(),
      categories: {
        create: [
          {
            categoryId: category.id,
          },
        ],
      },
    },
  });
  createdTourIds.push(tour.id);

  const scene = await prisma.scene.create({
    data: {
      tourId: tour.id,
      title: {
        fr: `Scène 1 ${timestamp}`,
        ar: `مشهد 1 ${timestamp}`,
        en: `Scene 1 ${timestamp}`,
      },
      panoramaAssetId: panoramaAsset.id,
      weight: 0,
      createdById: userId,
    },
  });
  createdSceneIds.push(scene.id);

  await prisma.tour.update({
    where: { id: tour.id },
    data: { startSceneId: scene.id },
  });

  return tour.id;
}

describe('Audit publication — test d’intégration de bout en bout (M8 F-91)', () => {
  it("publie une visite minimale et enregistre une ligne d'audit 'tour.publish' avec userId", async () => {
    const userId = await createTestUser();
    const tourId = await createPublishableTour(userId);

    const published = await publicationService.publish(tourId, userId);

    expect(published.id).toBe(tourId);
    expect(published.status).toBe(TourStatus.PUBLISHED);
    expect(published.contentVersion).toBe(2);

    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'tour.publish',
        entityType: 'Tour',
        entityId: tourId,
      },
    });

    expect(log).not.toBeNull();
    if (log === null) {
      throw new Error('AuditLog non trouvé en base de données');
    }

    createdAuditLogIds.push(log.id);

    expect(log.action).toBe('tour.publish');
    expect(log.entityType).toBe('Tour');
    expect(log.entityId).toBe(tourId);
    expect(log.userId).toBe(userId);
    expect(log.kioskId).toBeNull();
    expect(log.ip).toBeNull();
    expect(log.createdAt).toBeInstanceOf(Date);

    const parsedLog = AuditLogEntrySchema.safeParse({
      id: log.id,
      userId: log.userId,
      kioskId: log.kioskId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      diff: log.diff,
      ip: log.ip,
      createdAt: log.createdAt.toISOString(),
    });
    expect(parsedLog.success).toBe(true);

    const tourInDb = await prisma.tour.findUnique({
      where: { id: tourId },
    });
    expect(tourInDb).not.toBeNull();
    if (tourInDb === null) {
      throw new Error('Visite introuvable en base');
    }
    expect(tourInDb.status).toBe(TourStatus.PUBLISHED);
    expect(tourInDb.publishedAt).toBeInstanceOf(Date);
    expect(tourInDb.contentVersion).toBe(2);
  });

  it("publie une visite minimale et enregistre une ligne d'audit 'tour.publish' avec userId nul si aucun acteur n'est fourni", async () => {
    const userId = await createTestUser();
    const tourId = await createPublishableTour(userId);

    const published = await publicationService.publish(tourId);

    expect(published.id).toBe(tourId);
    expect(published.status).toBe(TourStatus.PUBLISHED);

    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'tour.publish',
        entityType: 'Tour',
        entityId: tourId,
      },
    });

    expect(log).not.toBeNull();
    if (log === null) {
      throw new Error('AuditLog non trouvé en base de données');
    }

    createdAuditLogIds.push(log.id);

    expect(log.action).toBe('tour.publish');
    expect(log.entityType).toBe('Tour');
    expect(log.entityId).toBe(tourId);
    expect(log.userId).toBeNull();
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it("refuse la publication et n'écrit aucun log d'audit si la visite n'est pas publiable", async () => {
    const userId = await createTestUser();
    const timestamp = Date.now().toString();

    const city = await prisma.city.create({
      data: {
        name: {
          fr: `Ville Invalide ${timestamp}`,
          ar: `مدينة ${timestamp}`,
          en: `City ${timestamp}`,
        },
        region: 'Rabat-Salé-Kénitra',
        lat: 34.020882,
        lng: -6.84165,
      },
    });
    createdCityIds.push(city.id);

    const category = await prisma.category.create({
      data: {
        name: {
          fr: `Catégorie Invalide ${timestamp}`,
          ar: `تصنيف ${timestamp}`,
          en: `Category ${timestamp}`,
        },
        icon: 'landmark',
        color: '#6958A5',
        weight: 1,
      },
    });
    createdCategoryIds.push(category.id);

    const coverAsset = await prisma.asset.create({
      data: {
        kind: AssetKind.IMAGE,
        originalKey: `test/cover-inv-${timestamp}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        contentHash: `hash-cover-inv-${timestamp}`,
        processingStatus: ProcessingStatus.READY,
      },
    });
    createdAssetIds.push(coverAsset.id);

    const unpublishableTour = await prisma.tour.create({
      data: {
        title: {
          fr: `Visite Incomplète ${timestamp}`,
          ar: `جولة غير مكتملة ${timestamp}`,
          en: `Incomplete Tour ${timestamp}`,
        },
        summary: {
          fr: `Résumé incomplet ${timestamp}`,
          ar: `ملخص ${timestamp}`,
          en: `Summary ${timestamp}`,
        },
        cityId: city.id,
        coverAssetId: coverAsset.id,
        createdById: userId,
        shareToken: createShareToken(),
        categories: {
          create: [
            {
              categoryId: category.id,
            },
          ],
        },
      },
    });
    createdTourIds.push(unpublishableTour.id);

    await expect(publicationService.publish(unpublishableTour.id, userId)).rejects.toThrow();

    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'tour.publish',
        entityType: 'Tour',
        entityId: unpublishableTour.id,
      },
    });
    expect(log).toBeNull();

    const tourInDb = await prisma.tour.findUnique({
      where: { id: unpublishableTour.id },
    });
    expect(tourInDb).not.toBeNull();
    if (tourInDb === null) {
      throw new Error('Visite introuvable');
    }
    expect(tourInDb.status).toBe(TourStatus.DRAFT);
    expect(tourInDb.publishedAt).toBeNull();
  });

  it("rejette avec une erreur 404 et n'écrit aucun log d'audit si la visite est inexistante", async () => {
    const userId = await createTestUser();
    const unknownTourId = '01990000-0000-7000-8000-0000000000aa';

    await expect(publicationService.publish(unknownTourId, userId)).rejects.toThrow();

    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'tour.publish',
        entityType: 'Tour',
        entityId: unknownTourId,
      },
    });
    expect(log).toBeNull();
  });
});
