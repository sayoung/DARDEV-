/**
 * CRUD HTTP des scènes (API-22, partie 1).
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AssetKind, PrismaClient } from '@prisma/client';
import {
  CategoryResponseSchema,
  CityResponseSchema,
  MeResponseSchema,
  SceneResponseSchema,
  TourResponseSchema,
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
import {
  PANORAMA_ASSET_NOT_FOUND,
  PANORAMA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
} from '../src/catalog/catalog.errors.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration des scènes en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des scènes ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

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

describe('scènes HTTP', () => {
  it('répond 401 sans session', async () => {
    const list = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
    });
    const create = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(list.statusCode).toBe(401);
    expect(create.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF', async () => {
    const session = await login(EDITOR_EMAIL);
    const response = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(session.sessionId),
      },
      payload: '{}',
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuse la lecture et l’écriture à PARTNER et HOTEL_MANAGER', async () => {
    const partner = await login(PARTNER_EMAIL);
    const partnerRead = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
      headers: { cookie: sessionCookie(partner.sessionId) },
    });
    expect(partnerRead.statusCode).toBe(403);
    const partnerWrite = await send(
      'POST',
      `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
      partner,
      refusedScene(),
    );
    expect(partnerWrite.statusCode).toBe(403);

    const manager = await login(MANAGER_EMAIL);
    const managerRead = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${UNKNOWN_ID}`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(managerRead.statusCode).toBe(403);
    const managerWrite = await send(
      'POST',
      `/api/v1/admin/tours/${UNKNOWN_ID}/scenes`,
      manager,
      refusedScene(),
    );
    expect(managerWrite.statusCode).toBe(403);
  });

  it('fait de la première scène la scène de départ', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const created = await createScene(editor, ready.tour.id, {
      title: { fr: 'La porte', ar: 'الباب', en: 'The gate' },
      panoramaAssetId: ready.panoramaAssetId,
      weight: 0,
    });
    expect(created.tourId).toBe(ready.tour.id);
    expect(created.initialYaw).toBe(0);
    expect(created.initialPitch).toBe(0);
    expect(created.initialZoom).toBe(50);
    expect(created.hotspotCount).toBe(0);
    expect(created.weight).toBe(0);

    const row = await prisma.scene.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.createdById).toBe(editor.userId);
    expect(row.deletedAt).toBeNull();
    const tour = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(tour.startSceneId).toBe(created.id);
    expect(tour.contentVersion).toBe(2);

    const second = await createScene(editor, ready.tour.id, {
      title: { fr: 'Le jardin' },
      panoramaAssetId: ready.panoramaAssetId,
      weight: 1,
    });
    const after = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(after.startSceneId).toBe(created.id);
    expect(second.id).not.toBe(created.id);
    expect(after.contentVersion).toBe(3);
  });

  it('répond 422 si le panorama est inconnu', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const response = await send('POST', `/api/v1/admin/tours/${ready.tour.id}/scenes`, editor, {
      title: { fr: 'Sans panorama' },
      panoramaAssetId: UNKNOWN_ID,
      weight: 0,
    });
    expect(response.statusCode).toBe(422);
    expect(parseJson(response.body)).toEqual({
      error: { code: PANORAMA_ASSET_NOT_FOUND, message: PANORAMA_ASSET_NOT_FOUND_MESSAGE },
    });
    expect(await prisma.scene.count()).toBe(0);
    const tour = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(tour.startSceneId).toBeNull();
  });

  it('répond 404 après suppression et remet startSceneId à null', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const created = await createScene(editor, ready.tour.id, {
      title: { fr: 'La porte' },
      panoramaAssetId: ready.panoramaAssetId,
      weight: 0,
    });
    const removed = await send('DELETE', `/api/v1/admin/scenes/${created.id}`, editor);
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe('');

    const read = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${created.id}`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(read.statusCode).toBe(404);
    expect(parseJson(read.body)).toEqual({
      error: { code: SCENE_NOT_FOUND, message: SCENE_NOT_FOUND_MESSAGE },
    });

    const scene = await prisma.scene.findUniqueOrThrow({ where: { id: created.id } });
    expect(scene.deletedAt).toBeInstanceOf(Date);
    const tour = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(tour.startSceneId).toBeNull();

    const list = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/tours/${ready.tour.id}/scenes`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(list.statusCode).toBe(200);
    expect(parseJson(list.body)).toEqual([]);
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

function refusedScene(): { title: { fr: string }; panoramaAssetId: string; weight: number } {
  return {
    title: { fr: 'Refusée' },
    panoramaAssetId: UNKNOWN_ID,
    weight: 0,
  };
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
      contentHash: `scenes-cover-${city.id}`,
    },
  });
  const panorama = await prisma.asset.create({
    data: {
      kind: AssetKind.PANORAMA,
      originalKey: `int/pano-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 256,
      contentHash: `scenes-pano-${city.id}`,
    },
  });
  const tour = await createTour(editor, {
    title: { fr: 'Kasbah des Oudayas' },
    summary: { fr: 'Remparts face à la mer' },
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
  body: unknown,
): Promise<SceneResponse> {
  const response = await send('POST', `/api/v1/admin/tours/${tourId}/scenes`, editor, body);
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
