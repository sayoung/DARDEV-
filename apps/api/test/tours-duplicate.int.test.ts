/**
 * Duplication d'une visite (F-01).
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AssetKind, PrismaClient, ProcessingStatus, TourStatus as PrismaTourStatus } from '@prisma/client';
import {
  CategoryResponseSchema,
  CityResponseSchema,
  HotspotResponseSchema,
  HotspotType,
  MeResponseSchema,
  SceneResponseSchema,
  TourResponseSchema,
  TourStatus,
  type CategoryCreate,
  type CityCreate,
  type HotspotResponse,
  type SceneResponse,
  type TourCreate,
  type TourResponse,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '../src/app.module.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE } from '../src/catalog/catalog.errors.js';
import { DUPLICATE_FR_TITLE_SUFFIX } from '../src/catalog/tour-duplicate.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration de la duplication en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP de la duplication ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const ADMIN_EMAIL = 'admin@xplor.local';
const EDITOR_EMAIL = 'editor@xplor.local';
const PARTNER_EMAIL = 'partner@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';
const UNKNOWN_ID = '01990000-0000-7000-8000-0000000000aa';

const cityBody: CityCreate = {
  name: { fr: 'Testville', ar: 'تجربة', en: 'Testville' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.02,
  lng: -6.84,
};

const categoryBody: CategoryCreate = {
  name: { fr: 'Test catégorie', ar: 'تصنيف', en: 'Test category' },
  icon: 'landmark',
  color: '#1F6F8B',
  weight: 1,
};

const secondCategoryBody: CategoryCreate = {
  name: { fr: 'Autre catégorie', ar: 'آخر', en: 'Other category' },
  icon: 'park',
  color: '#C4A35A',
  weight: 2,
};

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

describe('duplication de visite', () => {
  it('répond 401 sans session', async () => {
    const response = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/tours/${UNKNOWN_ID}/duplicate`,
    });
    expect(response.statusCode).toBe(401);
  });

  it('refuse PARTNER et HOTEL_MANAGER', async () => {
    const partner = await login(PARTNER_EMAIL);
    const partnerCall = await send('POST', `/api/v1/admin/tours/${UNKNOWN_ID}/duplicate`, partner);
    expect(partnerCall.statusCode).toBe(403);

    const manager = await login(MANAGER_EMAIL);
    const managerCall = await send('POST', `/api/v1/admin/tours/${UNKNOWN_ID}/duplicate`, manager);
    expect(managerCall.statusCode).toBe(403);
  });

  it('répond 404 TOUR_NOT_FOUND si la visite est absente ou supprimée', async () => {
    const editor = await login(EDITOR_EMAIL);
    const missing = await send('POST', `/api/v1/admin/tours/${UNKNOWN_ID}/duplicate`, editor);
    expect(missing.statusCode).toBe(404);
    expect(parseJson(missing.body)).toEqual({
      error: { code: TOUR_NOT_FOUND, message: TOUR_NOT_FOUND_MESSAGE },
    });

    const ready = await prepare(editor);
    const removed = await send('DELETE', `/api/v1/admin/tours/${ready.tour.id}`, editor);
    expect(removed.statusCode).toBe(204);
    const gone = await send('POST', `/api/v1/admin/tours/${ready.tour.id}/duplicate`, editor);
    expect(gone.statusCode).toBe(404);
    expect(parseJson(gone.body)).toEqual({
      error: { code: TOUR_NOT_FOUND, message: TOUR_NOT_FOUND_MESSAGE },
    });
  });

  it('copie trois scènes et remappe les SCENE_LINK hors de la source', async () => {
    const editor = await login(EDITOR_EMAIL);
    const admin = await login(ADMIN_EMAIL);
    const ready = await prepare(editor);
    const other = await createTour(editor, {
      title: { fr: 'Jardin de Salé' },
      summary: { fr: 'Visite cible' },
      cityId: ready.cityId,
      categoryIds: [ready.categoryIds[0] ?? missingCategory()],
      coverAssetId: ready.coverAssetId,
    });
    const arrival = await createScene(editor, other.id, 'Entrée', ready.panoramaAssetId, 0);

    const porte = await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);
    const jardin = await createScene(editor, ready.tour.id, 'Jardin', ready.panoramaAssetId, 1);
    const remparts = await createScene(editor, ready.tour.id, 'Remparts', ready.panoramaAssetId, 2);
    const annexe = await createScene(editor, ready.tour.id, 'Annexe', ready.panoramaAssetId, 3);

    expect(
      (await send('POST', `/api/v1/admin/scenes/${porte.id}/hotspots`, editor, {
        type: 'SCENE_LINK',
        yaw: 0.2,
        pitch: 0,
        label: { fr: 'Vers le jardin' },
        targetSceneId: jardin.id,
      })).statusCode,
    ).toBe(201);
    expect(
      (await send('POST', `/api/v1/admin/scenes/${porte.id}/hotspots`, editor, {
        type: 'SCENE_LINK',
        yaw: 1.2,
        pitch: 0,
        label: { fr: "Vers l'annexe" },
        targetSceneId: annexe.id,
      })).statusCode,
    ).toBe(201);
    expect(
      (await send('POST', `/api/v1/admin/scenes/${jardin.id}/hotspots`, editor, {
        type: 'SCENE_LINK',
        yaw: 1,
        pitch: 0,
        label: { fr: 'Vers les remparts' },
        targetSceneId: remparts.id,
      })).statusCode,
    ).toBe(201);
    expect(
      (await send('POST', `/api/v1/admin/scenes/${remparts.id}/hotspots`, editor, {
        type: 'TOUR_LINK',
        yaw: 2,
        pitch: 0.1,
        label: { fr: 'Vers Salé', ar: 'نحو سلا' },
        targetTourId: other.id,
        targetTourSceneId: arrival.id,
      })).statusCode,
    ).toBe(201);

    const removed = await send('DELETE', `/api/v1/admin/scenes/${annexe.id}`, editor);
    expect(removed.statusCode).toBe(204);

    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: {
        status: PrismaTourStatus.PUBLISHED,
        publicShare: true,
        publishedAt: new Date(),
      },
    });
    const before = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });

    const response = await send('POST', `/api/v1/admin/tours/${ready.tour.id}/duplicate`, admin);
    expect(response.statusCode).toBe(201);
    const copy = TourResponseSchema.parse(parseJson(response.body));

    expect(copy.id).not.toBe(ready.tour.id);
    expect(copy.status).toBe(TourStatus.DRAFT);
    expect(copy.publicShare).toBe(false);
    expect(copy.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(copy.shareToken).not.toBe(before.shareToken);
    expect(copy.title).toEqual({
      fr: `Visite manuelle${DUPLICATE_FR_TITLE_SUFFIX}`,
      ar: 'زيارة',
      en: 'Manual tour',
    });
    expect(copy.summary).toEqual(ready.tour.summary);
    expect(copy.categoryIds).toEqual(ready.categoryIds);
    expect(copy.cityId).toBe(ready.cityId);
    expect(copy.coverAssetId).toBe(ready.coverAssetId);
    expect(copy.createdById).toBe(admin.userId);
    expect(copy.contentVersion).toBe(1);
    expect(copy.sceneCount).toBe(3);

    const stored = await prisma.tour.findUniqueOrThrow({ where: { id: copy.id } });
    expect(stored.publishedAt).toBeNull();
    expect(stored.status).toBe(PrismaTourStatus.DRAFT);
    expect(stored.publicShare).toBe(false);

    const sourceAfter = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(sourceAfter.shareToken).toBe(before.shareToken);
    expect(sourceAfter.status).toBe(PrismaTourStatus.PUBLISHED);
    expect(sourceAfter.publicShare).toBe(true);
    expect(sourceAfter.contentVersion).toBe(before.contentVersion);
    expect(sourceAfter.title).toEqual(before.title);

    const scenes = z
      .array(SceneResponseSchema)
      .parse(parseJson((await send('GET', `/api/v1/admin/tours/${copy.id}/scenes`, admin)).body));
    expect(scenes.map((scene) => scene.title.fr)).toEqual(['Porte', 'Jardin', 'Remparts']);
    expect(scenes.map((scene) => scene.weight)).toEqual([0, 1, 2]);

    const porteCopy = sceneNamed(scenes, 'Porte');
    const jardinCopy = sceneNamed(scenes, 'Jardin');
    const rempartsCopy = sceneNamed(scenes, 'Remparts');
    const sourceSceneIds = new Set([porte.id, jardin.id, remparts.id, annexe.id]);

    const porteLinks = await listHotspots(admin, porteCopy.id);
    const jardinLinks = await listHotspots(admin, jardinCopy.id);
    const rempartsLinks = await listHotspots(admin, rempartsCopy.id);
    const copied = [...porteLinks, ...jardinLinks, ...rempartsLinks];

    expect(copied).toHaveLength(4);
    for (const hotspot of copied) {
      expect(sourceSceneIds.has(hotspot.sceneId)).toBe(false);
      if (hotspot.targetSceneId !== null) {
        expect(sourceSceneIds.has(hotspot.targetSceneId)).toBe(false);
      }
    }

    expect(hotspotNamed(porteLinks, 'Vers le jardin')).toMatchObject({
      type: HotspotType.SCENE_LINK,
      targetSceneId: jardinCopy.id,
      targetTourId: null,
    });
    expect(hotspotNamed(porteLinks, "Vers l'annexe")).toMatchObject({
      type: HotspotType.SCENE_LINK,
      targetSceneId: null,
    });
    expect(hotspotNamed(jardinLinks, 'Vers les remparts')).toMatchObject({
      type: HotspotType.SCENE_LINK,
      targetSceneId: rempartsCopy.id,
    });
    expect(hotspotNamed(rempartsLinks, 'Vers Salé')).toMatchObject({
      type: HotspotType.TOUR_LINK,
      targetSceneId: null,
      targetTourId: other.id,
      targetTourSceneId: arrival.id,
    });

    const copyRow = await prisma.tour.findUniqueOrThrow({ where: { id: copy.id } });
    expect(copyRow.startSceneId).toBe(porteCopy.id);
    expect(copyRow.startSceneId).not.toBe(porte.id);

    const authored = await prisma.scene.findMany({
      where: { tourId: copy.id },
      include: { hotspots: true },
    });
    expect(authored).toHaveLength(3);
    for (const scene of authored) {
      expect(scene.createdById).toBe(admin.userId);
      for (const hotspot of scene.hotspots) {
        expect(hotspot.createdById).toBe(admin.userId);
      }
    }
  });
});

interface Session {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

interface Ready {
  tour: TourResponse;
  cityId: string;
  categoryIds: string[];
  coverAssetId: string;
  panoramaAssetId: string;
}

function missingCategory(): never {
  throw new Error('catégorie absente');
}

async function prepare(editor: Session): Promise<Ready> {
  const city = CityResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/cities', editor, cityBody)).body),
  );
  const category = CategoryResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/categories', editor, categoryBody)).body),
  );
  const second = CategoryResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/categories', editor, secondCategoryBody)).body),
  );
  const cover = await prisma.asset.create({
    data: {
      kind: AssetKind.IMAGE,
      originalKey: `int/cover-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      contentHash: `duplicate-cover-${city.id}`,
    },
  });
  const panorama = await prisma.asset.create({
    data: {
      kind: AssetKind.PANORAMA,
      originalKey: `int/pano-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 256,
      contentHash: `duplicate-pano-${city.id}`,
      processingStatus: ProcessingStatus.READY,
    },
  });
  const categoryIds = [category.id, second.id];
  const tour = await createTour(editor, {
    title: { fr: 'Visite manuelle', ar: 'زيارة', en: 'Manual tour' },
    summary: { fr: 'Porte, jardin et remparts' },
    description: { fr: 'Texte de la visite' },
    cityId: city.id,
    categoryIds,
    coverAssetId: cover.id,
    durationMinutes: 20,
    lat: 34.02,
    lng: -6.84,
  });
  return { tour, cityId: city.id, categoryIds, coverAssetId: cover.id, panoramaAssetId: panorama.id };
}

async function createTour(editor: Session, body: TourCreate): Promise<TourResponse> {
  const response = await send('POST', '/api/v1/admin/tours', editor, body);
  expect(response.statusCode).toBe(201);
  return TourResponseSchema.parse(parseJson(response.body));
}

async function createScene(
  editor: Session,
  tourId: string,
  title: string,
  panoramaAssetId: string,
  weight: number,
): Promise<SceneResponse> {
  const response = await send('POST', `/api/v1/admin/tours/${tourId}/scenes`, editor, {
    title: { fr: title },
    panoramaAssetId,
    weight,
  });
  expect(response.statusCode).toBe(201);
  return SceneResponseSchema.parse(parseJson(response.body));
}

async function listHotspots(session: Session, sceneId: string): Promise<HotspotResponse[]> {
  const response = await send('GET', `/api/v1/admin/scenes/${sceneId}/hotspots`, session);
  expect(response.statusCode).toBe(200);
  return z.array(HotspotResponseSchema).parse(parseJson(response.body));
}

function sceneNamed(scenes: readonly SceneResponse[], title: string): SceneResponse {
  const scene = scenes.find((item) => item.title.fr === title);
  if (scene === undefined) {
    throw new Error(`scène ${title} absente`);
  }
  return scene;
}

function hotspotNamed(hotspots: readonly HotspotResponse[], label: string): HotspotResponse {
  const hotspot = hotspots.find((item) => item.label.fr === label);
  if (hotspot === undefined) {
    throw new Error(`hotspot ${label} absent`);
  }
  return hotspot;
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

function send(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  session: Session,
  body?: unknown,
): Promise<Injected> {
  const headers: Record<string, string> = {
    cookie: sessionCookie(session.sessionId),
    'x-csrf-token': session.csrfToken,
  };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return application().inject({
    method,
    url,
    headers,
    payload: body === undefined ? undefined : JSON.stringify(body),
  });
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

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') {
    throw new Error(MISSING_SEED_PASSWORD);
  }
  return password;
}
