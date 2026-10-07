/**
 * CRUD HTTP des visites (API-21, partie 1).
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
  PaginatedTourResponseSchema,
  PreviewTokenResponseSchema,
  TourResponseSchema,
  TourStatus,
  type CategoryCreate,
  type CategoryResponse,
  type CityCreate,
  type CityResponse,
  type TourCreate,
  type TourResponse,
  type TourUpdate,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { CITY_NOT_FOUND, CITY_NOT_FOUND_MESSAGE } from '../src/catalog/catalog.errors.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des visites ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const EDITOR_EMAIL = 'editor@xplor.local';
const PARTNER_EMAIL = 'partner@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';
const UNKNOWN_CITY_ID = '01990000-0000-7000-8000-0000000000aa';

const cityBody: CityCreate = {
  name: { fr: 'Testville', ar: 'تجربة', en: 'Testville' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.02,
  lng: -6.84,
};

const otherCityBody: CityCreate = {
  name: { fr: 'Autre ville', ar: 'مدينة', en: 'Other city' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.05,
  lng: -6.75,
};

const categoryBody: CategoryCreate = {
  name: { fr: 'Test catégorie', ar: 'تصنيف', en: 'Test category' },
  icon: 'landmark',
  color: '#1F6F8B',
  weight: 1,
};

const otherCategoryBody: CategoryCreate = {
  ...categoryBody,
  name: { fr: 'Autre catégorie', ar: 'تصنيف آخر', en: 'Other category' },
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

describe('visites HTTP', () => {
  it('répond 401 sans session', async () => {
    const list = await application().inject({ method: 'GET', url: '/api/v1/admin/tours' });
    const create = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/tours',
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
      url: '/api/v1/admin/tours',
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
      url: '/api/v1/admin/tours',
      headers: { cookie: sessionCookie(partner.sessionId) },
    });
    expect(partnerRead.statusCode).toBe(403);
    const partnerWrite = await send('POST', '/api/v1/admin/tours', partner, placeholderTour());
    expect(partnerWrite.statusCode).toBe(403);

    const manager = await login(MANAGER_EMAIL);
    const managerRead = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/tours',
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(managerRead.statusCode).toBe(403);
    const managerWrite = await send('POST', '/api/v1/admin/tours', manager, placeholderTour());
    expect(managerWrite.statusCode).toBe(403);
  });

  it('crée une visite en brouillon, sans partage public', async () => {
    const editor = await login(EDITOR_EMAIL);
    const refs = await prepare(editor);
    const created = await createTour(editor, {
      title: { fr: 'Kasbah des Oudayas', ar: 'قصبة الأوداية', en: 'Oudayas Kasbah' },
      summary: { fr: 'Remparts face à la mer' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });
    expect(created.status).toBe(TourStatus.DRAFT);
    expect(created.publicShare).toBe(false);
    expect(created.shareToken).toHaveLength(22);
    expect(created.createdById).toBe(editor.userId);
    expect(created.sceneCount).toBe(0);
    expect(created.categoryIds).toEqual([refs.category.id]);
    expect(created.startSceneId).toBeNull();
    expect(created.publishedAt).toBeNull();

    const row = await prisma.tour.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('DRAFT');
    expect(row.publicShare).toBe(false);
    expect(row.shareToken).toHaveLength(22);
    expect(row.createdById).toBe(editor.userId);
    expect(row.deletedAt).toBeNull();

    await prisma.scene.create({
      data: {
        tourId: created.id,
        title: { fr: 'La porte' },
        panoramaAssetId: refs.coverAssetId,
        weight: 0,
        createdById: editor.userId,
      },
    });
    await prisma.scene.create({
      data: {
        tourId: created.id,
        title: { fr: 'Remparts retirés' },
        panoramaAssetId: refs.coverAssetId,
        weight: 1,
        createdById: editor.userId,
        deletedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    });
    const read = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/tours/${created.id}`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(read.statusCode).toBe(200);
    expect(TourResponseSchema.parse(parseJson(read.body)).sceneCount).toBe(1);

    const patched = await send('PATCH', `/api/v1/admin/tours/${created.id}`, editor, {
      title: { fr: 'Kasbah des Oudayas' },
      summary: { fr: 'Remparts face à la mer' },
      cityId: refs.city.id,
      categoryIds: [refs.otherCategory.id],
      coverAssetId: refs.coverAssetId,
    });
    expect(patched.statusCode).toBe(200);
    const updated = TourResponseSchema.parse(parseJson(patched.body));
    expect(updated.categoryIds).toEqual([refs.otherCategory.id]);
    expect(updated.contentVersion).toBe(2);
    expect(updated.shareToken).toBe(created.shareToken);
    expect(await prisma.tourCategory.count({ where: { tourId: created.id } })).toBe(1);
  });

  it('filtre la liste par ville et par titre français', async () => {
    const editor = await login(EDITOR_EMAIL);
    const refs = await prepare(editor);
    const kasbah = await createTour(editor, {
      title: { fr: 'Kasbah des Oudayas' },
      summary: { fr: 'Remparts face à la mer' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });
    await createTour(editor, {
      title: { fr: 'Plage de Mehdia' },
      summary: { fr: 'Embouchure du Sebou' },
      cityId: refs.otherCity.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });

    const byCity = await listTours(editor, `cityId=${kasbah.cityId}`);
    expect(byCity.total).toBe(1);
    expect(byCity.items.map((item) => item.id)).toEqual([kasbah.id]);

    const byTitle = await listTours(editor, `q=${encodeURIComponent('kasbah')}`);
    expect(byTitle.items.map((item) => item.id)).toEqual([kasbah.id]);
  });

  it('répond 404 après la suppression logique', async () => {
    const editor = await login(EDITOR_EMAIL);
    const refs = await prepare(editor);
    const created = await createTour(editor, {
      title: { fr: 'Jardin de Salé' },
      summary: { fr: 'Andalous' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });
    const removed = await send('DELETE', `/api/v1/admin/tours/${created.id}`, editor);
    expect(removed.statusCode).toBe(204);
    const again = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/tours/${created.id}`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(again.statusCode).toBe(404);
    const row = await prisma.tour.findUnique({ where: { id: created.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
    const listed = await listTours(editor, 'page=1');
    expect(listed.items.map((item) => item.id)).not.toContain(created.id);
  });

  it('répond 422 si la ville est inconnue', async () => {
    const editor = await login(EDITOR_EMAIL);
    const refs = await prepare(editor);
    const response = await send('POST', '/api/v1/admin/tours', editor, {
      title: { fr: 'Visite orpheline' },
      summary: { fr: 'Sans ville' },
      cityId: UNKNOWN_CITY_ID,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });
    expect(response.statusCode).toBe(422);
    expect(parseJson(response.body)).toEqual({
      error: { code: CITY_NOT_FOUND, message: CITY_NOT_FOUND_MESSAGE },
    });
    expect(await prisma.tour.count()).toBe(0);
  });

  it('modifie publicShare via PATCH et préserve les catégories', async () => {
    const editor = await login(EDITOR_EMAIL);
    const refs = await prepare(editor);
    const created = await createTour(editor, {
      title: { fr: 'Kasbah des Oudayas', ar: 'قصبة الأوداية', en: 'Oudayas Kasbah' },
      summary: { fr: 'Remparts face à la mer' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });

    // (b) PATCH avec le seul corps { publicShare: true } -> 400
    const patchPartial = await application().inject({
      method: 'PATCH',
      url: `/api/v1/admin/tours/${created.id}`,
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(editor.sessionId),
        'x-csrf-token': editor.csrfToken,
      },
      payload: JSON.stringify({ publicShare: true }),
    });
    expect(patchPartial.statusCode).toBe(400);

    // (a) PATCH complet + publicShare: true -> 200
    const patchComplete = await send('PATCH', `/api/v1/admin/tours/${created.id}`, editor, {
      title: { fr: 'Kasbah des Oudayas', ar: 'قصبة الأوداية', en: 'Oudayas Kasbah' },
      summary: { fr: 'Remparts face à la mer' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id, refs.otherCategory.id],
      coverAssetId: refs.coverAssetId,
      publicShare: true,
    });
    expect(patchComplete.statusCode).toBe(200);
    const updated = TourResponseSchema.parse(parseJson(patchComplete.body));
    expect(updated.publicShare).toBe(true);
    expect(updated.categoryIds).toEqual([refs.category.id, refs.otherCategory.id]);

    const scene = await prisma.scene.create({
      data: {
        tourId: created.id,
        title: { fr: 'La porte' },
        panoramaAssetId: refs.coverAssetId,
        weight: 0,
        createdById: editor.userId,
      },
    });

    await prisma.tour.update({
      where: { id: created.id },
      data: { 
        status: 'PUBLISHED', 
        publishedAt: new Date(),
        startSceneId: scene.id,
      },
    });

    const publicRead = await application().inject({
      method: 'GET',
      url: `/api/v1/public/tours/${updated.shareToken}`,
    });
    expect(publicRead.statusCode).toBe(200);

    // (c) PATCH complet sans publicShare après (a) -> publicShare reste vrai
    const patchWithoutShare = await send('PATCH', `/api/v1/admin/tours/${created.id}`, editor, {
      title: { fr: 'Kasbah des Oudayas Modifié', ar: 'قصبة الأوداية', en: 'Oudayas Kasbah' },
      summary: { fr: 'Remparts' },
      cityId: refs.city.id,
      categoryIds: [refs.category.id],
      coverAssetId: refs.coverAssetId,
    });
    expect(patchWithoutShare.statusCode).toBe(200);
    const updatedAgain = TourResponseSchema.parse(parseJson(patchWithoutShare.body));
    expect(updatedAgain.publicShare).toBe(true);
  });

  describe('POST /admin/tours/:id/preview-token', () => {
    it('répond 401 sans session', async () => {
      const response = await application().inject({
        method: 'POST',
        url: '/api/v1/admin/tours/01990000-0000-7000-8000-0000000000aa/preview-token',
      });
      expect(response.statusCode).toBe(401);
    });

    it('refuse la génération à PARTNER et HOTEL_MANAGER', async () => {
      const partner = await login(PARTNER_EMAIL);
      const manager = await login(MANAGER_EMAIL);
      const tourId = '01990000-0000-7000-8000-0000000000aa';

      const partnerRes = await send('POST', `/api/v1/admin/tours/${tourId}/preview-token`, partner);
      const managerRes = await send('POST', `/api/v1/admin/tours/${tourId}/preview-token`, manager);

      expect(partnerRes.statusCode).toBe(403);
      expect(managerRes.statusCode).toBe(403);
    });

    it('répond 404 si la visite est inconnue', async () => {
      const editor = await login(EDITOR_EMAIL);
      const response = await send('POST', '/api/v1/admin/tours/01990000-0000-7000-8000-0000000000aa/preview-token', editor);
      expect(response.statusCode).toBe(404);
    });

    it('génère un jeton valide pour EDITOR', async () => {
      const editor = await login(EDITOR_EMAIL);
      const refs = await prepare(editor);
      const created = await createTour(editor, {
        title: { fr: 'Visite test' },
        summary: { fr: 'Résumé' },
        cityId: refs.city.id,
        categoryIds: [refs.category.id],
        coverAssetId: refs.coverAssetId,
      });

      const response = await send('POST', `/api/v1/admin/tours/${created.id}/preview-token`, editor);
      expect(response.statusCode).toBe(200);

      const parsed = PreviewTokenResponseSchema.parse(parseJson(response.body));
      expect(parsed.token.length).toBeGreaterThan(0);
      expect(parsed.expiresAt).toBeGreaterThan(Date.now());
    });
  });
});

interface Session {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

interface Refs {
  city: CityResponse;
  otherCity: CityResponse;
  category: CategoryResponse;
  otherCategory: CategoryResponse;
  coverAssetId: string;
}

function placeholderTour(): TourCreate {
  return {
    title: { fr: 'Refusée' },
    summary: { fr: 'Hors rôle' },
    cityId: UNKNOWN_CITY_ID,
    categoryIds: [UNKNOWN_CITY_ID],
    coverAssetId: UNKNOWN_CITY_ID,
  };
}

async function prepare(editor: Session): Promise<Refs> {
  const city = CityResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/cities', editor, cityBody)).body),
  );
  const otherCity = CityResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/cities', editor, otherCityBody)).body),
  );
  const category = CategoryResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/categories', editor, categoryBody)).body),
  );
  const otherCategory = CategoryResponseSchema.parse(
    parseJson((await send('POST', '/api/v1/admin/categories', editor, otherCategoryBody)).body),
  );
  const asset = await prisma.asset.create({
    data: {
      kind: AssetKind.IMAGE,
      originalKey: `int/cover-${city.id}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      contentHash: `tours-int-${city.id}`,
      processingStatus: 'READY',
      derivatives: {
        preview: 'derived/preview.jpg',
        web: 'derived/web.jpg',
        thumb: 'derived/thumb.jpg',
        tilesPrefix: 'derived/tiles/',
        tileGrid: { cols: 8, rows: 4, size: 512 },
      },
    },
  });
  return { city, otherCity, category, otherCategory, coverAssetId: asset.id };
}

async function createTour(editor: Session, body: TourCreate): Promise<TourResponse> {
  const response = await send('POST', '/api/v1/admin/tours', editor, body);
  expect(response.statusCode).toBe(201);
  return TourResponseSchema.parse(parseJson(response.body));
}

async function listTours(
  editor: Session,
  query: string,
): Promise<ReturnType<typeof PaginatedTourResponseSchema.parse>> {
  const response = await application().inject({
    method: 'GET',
    url: `/api/v1/admin/tours?${query}`,
    headers: { cookie: sessionCookie(editor.sessionId) },
  });
  expect(response.statusCode).toBe(200);
  return PaginatedTourResponseSchema.parse(parseJson(response.body));
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
  body?: TourCreate | TourUpdate | CityCreate | CategoryCreate,
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
