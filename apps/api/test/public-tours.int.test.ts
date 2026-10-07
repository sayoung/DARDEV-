/**
 * Route publique des visites partagées (API-11).
 * GET /public/tours/:token
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AssetKind, PrismaClient, ProcessingStatus } from '@prisma/client';
import {
  CategoryResponseSchema,
  CityResponseSchema,
  HotspotType,
  MeResponseSchema,
  SceneResponseSchema,
  TourResponseSchema,
  TourGraphSchema,
  type CategoryCreate,
  type CityCreate,
  type SceneResponse,
  type TourCreate,
  type TourResponse,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { signPreviewToken } from '../src/catalog/preview-token.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration de la route publique en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP de la route publique ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const EDITOR_EMAIL = 'editor@xplor.local';

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

describe('public tours API', () => {
  it('GET /public/tours/:token?lang=fr -> 200, 2 scenes, no original prefixes', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const porte = await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);
    const jardin = await createScene(editor, ready.tour.id, 'Jardin', ready.panoramaAssetId, 1);

    await send('POST', `/api/v1/admin/scenes/${porte.id}/hotspots`, editor, {
      type: 'SCENE_LINK',
      yaw: 0.2,
      pitch: 0,
      label: { fr: 'Vers le jardin' },
      targetSceneId: jardin.id,
    });

    await send('POST', `/api/v1/admin/tours/${ready.tour.id}/publish`, editor);

    const token = 'token-123';
    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: { publicShare: true, shareToken: token },
    });

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${token}?lang=fr`,
    });

    expect(response.statusCode).toBe(200);
    const graph = TourGraphSchema.parse(parseJson(response.body));

    expect(graph.scenes).toHaveLength(2);
    expect(graph.scenes[0]?.id).toBe(porte.id);
    expect(graph.scenes[1]?.id).toBe(jardin.id);
    expect(graph.startSceneId).toBe(porte.id);

    const hotspots = graph.scenes[0]?.hotspots;
    expect(hotspots).toHaveLength(1);
    expect(hotspots?.[0]).toEqual(
      expect.objectContaining({
        type: HotspotType.SCENE_LINK,
        targetSceneId: jardin.id,
      }),
    );

    const bodyStr = response.body;
    expect(bodyStr).not.toContain('int/pano-');
    expect(bodyStr).not.toContain('int/cover-');
  });

  it('GET /public/tours/:token -> 404 if publicShare is false', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);
    await send('POST', `/api/v1/admin/tours/${ready.tour.id}/publish`, editor);

    const token = 'token-pub-false';
    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: { publicShare: false, shareToken: token },
    });

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${token}?lang=fr`,
    });
    expect(response.statusCode).toBe(404);
  });

  it('GET /public/tours/:token -> 404 if DRAFT', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);

    const token = 'token-draft';
    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: { publicShare: true, shareToken: token },
    });

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${token}?lang=fr`,
    });
    expect(response.statusCode).toBe(404);
  });

  it('GET /public/tours/:token -> 404 if deleted', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);
    await send('POST', `/api/v1/admin/tours/${ready.tour.id}/publish`, editor);

    const token = 'token-deleted';
    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: { publicShare: true, shareToken: token, deletedAt: new Date() },
    });

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${token}?lang=fr`,
    });
    expect(response.statusCode).toBe(404);
  });

  it('GET /public/tours/:token -> 404 if unknown token', async () => {
    const response = await application().inject({
      method: 'GET',
      url: '/api/v1/public/tours/token-unknown?lang=fr',
    });
    expect(response.statusCode).toBe(404);
  });

  it('GET /public/tours/:token?lang=xx -> 400', async () => {
    const response = await application().inject({
      method: 'GET',
      url: '/api/v1/public/tours/any-token?lang=xx',
    });
    expect(response.statusCode).toBe(400);
  });

  it('TOUR_LINK hotspot to non-shared tour is absent from graph', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const porte = await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);
    const jardin = await createScene(editor, ready.tour.id, 'Jardin', ready.panoramaAssetId, 1);

    const tour2 = await createTour(editor, {
      title: { fr: 'Visite 2' },
      summary: { fr: '...' },
      cityId: ready.tour.cityId,
      categoryIds: ready.tour.categoryIds,
      coverAssetId: ready.tour.coverAssetId,
    });
    const ready2 = { tour: tour2, panoramaAssetId: ready.panoramaAssetId };
    await createScene(editor, ready2.tour.id, 'Scene2', ready2.panoramaAssetId, 0);
    await send('POST', `/api/v1/admin/tours/${ready2.tour.id}/publish`, editor);

    await send('POST', `/api/v1/admin/scenes/${porte.id}/hotspots`, editor, {
      type: 'TOUR_LINK',
      yaw: 0.5,
      pitch: 0,
      label: { fr: 'Vers autre visite' },
      targetTourId: ready2.tour.id,
    });

    await send('POST', `/api/v1/admin/scenes/${porte.id}/hotspots`, editor, {
      type: 'SCENE_LINK',
      yaw: 0.2,
      pitch: 0,
      label: { fr: 'Vers le jardin' },
      targetSceneId: jardin.id,
    });

    await send('POST', `/api/v1/admin/tours/${ready.tour.id}/publish`, editor);

    const token = 'token-link';
    await prisma.tour.update({
      where: { id: ready.tour.id },
      data: { publicShare: true, shareToken: token },
    });

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${token}?lang=fr`,
    });
    expect(response.statusCode).toBe(200);
    const graph = TourGraphSchema.parse(parseJson(response.body));

    const hotspots = graph.scenes[0]?.hotspots;
    expect(hotspots).toHaveLength(1);
    expect(hotspots?.[0]).toEqual(
      expect.objectContaining({
        type: HotspotType.SCENE_LINK,
        targetSceneId: jardin.id,
      }),
    );
    expect(hotspots?.some((h) => h.type === HotspotType.TOUR_LINK)).toBe(false);
  });
});

describe('public preview API', () => {
  it('GET /public/preview/:token?lang=fr -> 200, DRAFT tour graph, Cache-Control no-store', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const porte = await createScene(editor, ready.tour.id, 'Porte', ready.panoramaAssetId, 0);

    const env = integrationEnv();
    const tokenData = signPreviewToken(ready.tour.id, env.SESSION_SECRET, Date.now());

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/preview/${tokenData.token}?lang=fr`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const graph = TourGraphSchema.parse(parseJson(response.body));
    expect(graph.scenes).toHaveLength(1);
    expect(graph.scenes[0]?.id).toBe(porte.id);
  });

  it('GET /public/preview/:token -> 404 if expired token', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);

    const env = integrationEnv();
    // Simulate expired token by passing a time from the past (> 1 hour ago)
    const tokenData = signPreviewToken(ready.tour.id, env.SESSION_SECRET, Date.now() - 3601 * 1000);

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/preview/${tokenData.token}?lang=fr`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /public/preview/:token -> 404 if tampered token', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);

    const env = integrationEnv();
    const tokenData = signPreviewToken(ready.tour.id, env.SESSION_SECRET, Date.now());
    
    const tamperedToken = tokenData.token + 'x';

    const response = await application().inject({
      method: 'GET',
      url: `/api/v1/public/preview/${tamperedToken}?lang=fr`,
    });

    expect(response.statusCode).toBe(404);
  });
});

interface Session {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

interface Ready {
  tour: TourResponse;
  panoramaAssetId: string;
}

async function prepare(editor: Session): Promise<Ready> {
  const city = CityResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/cities', editor, cityBody)).body),
  );
  const category = CategoryResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/categories', editor, categoryBody)).body),
  );
  const cover = await prisma.asset.create({
    data: {
      kind: AssetKind.IMAGE,
      originalKey: `int/cover-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      contentHash: `publication-cover-${city.id}`,
      derivatives: {
        preview: 'derived/preview.jpg',
        web: 'derived/web.jpg',
        thumb: 'derived/thumb.jpg',
        tilesPrefix: 'derived/tiles/',
        tileGrid: { cols: 8, rows: 4, size: 512 },
      },
    },
  });
  const panorama = await prisma.asset.create({
    data: {
      kind: AssetKind.PANORAMA,
      originalKey: `int/pano-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 256,
      contentHash: `publication-pano-${city.id}`,
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
  const tour = await createTour(editor, {
    title: { fr: 'Visite manuelle' },
    summary: { fr: 'Porte, jardin et remparts' },
    cityId: city.id,
    categoryIds: [category.id],
    coverAssetId: cover.id,
  });
  return { tour, panoramaAssetId: panorama.id };
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

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();

  const application = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ maxParamLength: 1000 }),
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
  method: 'POST' | 'PATCH' | 'DELETE',
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
