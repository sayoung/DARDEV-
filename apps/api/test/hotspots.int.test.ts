/**
 * Liste et création HTTP des hotspots (API-23, partie 2).
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
  HotspotResponseSchema,
  MeResponseSchema,
  SceneResponseSchema,
  TourResponseSchema,
  type CategoryCreate,
  type CityCreate,
  type HotspotResponse,
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
  SCENE_LINK_FOREIGN,
  SCENE_LINK_FOREIGN_MESSAGE,
  SCENE_LINK_SELF,
  SCENE_LINK_SELF_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
} from '../src/catalog/catalog.errors.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration des hotspots en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des hotspots ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const EDITOR_EMAIL = 'editor@xplor.local';
const PARTNER_EMAIL = 'partner@xplor.local';
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

describe('hotspots HTTP', () => {
  it('répond 401 sans session', async () => {
    const list = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${UNKNOWN_ID}/hotspots`,
    });
    const create = await application().inject({
      method: 'POST',
      url: `/api/v1/admin/scenes/${UNKNOWN_ID}/hotspots`,
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
      url: `/api/v1/admin/scenes/${UNKNOWN_ID}/hotspots`,
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(session.sessionId),
      },
      payload: '{}',
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuse la lecture et l’écriture à PARTNER', async () => {
    const partner = await login(PARTNER_EMAIL);
    const read = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${UNKNOWN_ID}/hotspots`,
      headers: { cookie: sessionCookie(partner.sessionId) },
    });
    expect(read.statusCode).toBe(403);
    const write = await send('POST', `/api/v1/admin/scenes/${UNKNOWN_ID}/hotspots`, partner, {
      type: 'INFO',
    });
    expect(write.statusCode).toBe(403);
  });

  it('crée un SCENE_LINK et le GET le renvoie', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const garden = await createScene(editor, ready.tour.id, {
      title: { fr: 'Le jardin' },
      panoramaAssetId: ready.panoramaAssetId,
      weight: 1,
    });
    const before = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });

    const response = await send('POST', `/api/v1/admin/scenes/${ready.gate.id}/hotspots`, editor, {
      type: 'SCENE_LINK',
      yaw: 0.4,
      pitch: -0.2,
      label: { fr: 'Vers le jardin', ar: 'نحو الحديقة', en: 'To the garden' },
      targetSceneId: garden.id,
    });
    expect(response.statusCode).toBe(201);
    const created = HotspotResponseSchema.parse(parseJson(response.body));
    expect(created).toMatchObject({
      sceneId: ready.gate.id,
      type: 'SCENE_LINK',
      yaw: 0.4,
      pitch: -0.2,
      label: { fr: 'Vers le jardin', ar: 'نحو الحديقة', en: 'To the garden' },
      targetSceneId: garden.id,
      targetTourId: null,
      targetTourSceneId: null,
      body: null,
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: 'ARROW',
    });

    const row = await prisma.hotspot.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.createdById).toBe(editor.userId);
    const tour = await prisma.tour.findUniqueOrThrow({ where: { id: ready.tour.id } });
    expect(tour.contentVersion).toBe(before.contentVersion + 1);

    const list = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${ready.gate.id}/hotspots`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(list.statusCode).toBe(200);
    expect(parseHotspotList(list.body)).toEqual([created]);
  });

  it('répond 422 SCENE_LINK_SELF et SCENE_LINK_FOREIGN', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const other = await prepare(editor);

    const self = await send('POST', `/api/v1/admin/scenes/${ready.gate.id}/hotspots`, editor, {
      type: 'SCENE_LINK',
      yaw: 0,
      pitch: 0,
      label: { fr: 'Soi' },
      targetSceneId: ready.gate.id,
    });
    expect(self.statusCode).toBe(422);
    expect(parseJson(self.body)).toEqual({
      error: { code: SCENE_LINK_SELF, message: SCENE_LINK_SELF_MESSAGE },
    });

    const foreign = await send('POST', `/api/v1/admin/scenes/${ready.gate.id}/hotspots`, editor, {
      type: 'SCENE_LINK',
      yaw: 0,
      pitch: 0,
      label: { fr: 'Ailleurs' },
      targetSceneId: other.gate.id,
    });
    expect(foreign.statusCode).toBe(422);
    expect(parseJson(foreign.body)).toEqual({
      error: { code: SCENE_LINK_FOREIGN, message: SCENE_LINK_FOREIGN_MESSAGE },
    });
    expect(await prisma.hotspot.count()).toBe(0);
  });

  it('répond 404 sur une scène supprimée', async () => {
    const editor = await login(EDITOR_EMAIL);
    const ready = await prepare(editor);
    const removed = await send('DELETE', `/api/v1/admin/scenes/${ready.gate.id}`, editor);
    expect(removed.statusCode).toBe(204);

    const create = await send('POST', `/api/v1/admin/scenes/${ready.gate.id}/hotspots`, editor, {
      type: 'INFO',
      yaw: 0,
      pitch: 0,
      label: { fr: 'Notice' },
      body: { fr: 'Texte' },
    });
    expect(create.statusCode).toBe(404);
    expect(parseJson(create.body)).toEqual({
      error: { code: SCENE_NOT_FOUND, message: SCENE_NOT_FOUND_MESSAGE },
    });

    const list = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/scenes/${ready.gate.id}/hotspots`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(list.statusCode).toBe(404);
    expect(parseJson(list.body)).toEqual({
      error: { code: SCENE_NOT_FOUND, message: SCENE_NOT_FOUND_MESSAGE },
    });
  });
});

interface Ready {
  tour: TourResponse;
  panoramaAssetId: string;
  gate: SceneResponse;
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
      contentHash: `hotspots-cover-${city.id}`,
    },
  });
  const panorama = await prisma.asset.create({
    data: {
      kind: AssetKind.PANORAMA,
      originalKey: `int/pano-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 256,
      contentHash: `hotspots-pano-${city.id}`,
    },
  });
  const tour = await createTour(editor, {
    title: { fr: `Kasbah ${city.id}` },
    summary: { fr: 'Remparts face à la mer' },
    cityId: city.id,
    categoryIds: [category.id],
    coverAssetId: cover.id,
  });
  const gate = await createScene(editor, tour.id, {
    title: { fr: 'La porte' },
    panoramaAssetId: panorama.id,
    weight: 0,
  });
  return { tour, panoramaAssetId: panorama.id, gate };
}

async function createTour(editor: Session, body: TourCreate): Promise<TourResponse> {
  const response = await send('POST', '/api/v1/admin/tours', editor, body);
  expect(response.statusCode).toBe(201);
  return TourResponseSchema.parse(parseJson(response.body));
}

async function createScene(editor: Session, tourId: string, body: unknown): Promise<SceneResponse> {
  const response = await send('POST', `/api/v1/admin/tours/${tourId}/scenes`, editor, body);
  expect(response.statusCode).toBe(201);
  return SceneResponseSchema.parse(parseJson(response.body));
}

function parseHotspotList(body: string): HotspotResponse[] {
  const parsed = parseJson(body);
  if (!Array.isArray(parsed)) {
    throw new Error('liste de hotspots attendue');
  }
  return parsed.map((item) => HotspotResponseSchema.parse(item));
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
