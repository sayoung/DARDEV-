/**
 * Lecture HTTP des médias (F-05).
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import { ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AssetKind, PrismaClient, ProcessingStatus } from '@prisma/client';
import {
  AssetCleanupDryRunResponseSchema,
  AssetCleanupResultSchema,
  AssetFoldersResponseSchema,
  AssetResponseSchema,
  AssetUploadResponseSchema,
  MeResponseSchema,
  PaginatedAssetResponseSchema,
  type PaginatedAssetResponse,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE } from '../src/catalog/catalog.errors.js';
import { ENV } from '../src/config/config.module.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { S3_CLIENT } from '../src/health/health.probes.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { STORAGE_SERVICE, type StorageService } from '../src/storage/storage.service.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des médias ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const EDITOR_EMAIL = 'editor@xplor.local';
const PARTNER_EMAIL = 'partner@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';
const UNKNOWN_ASSET_ID = '01990000-0000-7000-8000-0000000000aa';

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});

const allowThrottle: CanActivate = {
  canActivate: () => true,
};

type Injected = Awaited<ReturnType<NestFastifyApplication['inject']>>;

interface Session {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

let app: NestFastifyApplication | undefined;
let redis: Redis | undefined;
let seedPassword = '';
let passwordHash = '';

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  seedPassword = readSeedPassword();
  passwordHash = await new PasswordService().hash(seedPassword);
  app = await startApplication();
  redis = app.get<Redis>(REDIS);
  try {
    await redis.ping();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Erreur inconnue';
    throw new Error(`Impossible de joindre Redis (REDIS_URL). ${detail}`);
  }
});

beforeEach(async () => {
  await resetDb();
  await flushSessions(requireRedis());
  await seedDemoUsers();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  if (savedDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = savedDatabaseUrl;
  }
});

describe('médias HTTP', () => {
  it('répond 401 sans session', async () => {
    const list = await application().inject({ method: 'GET', url: '/api/v1/admin/assets' });
    const detail = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/assets/${UNKNOWN_ASSET_ID}`,
    });
    expect(list.statusCode).toBe(401);
    expect(detail.statusCode).toBe(401);
  });

  it('refuse la lecture à PARTNER et HOTEL_MANAGER', async () => {
    const image = await insertAsset(AssetKind.IMAGE, '2026-09-01T00:00:00.000Z');
    const partner = await login(PARTNER_EMAIL);
    const partnerList = await read(`/api/v1/admin/assets`, partner);
    const partnerDetail = await read(`/api/v1/admin/assets/${image.id}`, partner);
    expect(partnerList.statusCode).toBe(403);
    expect(partnerDetail.statusCode).toBe(403);

    const manager = await login(MANAGER_EMAIL);
    const managerList = await read('/api/v1/admin/assets', manager);
    const managerDetail = await read(`/api/v1/admin/assets/${image.id}`, manager);
    expect(managerList.statusCode).toBe(403);
    expect(managerDetail.statusCode).toBe(403);
  });

  it('filtre par kind, trie createdAt décroissant et relit un média', async () => {
    const image = await insertAsset(AssetKind.IMAGE, '2026-09-01T00:00:00.000Z', {
      width: 800,
      height: 600,
      copyright: 'Libre',
      processingStatus: ProcessingStatus.READY,
    });
    const panorama = await insertAsset(AssetKind.PANORAMA, '2026-09-03T00:00:00.000Z');
    const audio = await insertAsset(AssetKind.AUDIO, '2026-09-02T00:00:00.000Z');

    const editor = await login(EDITOR_EMAIL);
    const page = await listAssets(editor, 'page=1&pageSize=2');
    expect(page.total).toBe(3);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.items.map((item) => item.id)).toEqual([panorama.id, audio.id]);
    expect(page.items[0]).toMatchObject({
      id: panorama.id,
      kind: AssetKind.PANORAMA,
      createdAt: '2026-09-03T00:00:00.000Z',
    });

    const images = await listAssets(editor, 'kind=IMAGE');
    expect(images.total).toBe(1);
    expect(images.items.map((item) => item.kind)).toEqual([AssetKind.IMAGE]);

    const detail = await read(`/api/v1/admin/assets/${image.id}`, editor);
    expect(detail.statusCode).toBe(200);
    const body = parseJson(detail.body);
    expect(jsonKeys(body)).toEqual([
      'copyright',
      'createdAt',
      'derivatives',
      'height',
      'id',
      'kind',
      'mimeType',
      'panorama',
      'processingLog',
      'processingStatus',
      'sizeBytes',
      'thumbnailUrl',
      'width',
    ]);
    const parsed = AssetResponseSchema.parse(body);
    expect(typeof parsed.thumbnailUrl).toBe('string');
    expect(parsed).toMatchObject({
      id: image.id,
      kind: AssetKind.IMAGE,
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      width: 800,
      height: 600,
      processingStatus: ProcessingStatus.READY,
      processingLog: null,
      copyright: 'Libre',
      createdAt: '2026-09-01T00:00:00.000Z',
    });

    const missing = await read(`/api/v1/admin/assets/${UNKNOWN_ASSET_ID}`, editor);
    expect(missing.statusCode).toBe(404);
    expect(parseJson(missing.body)).toEqual({
      error: { code: ASSET_NOT_FOUND, message: ASSET_NOT_FOUND_MESSAGE },
    });
  });

  it('génère une URL d’upload', async () => {
    const editor = await login(EDITOR_EMAIL);
    const partner = await login(PARTNER_EMAIL);

    const payload = JSON.stringify({
      kind: AssetKind.IMAGE,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      filename: 'test.jpg',
    });

    const noSession = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload-url',
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expect(noSession.statusCode).toBe(401);

    const noCsrf = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload-url',
      headers: { cookie: sessionCookie(editor.sessionId), 'content-type': 'application/json' },
      payload,
    });
    expect(noCsrf.statusCode).toBe(403);

    const forbidden = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload-url',
      headers: {
        cookie: sessionCookie(partner.sessionId),
        'x-csrf-token': partner.csrfToken,
        'content-type': 'application/json',
      },
      payload,
    });
    expect(forbidden.statusCode).toBe(403);

    const success = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload-url',
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
        'content-type': 'application/json',
      },
      payload,
    });
    expect(success.statusCode).toBe(201);
    const body = AssetUploadResponseSchema.parse(parseJson(success.body));
    expect(body.uploadUrl).toContain('uploads/');
    expect(body.uploadMethod).toBe('PUT');
  });

  it('refuse le POST complete sans session ou avec PARTNER', async () => {
    const asset = await insertAsset(AssetKind.IMAGE, '2026-09-01T00:00:00.000Z');
    const partner = await login(PARTNER_EMAIL);

    const noSession = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/complete`,
    });
    expect(noSession.statusCode).toBe(401);

    const noCsrf = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/complete`,
      headers: { cookie: sessionCookie(partner.sessionId) },
    });
    expect(noCsrf.statusCode).toBe(403);

    const forbidden = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/complete`,
      headers: {
        cookie: sessionCookie(partner.sessionId),
        'x-csrf-token': partner.csrfToken,
      },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('gère correctement le POST reprocess (200, 403, CSRF, 400)', async () => {
    const asset = await insertAsset(AssetKind.PANORAMA, '2026-09-01T00:00:00.000Z', {
      processingStatus: ProcessingStatus.READY,
    });
    const editor = await login(EDITOR_EMAIL);
    const manager = await login(MANAGER_EMAIL);

    // Éditeur reçoit 200
    const success = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/reprocess`,
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
    });
    expect(success.statusCode).toBe(200);

    // Gestionnaire d'hôtel reçoit 403
    const forbidden = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/reprocess`,
      headers: {
        cookie: sessionCookie(manager.sessionId),
        'x-csrf-token': manager.csrfToken,
      },
    });
    expect(forbidden.statusCode).toBe(403);

    // Sans jeton CSRF est refusé
    const noCsrf = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${asset.id}/reprocess`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(noCsrf.statusCode).toBe(403);

    // ID non UUID donne 400
    const notUuid = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/not-a-uuid/reprocess`,
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
    });
    expect(notUuid.statusCode).toBe(400);

    // Média introuvable donne 404
    const notFound = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/assets/${UNKNOWN_ASSET_ID}/reprocess`,
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
    });
    expect(notFound.statusCode).toBe(404);
  });

  it('gère la suppression DELETE (204, 403, 409 ASSET_IN_USE, CSRF)', async () => {
    const editor = await login(EDITOR_EMAIL);
    const manager = await login(MANAGER_EMAIL);

    // Média libre
    const freeAsset = await insertAsset(AssetKind.IMAGE, '2026-10-01T00:00:00.000Z');
    
    // Média utilisé (on crée une scène qui le référence)
    const usedAsset = await insertAsset(AssetKind.IMAGE, '2026-10-02T00:00:00.000Z');
    
    // Créer une ville pour le tour
    const city = await prisma.city.create({
      data: {
        name: { fr: 'Ville Test' },
        region: 'Region',
        lat: 33,
        lng: -7
      }
    });

    const cover = await insertAsset(AssetKind.IMAGE, '2026-10-03T00:00:00.000Z');

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });

    const tour = await prisma.tour.create({
      data: { 
        title: { fr: 'Tour Test' }, 
        summary: { fr: 'Résumé' },
        cityId: city.id,
        coverAssetId: cover.id,
        createdById: adminUser.id,
      }
    });
    await prisma.scene.create({
      data: {
        tourId: tour.id,
        title: { fr: 'Scene Test' },
        panoramaAssetId: usedAsset.id,
        weight: 1,
        createdById: adminUser.id,
      }
    });

    // 1. Sans CSRF
    const noCsrf = await application().inject({
      method: 'DELETE',
      url: `/api/v1/admin/assets/${freeAsset.id}`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(noCsrf.statusCode).toBe(403);

    // 2. Gestionnaire d'hôtel reçoit 403
    const forbidden = await application().inject({
      method: 'DELETE',
      url: `/api/v1/admin/assets/${freeAsset.id}`,
      headers: {
        cookie: sessionCookie(manager.sessionId),
        'x-csrf-token': manager.csrfToken,
      },
    });
    expect(forbidden.statusCode).toBe(403);

    // 3. Asset utilisé donne 409 ASSET_IN_USE
    const conflict = await application().inject({
      method: 'DELETE',
      url: `/api/v1/admin/assets/${usedAsset.id}`,
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(parseJson(conflict.body)).toMatchObject({
      error: { code: 'ASSET_IN_USE' },
    });

    // 4. Succès sur un asset libre (204)
    const success = await application().inject({
      method: 'DELETE',
      url: `/api/v1/admin/assets/${freeAsset.id}`,
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
    });
    expect(success.statusCode).toBe(204);
    expect(success.body).toBe('');
    
    // Vérifier que le média est bien supprimé en DB
    const checkDb = await prisma.asset.findUnique({ where: { id: freeAsset.id } });
    expect(checkDb).toBeNull();
  });

  it('POST cleanup : 401 sans session, 403 sans CSRF, 403 pour HOTEL_MANAGER, 200 pour un éditeur', async () => {
    const editor = await login(EDITOR_EMAIL);
    const manager = await login(MANAGER_EMAIL);

    const payload = JSON.stringify({ dryRun: true });

    const noSession = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/cleanup',
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expect(noSession.statusCode).toBe(401);

    const noCsrf = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/cleanup',
      headers: { cookie: sessionCookie(editor.sessionId), 'content-type': 'application/json' },
      payload,
    });
    expect(noCsrf.statusCode).toBe(403);

    const forbidden = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/cleanup',
      headers: {
        cookie: sessionCookie(manager.sessionId),
        'x-csrf-token': manager.csrfToken,
        'content-type': 'application/json',
      },
      payload,
    });
    expect(forbidden.statusCode).toBe(403);

    const success = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/assets/cleanup',
      headers: {
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
        'content-type': 'application/json',
      },
      payload,
    });
    expect(success.statusCode).toBe(200);
  });

  it('dry-run : liste les assets libres, ignore les assets utilisés et ne supprime rien', async () => {
    const editor = await login(EDITOR_EMAIL);

    const freeAsset = await insertAsset(AssetKind.IMAGE, '2026-10-01T10:00:00.000Z', {
      processingStatus: ProcessingStatus.READY,
    });
    const coverAsset = await insertAsset(AssetKind.PANORAMA, '2026-10-01T10:00:01.000Z', {
      processingStatus: ProcessingStatus.READY,
    });

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    let city = await prisma.city.findFirst();
    let cityCreated = false;
    if (!city) {
      city = await prisma.city.create({
        data: { name: { fr: 'Ville' }, region: 'Region', lat: 33, lng: -7 },
      });
      cityCreated = true;
    }

    const tour = await prisma.tour.create({
      data: {
        title: { fr: 'Tour' },
        summary: { fr: 'Résumé' },
        cityId: city.id,
        createdById: adminUser.id,
        coverAssetId: coverAsset.id,
      },
    });

    try {
      const payload = JSON.stringify({ dryRun: true });
      const res = await application().inject({
        method: 'POST',
        url: '/api/v1/admin/assets/cleanup',
        headers: {
          cookie: sessionCookie(editor.sessionId),
          'x-csrf-token': editor.csrfToken,
          'content-type': 'application/json',
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const parsed = AssetCleanupDryRunResponseSchema.parse(res.json());

      expect(parsed.items.find((i) => i.id === freeAsset.id)).toBeDefined();
      expect(parsed.items.find((i) => i.id === coverAsset.id)).toBeUndefined();
      expect(parsed.count).toBe(parsed.items.length);

      const rows = await prisma.asset.findMany({
        where: { id: { in: parsed.items.map((i) => i.id) } },
        select: { sizeBytes: true },
      });
      expect(rows.length).toBe(parsed.items.length);
      expect(parsed.totalBytes).toBe(rows.reduce((s, r) => s + r.sizeBytes, 0));

      const freeDb = await prisma.asset.findUnique({ where: { id: freeAsset.id } });
      expect(freeDb).not.toBeNull();
      const usedDb = await prisma.asset.findUnique({ where: { id: coverAsset.id } });
      expect(usedDb).not.toBeNull();
    } finally {
      await prisma.tour.delete({ where: { id: tour.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: freeAsset.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: coverAsset.id } }).catch(() => {});
      if (cityCreated) {
        await prisma.city.delete({ where: { id: city.id } }).catch(() => {});
      }
    }
  });

  it('suppression réelle supprime les fichiers S3', async () => {
    // Ce test vérifie les appels réels vers S3 si on n'utilise pas le driver local
    const editor = await login(EDITOR_EMAIL);
    const storageService = application().get<StorageService>(STORAGE_SERVICE);
    const s3Client = application().get<S3Client>(S3_CLIENT);
    const env = application().get<Env>(ENV);

    const freeAsset = await insertAsset(AssetKind.IMAGE, '2026-10-01T10:00:00Z', { processingStatus: ProcessingStatus.READY });
    const freeKey = `uploads/${freeAsset.id}/free.jpg`;
    await prisma.asset.update({ where: { id: freeAsset.id }, data: { originalKey: freeKey } });

    const refAsset = await insertAsset(AssetKind.PANORAMA, '2026-10-01T10:00:00Z', { processingStatus: ProcessingStatus.READY });
    const referencedKey = `uploads/${refAsset.id}/ref.jpg`;
    await prisma.asset.update({ where: { id: refAsset.id }, data: { originalKey: referencedKey } });

    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    let city = await prisma.city.findFirst();
    let cityCreated = false;
    if (!city) {
      city = await prisma.city.create({
        data: { name: { fr: 'Ville' }, region: 'Region', lat: 33, lng: -7 },
      });
      cityCreated = true;
    }

    const tour = await prisma.tour.create({
      data: {
        title: { fr: 'Tour Ref' },
        summary: { fr: 'Résumé' },
        cityId: city.id,
        createdById: adminUser.id,
        coverAssetId: refAsset.id,
      },
    });

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: freeKey,
        Body: Buffer.from('free'),
      }));
      await s3Client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: referencedKey,
        Body: Buffer.from('ref'),
      }));

      const payload = JSON.stringify({ dryRun: false });
      const response = await application().inject({
        method: 'POST',
        url: '/api/v1/admin/assets/cleanup',
        headers: {
          cookie: sessionCookie(editor.sessionId),
          'x-csrf-token': editor.csrfToken,
          'content-type': 'application/json',
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const parsed = AssetCleanupResultSchema.parse(response.json());
      expect(parsed.deleted).toBeGreaterThanOrEqual(1);

      const freeHead = await storageService.headObject(freeKey);
      expect(freeHead).toBeNull();

      const refHead = await storageService.headObject(referencedKey);
      expect(refHead).not.toBeNull();
    } finally {
      await storageService.deleteObject(freeKey).catch(() => {});
      await storageService.deleteObject(referencedKey).catch(() => {});
      await prisma.tour.delete({ where: { id: tour.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: freeAsset.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: refAsset.id } }).catch(() => {});
      if (cityCreated) {
        await prisma.city.delete({ where: { id: city.id } }).catch(() => {});
      }
    }

    const listFree = await s3Client.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: `uploads/${freeAsset.id}/` }));
    expect(listFree.KeyCount).toBe(0);
    const listRef = await s3Client.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: `uploads/${refAsset.id}/` }));
    expect(listRef.KeyCount).toBe(0);
  });

  it('un asset référencé uniquement par Hotspot.mediaAssetIds n\'est pas nettoyé', async () => {
    const editor = await login(EDITOR_EMAIL);
    const adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });

    const freeAsset = await insertAsset(AssetKind.IMAGE, '2026-10-02T10:00:00Z', { processingStatus: ProcessingStatus.READY });
    const usedAsset = await insertAsset(AssetKind.IMAGE, '2026-10-02T10:00:01Z', { processingStatus: ProcessingStatus.READY });
    const coverAsset = await insertAsset(AssetKind.PANORAMA, '2026-10-02T10:00:02Z', { processingStatus: ProcessingStatus.READY });

    let city = await prisma.city.findFirst();
    let cityCreated = false;
    if (!city) {
      city = await prisma.city.create({
        data: { name: { fr: 'Ville' }, region: 'Region', lat: 33, lng: -7 },
      });
      cityCreated = true;
    }

    const tour = await prisma.tour.create({
      data: {
        title: { fr: 'Tour Hotspot' },
        summary: { fr: 'Résumé' },
        cityId: city.id,
        createdById: adminUser.id,
        coverAssetId: coverAsset.id,
      },
    });

    const scene = await prisma.scene.create({
      data: {
        tourId: tour.id,
        title: { fr: 'Scene' },
        panoramaAssetId: coverAsset.id,
        weight: 1,
        createdById: adminUser.id,
      },
    });

    const hotspot = await prisma.hotspot.create({
      data: {
        sceneId: scene.id,
        type: 'INFO',
        yaw: 0,
        pitch: 0,
        label: { fr: 'Hotspot' },
        icon: 'INFO',
        mediaAssetIds: [usedAsset.id],
        createdById: adminUser.id,
      },
    });

    try {
      const payloadDryRun = JSON.stringify({ dryRun: true });
      const dryRunRes = await application().inject({
        method: 'POST',
        url: '/api/v1/admin/assets/cleanup',
        headers: {
          cookie: sessionCookie(editor.sessionId),
          'x-csrf-token': editor.csrfToken,
          'content-type': 'application/json',
        },
        payload: payloadDryRun,
      });

      expect(dryRunRes.statusCode).toBe(200);
      const parsedDryRun = AssetCleanupDryRunResponseSchema.parse(dryRunRes.json());
      
      const freeInDryRun = parsedDryRun.items.find((i) => i.id === freeAsset.id);
      expect(freeInDryRun).toBeDefined();
      
      const usedInDryRun = parsedDryRun.items.find((i) => i.id === usedAsset.id);
      expect(usedInDryRun).toBeUndefined();

      const payloadReal = JSON.stringify({ dryRun: false });
      const realRes = await application().inject({
        method: 'POST',
        url: '/api/v1/admin/assets/cleanup',
        headers: {
          cookie: sessionCookie(editor.sessionId),
          'x-csrf-token': editor.csrfToken,
          'content-type': 'application/json',
        },
        payload: payloadReal,
      });

      expect(realRes.statusCode).toBe(200);
      const parsedReal = AssetCleanupResultSchema.parse(realRes.json());
      expect(parsedReal.deleted).toBeGreaterThanOrEqual(1);

      const freeDb = await prisma.asset.findUnique({ where: { id: freeAsset.id } });
      expect(freeDb).toBeNull();

      const usedDb = await prisma.asset.findUnique({ where: { id: usedAsset.id } });
      expect(usedDb).not.toBeNull();
    } finally {
      await prisma.hotspot.delete({ where: { id: hotspot.id } }).catch(() => {});
      await prisma.scene.delete({ where: { id: scene.id } }).catch(() => {});
      await prisma.tour.delete({ where: { id: tour.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: freeAsset.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: usedAsset.id } }).catch(() => {});
      await prisma.asset.delete({ where: { id: coverAsset.id } }).catch(() => {});
      if (cityCreated) {
        await prisma.city.delete({ where: { id: city.id } }).catch(() => {});
      }
    }
  });
});

describe('dossiers médiathèque HTTP', () => {
  let editor: Session;
  let adminUser: { id: string };
  let hotel = { id: '' };
  let city = { id: '' };
  let tourA = { id: '' };
  let tourB = { id: '' };
  let sceneA = { id: '' };
  let coverAssetA = { id: '' };
  let sceneAssetA = { id: '' };
  let coverAssetB = { id: '' };
  let beforeTotal = 0;
  let beforeUnused = 0;

  async function insertHotel() {
    city = await prisma.city.create({
      data: { name: { fr: 'Ville' }, region: 'Region', lat: 33, lng: -7 },
    });
    return prisma.hotel.create({
      data: {
        name: 'Hotel',
        stars: 'FIVE',
        cityId: city.id,
        address: '1 rue',
        phone: '00',
        email: 'h@h.com',
        brandColor: '#123456',
        contractType: 'SALE',
        contractStart: new Date(),
        contractEnd: new Date(),
      },
    });
  }

  async function insertTour(coverAssetId: string, title: string) {
    return prisma.tour.create({
      data: {
        title: { fr: title },
        summary: { fr: 'Résumé' },
        cityId: city.id,
        createdById: adminUser.id,
        coverAssetId,
      },
    });
  }

  async function insertScene(tourId: string, panoramaAssetId: string) {
    return prisma.scene.create({
      data: {
        tourId,
        title: { fr: 'Scene' },
        panoramaAssetId,
        weight: 1,
        createdById: adminUser.id,
      },
    });
  }

  beforeEach(async () => {
    editor = await login(EDITOR_EMAIL);
    adminUser = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });

    const beforeRes = await read('/api/v1/admin/assets/folders', editor);
    expect(beforeRes.statusCode).toBe(200);
    const beforeStats = AssetFoldersResponseSchema.parse(parseJson(beforeRes.body));
    beforeTotal = beforeStats.total;
    beforeUnused = beforeStats.unusedCount;

    hotel = await insertHotel();

    coverAssetA = await insertAsset(AssetKind.IMAGE, '2026-10-08T00:00:00.000Z', { processingStatus: ProcessingStatus.READY });
    sceneAssetA = await insertAsset(AssetKind.PANORAMA, '2026-10-08T00:00:01.000Z', { processingStatus: ProcessingStatus.READY });
    coverAssetB = await insertAsset(AssetKind.IMAGE, '2026-10-08T00:00:02.000Z', { processingStatus: ProcessingStatus.READY });

    tourA = await insertTour(coverAssetA.id, 'Tour A');
    sceneA = await insertScene(tourA.id, sceneAssetA.id);
    tourB = await insertTour(coverAssetB.id, 'Tour B');
  });

  afterEach(async () => {
    if (sceneA.id !== '') await prisma.scene.delete({ where: { id: sceneA.id } }).catch(() => {});
    if (tourB.id !== '') await prisma.tour.delete({ where: { id: tourB.id } }).catch(() => {});
    if (tourA.id !== '') await prisma.tour.delete({ where: { id: tourA.id } }).catch(() => {});
    if (hotel.id !== '') await prisma.hotel.delete({ where: { id: hotel.id } }).catch(() => {});
    if (city.id !== '') await prisma.city.delete({ where: { id: city.id } }).catch(() => {});
    if (coverAssetB.id !== '') await prisma.asset.delete({ where: { id: coverAssetB.id } }).catch(() => {});
    if (sceneAssetA.id !== '') await prisma.asset.delete({ where: { id: sceneAssetA.id } }).catch(() => {});
    if (coverAssetA.id !== '') await prisma.asset.delete({ where: { id: coverAssetA.id } }).catch(() => {});
  });

  it('GET /api/v1/admin/assets/folders renvoie count=2 pour tourA (cover + 1 scène avec un second asset) et count=1 pour tourB (cover dédiée)', async () => {
    const afterRes = await read('/api/v1/admin/assets/folders', editor);
    expect(afterRes.statusCode).toBe(200);
    const after = AssetFoldersResponseSchema.parse(parseJson(afterRes.body));

    expect(after.total).toBe(beforeTotal + 3);
    expect(after.unusedCount).toBe(beforeUnused);

    const tourAAfter = after.tours.find((t) => t.id === tourA.id);
    expect(tourAAfter).toBeDefined();
    expect(tourAAfter?.count).toBe(2);

    const tourBAfter = after.tours.find((t) => t.id === tourB.id);
    expect(tourBAfter).toBeDefined();
    expect(tourBAfter?.count).toBe(1);
  });
});

async function insertAsset(
  kind: AssetKind,
  createdAt: string,
  extra: {
    width?: number;
    height?: number;
    copyright?: string;
    processingStatus?: ProcessingStatus;
  } = {},
): Promise<{ id: string }> {
  return prisma.asset.create({
    data: {
      kind,
      originalKey: `int/${kind}-${createdAt}.bin`,
      mimeType: kind === AssetKind.AUDIO ? 'audio/mpeg' : 'image/jpeg',
      sizeBytes: 128,
      width: extra.width ?? null,
      height: extra.height ?? null,
      contentHash: `assets-int-${kind}-${createdAt}`,
      processingStatus: extra.processingStatus ?? ProcessingStatus.PENDING,
      copyright: extra.copyright ?? null,
      createdAt: new Date(createdAt),
    },
    select: { id: true },
  });
}

async function listAssets(editor: Session, query: string): Promise<PaginatedAssetResponse> {
  const response = await read(`/api/v1/admin/assets?${query}`, editor);
  expect(response.statusCode).toBe(200);
  return PaginatedAssetResponseSchema.parse(parseJson(response.body));
}

async function read(url: string, session: Session): Promise<Injected> {
  return application().inject({
    method: 'GET',
    url,
    headers: { cookie: sessionCookie(session.sessionId) },
  });
}

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();

  const application = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  await application.register(fastifyCookie);
  application
    .getHttpAdapter()
    .getInstance()
    .decorate('sessionCookie', {
      name: SESSION_COOKIE_NAME,
      ...sessionCookieOptions(env.NODE_ENV === 'production'),
    });
  application.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'api/health', method: RequestMethod.GET }],
  });
  await application.init();
  await application.getHttpAdapter().getInstance().ready();
  return application;
}

function integrationEnv(): Env {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl === undefined || redisUrl.trim() === '') {
    throw new Error(MISSING_REDIS_URL);
  }
  return loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'xplor',
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'xplor-dev-secret',
    S3_BUCKET: process.env.S3_BUCKET ?? 'xplor',
    SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
    SMTP_PORT: process.env.SMTP_PORT ?? '1025',
    SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-session-secret-not-for-production',
    ADMIN_BASE_URL: process.env.ADMIN_BASE_URL,
  });
}

async function seedDemoUsers(): Promise<void> {
  const users = buildSeedUsers(seedPassword, passwordHash);
  for (const user of users) {
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        role: toPrismaRole(user.role),
        active: user.active,
        uiLang: user.uiLang,
      },
    });
  }
}

async function flushSessions(client: Redis): Promise<void> {
  await deleteByPattern(client, 'sess:*');
  await deleteByPattern(client, 'user-sess:*');
}

async function deleteByPattern(client: Redis, pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const scanned: [string, string[]] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = scanned[0];
    const keys = scanned[1];
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== '0');
}

function application(): NestFastifyApplication {
  if (app === undefined) {
    throw new Error('application non démarrée');
  }
  return app;
}

function requireRedis(): Redis {
  if (redis === undefined) {
    throw new Error('Redis non démarré');
  }
  return redis;
}

async function login(email: string): Promise<Session> {
  const response = await application().inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password: seedPassword }),
  });
  expect(response.statusCode).toBe(200);
  const me = MeResponseSchema.parse(parseJson(response.body));
  return { sessionId: requireSessionCookie(response), csrfToken: me.csrfToken, userId: me.id };
}

function sessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

function requireSessionCookie(response: Injected): string {
  const raw = response.headers['set-cookie'];
  const headers = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  for (const header of headers) {
    const match = /^xplor_sid=([^;]+)/.exec(header);
    const value = match?.[1];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  throw new Error('cookie xplor_sid absent');
}

function parseJson(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function jsonKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('corps JSON inattendu');
  }
  return Object.keys(value).sort();
}

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') {
    throw new Error(MISSING_SEED_PASSWORD);
  }
  return password;
}
