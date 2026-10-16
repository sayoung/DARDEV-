/**
 * CRUD HTTP des gestionnaires d'hôtels (API-26, F-50).
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
  HotelManagersResponseSchema,
  HotelResponseSchema,
  HotelStars,
  MeResponseSchema,
  z,
  type HotelCreate,
  type HotelResponse,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { loadEnv, type Env } from '../src/config/env.js';
import {
  USER_INVALID,
  USER_INVALID_MESSAGE,
  USER_NOT_FOUND,
  USER_NOT_FOUND_MESSAGE,
} from '../src/hotels/hotels.errors.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des gestionnaires d’hôtels ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const ADMIN_EMAIL = 'admin@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';
const EDITOR_EMAIL = 'editor@xplor.local';
const UNKNOWN_USER_ID = '01990000-0000-7000-8000-000000000999';

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

describe('gestionnaires d’hôtels HTTP (API-26, F-50)', () => {
  it('répond 401 sans session sur GET et PUT', async () => {
    const cityId = await createTestCity();
    const admin = await login(ADMIN_EMAIL);
    const hotel = await createHotel(admin, cityId, 'Hôtel Oudayas Rabat');

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotel.id}/managers`,
    });
    expect(getRes.statusCode).toBe(401);

    const putRes = await application().inject({
      method: 'PUT',
      url: `/api/v1/admin/hotels/${hotel.id}/managers`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ userIds: [] }),
    });
    expect(putRes.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF sur PUT', async () => {
    const cityId = await createTestCity();
    const admin = await login(ADMIN_EMAIL);
    const hotel = await createHotel(admin, cityId, 'Hôtel Oudayas Rabat');

    const response = await application().inject({
      method: 'PUT',
      url: `/api/v1/admin/hotels/${hotel.id}/managers`,
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(admin.sessionId),
      },
      payload: JSON.stringify({ userIds: [] }),
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN rattache un HOTEL_MANAGER à l’hôtel A (PUT 200, puis GET renvoie ce gestionnaire)', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelA = await createHotel(admin, cityId, 'Hôtel A Rabat');

    const managerUser = await prisma.user.findUniqueOrThrow({
      where: { email: MANAGER_EMAIL },
      select: { id: true, email: true, name: true },
    });

    const putRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [managerUser.id] },
    );
    expect(putRes.statusCode).toBe(200);
    const putData = HotelManagersResponseSchema.parse(parseJson(putRes.body));
    expect(putData.managers).toEqual([
      {
        id: managerUser.id,
        email: managerUser.email,
        name: managerUser.name,
      },
    ]);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelA.id}/managers`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    const getData = HotelManagersResponseSchema.parse(parseJson(getRes.body));
    expect(getData.managers).toEqual([
      {
        id: managerUser.id,
        email: managerUser.email,
        name: managerUser.name,
      },
    ]);

    const links = await prisma.userHotel.findMany({
      where: { hotelId: hotelA.id },
    });
    expect(links).toHaveLength(1);
    const firstLink = links[0];
    expect(firstLink?.userId).toBe(managerUser.id);
    expect(firstLink?.hotelId).toBe(hotelA.id);
  });

  it('PUT avec un utilisateur de rôle EDITOR → 422', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelA = await createHotel(admin, cityId, 'Hôtel A Rabat');

    const editorUser = await prisma.user.findUniqueOrThrow({
      where: { email: EDITOR_EMAIL },
      select: { id: true },
    });

    const putRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [editorUser.id] },
    );
    expect(putRes.statusCode).toBe(422);
    const errorBody = ErrorResponseSchema.parse(parseJson(putRes.body));
    expect(errorBody.error.code).toBe(USER_INVALID);
    expect(errorBody.error.message).toBe(USER_INVALID_MESSAGE);

    const links = await prisma.userHotel.findMany({
      where: { hotelId: hotelA.id },
    });
    expect(links).toEqual([]);
  });

  it('PUT avec un utilisateur inconnu → 422', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelA = await createHotel(admin, cityId, 'Hôtel A Rabat');

    const putRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [UNKNOWN_USER_ID] },
    );
    expect(putRes.statusCode).toBe(422);
    const errorBody = ErrorResponseSchema.parse(parseJson(putRes.body));
    expect(errorBody.error.code).toBe(USER_NOT_FOUND);
    expect(errorBody.error.message).toBe(USER_NOT_FOUND_MESSAGE);

    const links = await prisma.userHotel.findMany({
      where: { hotelId: hotelA.id },
    });
    expect(links).toEqual([]);
  });

  it('gestionnaire de l’hôtel A : GET /admin/hotels/<A>/managers → 200, GET /admin/hotels/<B>/managers → 404, PUT → 403', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelA = await createHotel(admin, cityId, 'Hôtel A Rabat');
    const hotelB = await createHotel(admin, cityId, 'Hôtel B Casablanca');

    const manager = await login(MANAGER_EMAIL);

    const attachRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [manager.userId] },
    );
    expect(attachRes.statusCode).toBe(200);

    const getARes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelA.id}/managers`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getARes.statusCode).toBe(200);
    const dataA = HotelManagersResponseSchema.parse(parseJson(getARes.body));
    expect(dataA.managers.map((item) => item.id)).toEqual([manager.userId]);

    const getBRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelB.id}/managers`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getBRes.statusCode).toBe(404);

    const putRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      manager,
      { userIds: [manager.userId] },
    );
    expect(putRes.statusCode).toBe(403);
  });

  it('PUT [] vide la liste', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelA = await createHotel(admin, cityId, 'Hôtel A Rabat');

    const managerUser = await prisma.user.findUniqueOrThrow({
      where: { email: MANAGER_EMAIL },
      select: { id: true },
    });

    const attachRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [managerUser.id] },
    );
    expect(attachRes.statusCode).toBe(200);
    expect(await prisma.userHotel.count({ where: { hotelId: hotelA.id } })).toBe(1);

    const clearRes = await send(
      'PUT',
      `/api/v1/admin/hotels/${hotelA.id}/managers`,
      admin,
      { userIds: [] },
    );
    expect(clearRes.statusCode).toBe(200);
    const clearData = HotelManagersResponseSchema.parse(parseJson(clearRes.body));
    expect(clearData.managers).toEqual([]);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelA.id}/managers`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    const getData = HotelManagersResponseSchema.parse(parseJson(getRes.body));
    expect(getData.managers).toEqual([]);

    const links = await prisma.userHotel.findMany({
      where: { hotelId: hotelA.id },
    });
    expect(links).toEqual([]);
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

function buildHotelCreate(cityId: string, name = 'Hôtel Oudayas Rabat'): HotelCreate {
  return {
    name,
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

async function createHotel(
  admin: Session,
  cityId: string,
  name = 'Hôtel Oudayas Rabat',
): Promise<HotelResponse> {
  const createRes = await send('POST', '/api/v1/admin/hotels', admin, buildHotelCreate(cityId, name));
  expect(createRes.statusCode).toBe(201);
  return HotelResponseSchema.parse(parseJson(createRes.body));
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
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT',
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
  const parsed: unknown = JSON.parse(body);
  return parsed;
}

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') {
    throw new Error(MISSING_SEED_PASSWORD);
  }
  return password;
}
