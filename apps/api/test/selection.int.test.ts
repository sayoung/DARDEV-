/**
 * Sélection des visites d’un hôtel (API-26, F-51).
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import {
  ContractType,
  HotelResponseSchema,
  HotelStars,
  MeResponseSchema,
  SelectionResponseSchema,
  z,
  type HotelCreate,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { loadEnv, type Env } from '../src/config/env.js';
import {
  SELECTION_TOUR_INVALID,
  SELECTION_TOUR_INVALID_MESSAGE,
} from '../src/hotels/hotels.errors.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP de sélection ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const ADMIN_EMAIL = 'admin@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';
const EDITOR_EMAIL = 'editor@xplor.local';
const UNKNOWN_TOUR_ID = '01990000-0000-7000-8000-000000000999';

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

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

describe('sélection des visites HTTP (API-26, F-51)', () => {
  it('répond 401 sans session sur GET', async () => {
    const response = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/hotels/01990000-0000-7000-8000-000000000001/selection',
    });
    expect(response.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF sur PUT', async () => {
    const admin = await login();
    const { hotel } = await createHotelFixture(admin);
    const response = await application().inject({
      method: 'PUT',
      url: `/api/v1/admin/hotels/${hotel.id}/selection`,
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(admin.sessionId),
      },
      payload: JSON.stringify({ tourIds: [], featuredTourId: null, attractTourIds: [] }),
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN lit la valeur par défaut puis remplace la sélection avec des visites publiées', async () => {
    const admin = await login();
    const { hotel, cityId } = await createHotelFixture(admin);

    const emptyRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotel.id}/selection`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(emptyRes.statusCode).toBe(200);
    const emptySelection = SelectionResponseSchema.parse(parseJson(emptyRes.body));
    expect(emptySelection).toMatchObject({
      hotelId: hotel.id,
      version: 1,
      featuredTourId: null,
      attractTourIds: [],
      items: [],
    });

    const tours = await createTours(cityId, admin.userId);
    const initialPut = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, admin, {
      tourIds: [tours.first.id],
      featuredTourId: tours.first.id,
      attractTourIds: [],
    });
    expect(initialPut.statusCode).toBe(200);
    expect(SelectionResponseSchema.parse(parseJson(initialPut.body)).version).toBe(1);

    const putRes = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, admin, {
      tourIds: [tours.second.id, tours.first.id],
      featuredTourId: tours.second.id,
      attractTourIds: [tours.first.id],
    });
    expect(putRes.statusCode).toBe(200);
    const updated = SelectionResponseSchema.parse(parseJson(putRes.body));
    expect(updated.version).toBe(2);
    expect(updated.featuredTourId).toBe(tours.second.id);
    expect(updated.attractTourIds).toEqual([tours.first.id]);
    expect(updated.items).toEqual([
      { tourId: tours.second.id, position: 0 },
      { tourId: tours.first.id, position: 1 },
    ]);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotel.id}/selection`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    expect(SelectionResponseSchema.parse(parseJson(getRes.body))).toEqual(updated);

    const nextPut = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, admin, {
      tourIds: [tours.first.id],
      featuredTourId: tours.first.id,
      attractTourIds: [],
    });
    expect(nextPut.statusCode).toBe(200);
    expect(SelectionResponseSchema.parse(parseJson(nextPut.body)).version).toBe(3);
  });

  it.each([
    ['une visite brouillon', 'draft' as const],
    ['une visite inconnue', 'unknown' as const],
  ])('refuse un PUT contenant %s avec SELECTION_TOUR_INVALID', async (_label, kind) => {
    const admin = await login();
    const { hotel, cityId } = await createHotelFixture(admin);
    const tours = await createTours(cityId, admin.userId);
    const tourId = kind === 'draft' ? tours.draft.id : UNKNOWN_TOUR_ID;

    const response = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, admin, {
      tourIds: [tourId],
      featuredTourId: null,
      attractTourIds: [],
    });

    expect(response.statusCode).toBe(422);
    expect(ErrorResponseSchema.parse(parseJson(response.body)).error).toEqual({
      code: SELECTION_TOUR_INVALID,
      message: SELECTION_TOUR_INVALID_MESSAGE,
    });
  });

  it('répond 400 si featuredTourId ne figure pas dans tourIds', async () => {
    const admin = await login();
    const { hotel, cityId } = await createHotelFixture(admin);
    const tours = await createTours(cityId, admin.userId);

    const response = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, admin, {
      tourIds: [tours.first.id],
      featuredTourId: tours.second.id,
      attractTourIds: [],
    });

    expect(response.statusCode).toBe(400);
  });

  it('un HOTEL_MANAGER de l’hôtel A accède à la sélection A, mais pas à celle de B', async () => {
    const admin = await login();
    const { hotel: hotelA } = await createHotelFixture(admin);
    const { hotel: hotelB } = await createHotelFixture(admin);
    const manager = await login(MANAGER_EMAIL);
    const attachRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [manager.userId] },
    );
    expect(attachRes.statusCode).toBe(200);

    const getA = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelA.id}/selection`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getA.statusCode).toBe(200);

    const putA = await send('PUT', `/api/v1/admin/hotels/${hotelA.id}/selection`, manager, {
      tourIds: [],
      featuredTourId: null,
      attractTourIds: [],
    });
    expect(putA.statusCode).toBe(200);

    const getB = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelB.id}/selection`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getB.statusCode).toBe(404);

    const putB = await send('PUT', `/api/v1/admin/hotels/${hotelB.id}/selection`, manager, {
      tourIds: [],
      featuredTourId: null,
      attractTourIds: [],
    });
    expect(putB.statusCode).toBe(404);
  });

  it('un EDITOR hors périmètre reçoit 404 sur la sélection de l’hôtel A', async () => {
    const admin = await login();
    const { hotel } = await createHotelFixture(admin);
    const editor = await login(EDITOR_EMAIL);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotel.id}/selection`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(getRes.statusCode).toBe(404);

    const putRes = await send('PUT', `/api/v1/admin/hotels/${hotel.id}/selection`, editor, {
      tourIds: [],
      featuredTourId: null,
      attractTourIds: [],
    });
    expect(putRes.statusCode).toBe(404);
  });
});

async function createTestCity(): Promise<string> {
  const city = await prisma.city.create({
    data: {
      name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.02,
      lng: -6.84,
    },
  });
  return city.id;
}

function buildHotelCreate(cityId: string): HotelCreate {
  return {
    name: 'Hôtel Oudayas Rabat',
    stars: HotelStars.FIVE,
    cityId,
    address: '1 avenue des Oudayas, Rabat',
    phone: '+212537000001',
    email: 'contact@oudayas.ma',
    logoAssetId: null,
    brandColor: '#6958A5',
    languages: ['fr', 'ar', 'en'],
    contractType: ContractType.RENTAL,
    contractStart: '2026-01-01T00:00:00.000Z',
    contractEnd: '2027-01-01T00:00:00.000Z',
    active: true,
  };
}

async function createHotelFixture(admin: Session): Promise<{ hotel: { id: string }; cityId: string }> {
  const cityId = await createTestCity();
  const response = await send('POST', '/api/v1/admin/hotels', admin, buildHotelCreate(cityId));
  expect(response.statusCode).toBe(201);
  const hotel = HotelResponseSchema.parse(parseJson(response.body));
  return { hotel, cityId };
}

async function createTours(
  cityId: string,
  createdById: string,
): Promise<{ first: { id: string }; second: { id: string }; draft: { id: string } }> {
  const cover = await prisma.asset.create({
    data: {
      kind: 'IMAGE',
      originalKey: 'selection-test/cover.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      width: 100,
      height: 50,
      contentHash: 'selection-test-cover-hash',
      processingStatus: 'READY',
    },
  });
  const createTour = async (
    slug: string,
    title: string,
    status: 'PUBLISHED' | 'DRAFT',
  ): Promise<{ id: string }> =>
    prisma.tour.create({
      data: {
        title: { fr: title },
        summary: { fr: `Résumé ${title}` },
        cityId,
        coverAssetId: cover.id,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date('2026-10-01T00:00:00.000Z') : null,
        shareToken: `${slug}-selection-test`,
        createdById,
      },
      select: { id: true },
    });

  const first = await createTour('first', 'Kasbah des Oudayas', 'PUBLISHED');
  const second = await createTour('second', 'Jardin de Salé', 'PUBLISHED');
  const draft = await createTour('draft', 'Visite brouillon', 'DRAFT');
  return { first, second, draft };
}

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();

  const applicationInstance = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  await applicationInstance.register(fastifyCookie);
  applicationInstance
    .getHttpAdapter()
    .getInstance()
    .decorate('sessionCookie', {
      name: SESSION_COOKIE_NAME,
      ...sessionCookieOptions(env.NODE_ENV === 'production'),
    });
  applicationInstance.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'api/health', method: RequestMethod.GET }],
  });
  await applicationInstance.init();
  await applicationInstance.getHttpAdapter().getInstance().ready();
  return applicationInstance;
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

interface Session {
  sessionId: string;
  csrfToken: string;
  userId: string;
}

async function login(email = ADMIN_EMAIL): Promise<Session> {
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
  method: 'POST' | 'PUT',
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
