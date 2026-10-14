/**
 * CRUD HTTP des hôtels (API-26, F-50).
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
  HotelListResponseSchema,
  HotelResponseSchema,
  HotelStars,
  MeResponseSchema,
  type HotelCreate,
  type HotelUpdate,
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
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP des hôtels ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const ADMIN_EMAIL = 'admin@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';

const hotelUpdateBody: HotelUpdate = {
  name: 'Hôtel Oudayas Rabat Rénové',
  stars: HotelStars.LUXURY,
  brandColor: '#62549F',
  contractType: ContractType.SALE,
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

describe('hôtels HTTP (API-26)', () => {
  it('répond 401 sans session', async () => {
    const cityId = await createTestCity();
    const payload = buildHotelCreate(cityId);

    const listRes = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/hotels',
    });
    expect(listRes.statusCode).toBe(401);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${cityId}`,
    });
    expect(getRes.statusCode).toBe(401);

    const postRes = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/hotels',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
    expect(postRes.statusCode).toBe(401);

    const patchRes = await application().inject({
      method: 'PATCH',
      url: `/api/v1/admin/hotels/${cityId}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(hotelUpdateBody),
    });
    expect(patchRes.statusCode).toBe(401);

    const deleteRes = await application().inject({
      method: 'DELETE',
      url: `/api/v1/admin/hotels/${cityId}`,
    });
    expect(deleteRes.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const payload = buildHotelCreate(cityId);

    const response = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/hotels',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(admin.sessionId),
      },
      payload: JSON.stringify(payload),
    });
    expect(response.statusCode).toBe(403);
  });

  it('laisse ADMIN créer, lire, modifier et supprimer un hôtel (201/200/200/204, puis 404)', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelPayload = buildHotelCreate(cityId);

    const createRes = await send('POST', '/api/v1/admin/hotels', admin, hotelPayload);
    expect(createRes.statusCode).toBe(201);
    const created = HotelResponseSchema.parse(parseJson(createRes.body));
    expect(created.name).toBe(hotelPayload.name);
    expect(created.cityId).toBe(cityId);
    expect(created.stars).toBe(HotelStars.FIVE);
    expect(created.brandColor).toBe(hotelPayload.brandColor);
    expect(created.contractType).toBe(ContractType.RENTAL);
    expect(created.hasMaintenancePin).toBe(false);
    expect(hasMaintenancePinHash(parseJson(createRes.body))).toBe(false);

    const listRes = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/hotels',
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(listRes.statusCode).toBe(200);
    const listed = HotelListResponseSchema.parse(parseJson(listRes.body));
    expect(listed.map((item) => item.id)).toContain(created.id);

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${created.id}`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = HotelResponseSchema.parse(parseJson(getRes.body));
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(hotelPayload.name);

    const patchRes = await send(
      'PATCH',
      `/api/v1/admin/hotels/${created.id}`,
      admin,
      hotelUpdateBody,
    );
    expect(patchRes.statusCode).toBe(200);
    const patched = HotelResponseSchema.parse(parseJson(patchRes.body));
    expect(patched.name).toBe(hotelUpdateBody.name);
    expect(patched.stars).toBe(HotelStars.LUXURY);
    expect(patched.brandColor).toBe('#62549F');
    expect(patched.contractType).toBe(ContractType.SALE);

    const deleteRes = await send('DELETE', `/api/v1/admin/hotels/${created.id}`, admin);
    expect(deleteRes.statusCode).toBe(204);

    const afterDeleteRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${created.id}`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(afterDeleteRes.statusCode).toBe(404);

    const row = await prisma.hotel.findUnique({ where: { id: created.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(row?.active).toBe(false);
  });

  it('répond 422 sur brandColor invalide', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const basePayload = buildHotelCreate(cityId);

    const invalidCreateRes = await send('POST', '/api/v1/admin/hotels', admin, {
      ...basePayload,
      brandColor: 'not-a-color',
    });
    expect(invalidCreateRes.statusCode).toBe(422);

    const validCreateRes = await send('POST', '/api/v1/admin/hotels', admin, basePayload);
    expect(validCreateRes.statusCode).toBe(201);
    const created = HotelResponseSchema.parse(parseJson(validCreateRes.body));

    const invalidPatchRes = await send(
      'PATCH',
      `/api/v1/admin/hotels/${created.id}`,
      admin,
      { brandColor: '#ZZZZZZ' },
    );
    expect(invalidPatchRes.statusCode).toBe(422);
  });

  it('gestionnaire rattaché à l’hôtel A : GET liste ne contient que A, GET /admin/hotels/<B> → 404, POST → 403', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();

    const resA = await send(
      'POST',
      '/api/v1/admin/hotels',
      admin,
      buildHotelCreate(cityId, 'Hôtel A Rabat'),
    );
    expect(resA.statusCode).toBe(201);
    const hotelA = HotelResponseSchema.parse(parseJson(resA.body));

    const resB = await send(
      'POST',
      '/api/v1/admin/hotels',
      admin,
      buildHotelCreate(cityId, 'Hôtel B Casablanca'),
    );
    expect(resB.statusCode).toBe(201);
    const hotelB = HotelResponseSchema.parse(parseJson(resB.body));

    const manager = await login(MANAGER_EMAIL);
    await prisma.userHotel.create({
      data: {
        userId: manager.userId,
        hotelId: hotelA.id,
      },
    });

    const listRes = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/hotels',
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(listRes.statusCode).toBe(200);
    const managerHotels = HotelListResponseSchema.parse(parseJson(listRes.body));
    expect(managerHotels.map((item) => item.id)).toEqual([hotelA.id]);

    const getARes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelA.id}`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getARes.statusCode).toBe(200);
    const fetchedA = HotelResponseSchema.parse(parseJson(getARes.body));
    expect(fetchedA.id).toBe(hotelA.id);

    const getBRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${hotelB.id}`,
      headers: { cookie: sessionCookie(manager.sessionId) },
    });
    expect(getBRes.statusCode).toBe(404);

    const postRes = await send(
      'POST',
      '/api/v1/admin/hotels',
      manager,
      buildHotelCreate(cityId, 'Hôtel C Tanger'),
    );
    expect(postRes.statusCode).toBe(403);
  });

  it('la réponse ne contient jamais maintenancePinHash', async () => {
    const admin = await login(ADMIN_EMAIL);
    const cityId = await createTestCity();
    const hotelPayload = buildHotelCreate(cityId, 'Hôtel Atlas Pin Test');

    const createRes = await send('POST', '/api/v1/admin/hotels', admin, hotelPayload);
    expect(createRes.statusCode).toBe(201);
    const created = HotelResponseSchema.parse(parseJson(createRes.body));
    expect(hasMaintenancePinHash(parseJson(createRes.body))).toBe(false);

    await prisma.hotel.update({
      where: { id: created.id },
      data: { maintenancePinHash: '$argon2id$mock-hash-value-for-technical-screen' },
    });

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/hotels/${created.id}`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    const rawGet = parseJson(getRes.body);
    expect(hasMaintenancePinHash(rawGet)).toBe(false);
    const fetched = HotelResponseSchema.parse(rawGet);
    expect(fetched.hasMaintenancePin).toBe(true);

    const listRes = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/hotels',
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(listRes.statusCode).toBe(200);
    const rawList = parseJson(listRes.body);
    if (Array.isArray(rawList)) {
      for (const item of rawList) {
        expect(hasMaintenancePinHash(item)).toBe(false);
      }
    }
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

function hasMaintenancePinHash(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  return Reflect.has(payload, 'maintenancePinHash');
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
