/**
 * CRUD HTTP des kiosques (API-27, F-52).
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
  KioskSchema,
  MeResponseSchema,
  type HotelCreate,
  z,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { loadEnv, type Env } from '../src/config/env.js';
import {
  KIOSK_HOTEL_INVALID,
  KIOSK_HOTEL_INVALID_MESSAGE,
} from '../src/kiosks/kiosks.errors.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP des kiosques ont besoin de Redis (voir .env.example et docs/INSTALL.md).";

const ADMIN_EMAIL = 'admin@xplor.local';
const UNKNOWN_HOTEL_ID = '01990000-0000-7000-8000-000000000999';

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const EnrollmentCodeResponseSchema = z.object({
  code: z.string().length(8),
  expiresAt: z.iso.datetime(),
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

describe('kiosques HTTP (API-27, F-52)', () => {
  it('répond 401 sans session sur POST', async () => {
    const response = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/kiosks',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(buildKioskCreate(UNKNOWN_HOTEL_ID)),
    });
    expect(response.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF sur POST', async () => {
    const admin = await login();
    const response = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/kiosks',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(admin.sessionId),
      },
      payload: JSON.stringify(buildKioskCreate(UNKNOWN_HOTEL_ID)),
    });
    expect(response.statusCode).toBe(403);
  });

  it('ADMIN crée, lit, modifie, enrôle, désactive puis supprime un kiosque', async () => {
    const admin = await login();
    const hotel = await createHotel(admin);
    const payload = buildKioskCreate(hotel.id);

    const createRes = await send('POST', '/api/v1/admin/kiosks', admin, payload);
    expect(createRes.statusCode).toBe(201);
    const createdBody: unknown = parseJson(createRes.body);
    const created = KioskSchema.parse(createdBody);
    expect(created).toMatchObject({
      label: payload.label,
      hotelId: hotel.id,
      deviceType: payload.deviceType,
      status: 'PENDING',
      idleTimeoutSeconds: 90,
    });
    expect(createdBody).not.toHaveProperty('tokenHash');
    expect(createdBody).not.toHaveProperty('enrollmentCode');
    expect(createdBody).not.toHaveProperty('lastIp');

    const getRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/kiosks/${created.id}`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(getRes.statusCode).toBe(200);
    expect(KioskSchema.parse(parseJson(getRes.body))).toMatchObject({
      id: created.id,
      label: payload.label,
    });

    const listRes = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/kiosks',
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(listRes.statusCode).toBe(200);
    const listed: unknown = parseJson(listRes.body);
    expect(Array.isArray(listed)).toBe(true);
    expect((listed as unknown[]).map((item) => KioskSchema.parse(item).id)).toContain(created.id);

    const patchRes = await send('PATCH', `/api/v1/admin/kiosks/${created.id}`, admin, {
      label: 'Kiosque réception',
    });
    expect(patchRes.statusCode).toBe(200);
    expect(KioskSchema.parse(parseJson(patchRes.body)).label).toBe('Kiosque réception');

    const enrollmentRes = await send(
      'POST',
      `/api/v1/admin/kiosks/${created.id}/enrollment-code`,
      admin,
    );
    expect(enrollmentRes.statusCode).toBe(200);
    expect(EnrollmentCodeResponseSchema.parse(parseJson(enrollmentRes.body)).code).toMatch(
      /^[A-Z0-9]{8}$/,
    );

    const disableRes = await send('POST', `/api/v1/admin/kiosks/${created.id}/disable`, admin);
    expect(disableRes.statusCode).toBe(200);
    expect(KioskSchema.parse(parseJson(disableRes.body)).status).toBe('DISABLED');

    const deleteRes = await send('DELETE', `/api/v1/admin/kiosks/${created.id}`, admin);
    expect(deleteRes.statusCode).toBe(204);
    const afterDeleteRes = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/kiosks/${created.id}`,
      headers: { cookie: sessionCookie(admin.sessionId) },
    });
    expect(afterDeleteRes.statusCode).toBe(404);
  });

  it('répond 422 KIOSK_HOTEL_INVALID pour un hôtel inconnu', async () => {
    const admin = await login();
    const response = await send(
      'POST',
      '/api/v1/admin/kiosks',
      admin,
      buildKioskCreate(UNKNOWN_HOTEL_ID),
    );
    expect(response.statusCode).toBe(422);
    expect(ErrorResponseSchema.parse(parseJson(response.body)).error).toEqual({
      code: KIOSK_HOTEL_INVALID,
      message: KIOSK_HOTEL_INVALID_MESSAGE,
    });
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

function buildKioskCreate(hotelId: string) {
  return {
    label: 'Kiosque hall principal',
    hotelId,
    deviceType: 'TOUCH_SCREEN' as const,
  };
}

async function createHotel(admin: Session): Promise<{ id: string }> {
  const cityId = await createTestCity();
  const response = await send('POST', '/api/v1/admin/hotels', admin, buildHotelCreate(cityId));
  expect(response.statusCode).toBe(201);
  return HotelResponseSchema.parse(parseJson(response.body));
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
    if (scanned[1].length > 0) {
      await client.del(...scanned[1]);
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
