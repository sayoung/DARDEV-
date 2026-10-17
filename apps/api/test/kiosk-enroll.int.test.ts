/**
 * Enrôlement HTTP des kiosques (API-01, F-52).
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`.
 */
import 'reflect-metadata';

import { createHash } from 'node:crypto';

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
import { KIOSK_ENROLLMENT_INVALID, KIOSK_ENROLLMENT_INVALID_MESSAGE } from '../src/kiosks/kiosks.errors.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";
const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP des kiosques ont besoin de Redis (voir .env.example et docs/INSTALL.md).";
const ADMIN_EMAIL = 'admin@xplor.local';
const UNKNOWN_CODE = 'ZZZZ9999';

const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const EnrollmentCodeResponseSchema = z.object({
  code: z.string().length(8),
  expiresAt: z.iso.datetime(),
});
const EnrollResponseSchema = z.object({ kioskId: z.uuid(), token: z.string().min(1) });

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;
const prisma = new PrismaClient({ datasourceUrl: databaseUrl, errorFormat: 'minimal' });
const allowThrottle: CanActivate = { canActivate: () => true };
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

describe('enrôlement kiosque HTTP (API-01, F-52)', () => {
  it('enrôle une fois, stocke uniquement le SHA-256 et révoque le jeton à la désactivation', async () => {
    const admin = await login();
    const { kioskId, code } = await createKioskWithCode(admin);

    const response = await enroll(code);
    expect(response.statusCode).toBe(200);
    const enrolled = EnrollResponseSchema.parse(parseJson(response.body));
    expect(enrolled.kioskId).toBe(kioskId);

    const kiosk = await prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } });
    expect(kiosk.tokenHash).toBe(createHash('sha256').update(enrolled.token).digest('hex'));
    expect(kiosk.tokenHash).not.toBe(enrolled.token);
    expect(kiosk.status).toBe('ACTIVE');
    expect(kiosk.enrollmentCode).toBeNull();
    expect(kiosk.enrollmentExpiresAt).toBeNull();

    const usedCodeResponse = await enroll(code);
    expect(usedCodeResponse.statusCode).toBe(401);
    expect(errorOf(usedCodeResponse)).toEqual(genericEnrollmentError());

    const disableResponse = await send('POST', `/api/v1/admin/kiosks/${kioskId}/disable`, admin);
    expect(disableResponse.statusCode).toBe(200);
    expect(KioskSchema.parse(parseJson(disableResponse.body)).status).toBe('DISABLED');
    await expect(prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId } })).resolves.toMatchObject({
      tokenHash: null,
    });
  });

  it('renvoie la même erreur générique pour un code inconnu ou déjà utilisé', async () => {
    const admin = await login();
    const { code } = await createKioskWithCode(admin);
    const usedCodeResponse = await enroll(code);
    expect(usedCodeResponse.statusCode).toBe(200);

    const reused = await enroll(code);
    const unknown = await enroll(UNKNOWN_CODE);
    expect(reused.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(errorOf(reused)).toEqual(genericEnrollmentError());
    expect(errorOf(unknown)).toEqual(genericEnrollmentError());
    expect(errorOf(reused)).toEqual(errorOf(unknown));
  });

  it('refuse un code expiré', async () => {
    const admin = await login();
    const { kioskId, code } = await createKioskWithCode(admin);
    await prisma.kiosk.update({
      where: { id: kioskId },
      data: { enrollmentExpiresAt: new Date(Date.now() - 1) },
    });

    const response = await enroll(code);
    expect(response.statusCode).toBe(401);
    expect(errorOf(response)).toEqual(genericEnrollmentError());
  });

  it('répond 400 pour un code mal formé', async () => {
    const response = await enroll('bad');
    expect(response.statusCode).toBe(400);
  });
});

function genericEnrollmentError(): { code: string; message: string } {
  return { code: KIOSK_ENROLLMENT_INVALID, message: KIOSK_ENROLLMENT_INVALID_MESSAGE };
}

function errorOf(response: Injected): { code: string; message: string } {
  return ErrorResponseSchema.parse(parseJson(response.body)).error;
}

async function createKioskWithCode(admin: Session): Promise<{ kioskId: string; code: string }> {
  const cityId = await createTestCity();
  const hotelResponse = await send('POST', '/api/v1/admin/hotels', admin, buildHotelCreate(cityId));
  expect(hotelResponse.statusCode).toBe(201);
  const hotel = HotelResponseSchema.parse(parseJson(hotelResponse.body));
  const createResponse = await send('POST', '/api/v1/admin/kiosks', admin, {
    label: 'Kiosque enrôlement',
    hotelId: hotel.id,
    deviceType: 'TOUCH_SCREEN',
  });
  expect(createResponse.statusCode).toBe(201);
  const kioskId = KioskSchema.parse(parseJson(createResponse.body)).id;
  const codeResponse = await send(
    'POST',
    `/api/v1/admin/kiosks/${kioskId}/enrollment-code`,
    admin,
  );
  expect(codeResponse.statusCode).toBe(200);
  const { code } = EnrollmentCodeResponseSchema.parse(parseJson(codeResponse.body));
  return { kioskId, code };
}

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

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();
  const applicationInstance = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );
  await applicationInstance.register(fastifyCookie);
  applicationInstance.getHttpAdapter().getInstance().decorate('sessionCookie', {
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
  for (const user of buildSeedUsers(seedPassword, passwordHash)) {
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
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== '0');
}

function application(): NestFastifyApplication {
  if (app === undefined) throw new Error('application non démarrée');
  return app;
}

function requireRedis(): Redis {
  if (redis === undefined) throw new Error('Redis non démarré');
  return redis;
}

interface Session {
  sessionId: string;
  csrfToken: string;
}

async function login(): Promise<Session> {
  const response = await application().inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: ADMIN_EMAIL, password: seedPassword }),
  });
  expect(response.statusCode).toBe(200);
  const me = MeResponseSchema.parse(parseJson(response.body));
  return { sessionId: requireSessionCookie(response), csrfToken: me.csrfToken };
}

function send(
  method: 'POST',
  url: string,
  session: Session,
  body?: unknown,
): Promise<Injected> {
  const headers: Record<string, string> = {
    cookie: `${SESSION_COOKIE_NAME}=${session.sessionId}`,
    'x-csrf-token': session.csrfToken,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return application().inject({
    method,
    url,
    headers,
    payload: body === undefined ? undefined : JSON.stringify(body),
  });
}

function enroll(code: string): Promise<Injected> {
  return application().inject({
    method: 'POST',
    url: '/api/v1/kiosk/enroll',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ code, deviceInfo: { userAgent: 'Xplor Kiosk integration test' } }),
  });
}

function requireSessionCookie(response: Injected): string {
  const raw = response.headers['set-cookie'];
  const headers = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  for (const header of headers) {
    const match = /^xplor_sid=([^;]+)/.exec(header);
    const value = match?.[1];
    if (value !== undefined && value.length > 0) return value;
  }
  throw new Error('cookie xplor_sid absent');
}

function parseJson(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') throw new Error(MISSING_SEED_PASSWORD);
  return password;
}
