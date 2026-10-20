/**
 * Tests d'intégration pour l'ingestion d'événements statistiques (API-04, M7 F-80).
 * Vérifie le comportement HTTP réel sur base PostgreSQL et Redis (via tunnel SSH).
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
  EVENT_CHANNELS,
  EVENT_TYPES,
  z,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP d'ingestion ont besoin de Redis (voir .env.example et docs/INSTALL.md).";

const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const IngestResponseSchema = z.object({
  accepted: z.number().int().min(0),
});

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});

const allowThrottle: CanActivate = { canActivate: () => true };

type Injected = Awaited<ReturnType<NestFastifyApplication['inject']>>;

let app: NestFastifyApplication | undefined;
let redis: Redis | undefined;

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

function parseJson(body: string): unknown {
  const parsed: unknown = JSON.parse(body);
  return parsed;
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

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();

  const instance = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
    { logger: false },
  );

  await instance.register(fastifyCookie);
  instance.getHttpAdapter().getInstance().decorate('sessionCookie', {
    name: SESSION_COOKIE_NAME,
    ...sessionCookieOptions(env.NODE_ENV === 'production'),
  });

  instance.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'api/health', method: RequestMethod.GET }],
  });

  await instance.init();
  await instance.getHttpAdapter().getInstance().ready();
  return instance;
}

async function flushRateLimitKeys(client: Redis): Promise<void> {
  let cursor = '0';
  do {
    const scanResult = await client.scan(cursor, 'MATCH', 'rl:events:*', 'COUNT', 200);
    const nextCursor = scanResult[0];
    const keys = scanResult[1];
    cursor = nextCursor;
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== '0');
}

function postEvents(body: unknown, token?: string): Promise<Injected> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (typeof token === 'string') {
    headers.authorization = `Bearer ${token}`;
  }
  return application().inject({
    method: 'POST',
    url: '/api/v1/events',
    headers,
    payload: JSON.stringify(body),
  });
}

interface CreatedKioskFixture {
  hotelId: string;
  kioskId: string;
  deviceToken: string;
}

async function createActiveKiosk(
  label: string = 'Kiosque API-04 Test',
): Promise<CreatedKioskFixture> {
  const city = await prisma.city.create({
    data: {
      name: { fr: 'Rabat' },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.02,
      lng: -6.84,
    },
  });
  const hotel = await prisma.hotel.create({
    data: {
      name: 'Hôtel API-04 Test',
      stars: 'FIVE',
      cityId: city.id,
      address: '10 avenue Mohammed V, Rabat',
      phone: '+212537000000',
      email: 'kiosk-events@xplor.test',
      brandColor: '#6958A5',
      languages: ['fr', 'ar', 'en'],
      contractType: 'RENTAL',
      contractStart: new Date('2026-01-01T00:00:00.000Z'),
      contractEnd: new Date('2027-01-01T00:00:00.000Z'),
      active: true,
    },
  });
  const deviceToken = 'kiosk-device-token-secret-test';
  const tokenHash = createHash('sha256').update(deviceToken).digest('hex');
  const kiosk = await prisma.kiosk.create({
    data: {
      label,
      hotelId: hotel.id,
      deviceType: 'TOUCH_AND_HEADSET',
      status: 'ACTIVE',
      idleTimeoutSeconds: 90,
      tokenHash,
    },
  });
  return {
    hotelId: hotel.id,
    kioskId: kiosk.id,
    deviceToken,
  };
}

beforeAll(async () => {
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
  await prisma.$executeRaw`TRUNCATE TABLE "Event" CASCADE;`;
  await flushRateLimitKeys(requireRedis());
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

describe('collecte d’événements statistiques HTTP API-04 (M7 F-80)', () => {
  it('(1) un lot de 3 événements envoyé par un kiosque enrôlé est inséré avec channel KIOSK et kioskId/hotelId du jeton, même si le corps contient d’autres valeurs', async () => {
    const fixture = await createActiveKiosk();
    const sessionOne = '0192a000-0000-7000-8000-000000000001';
    const sessionTwo = '0192a000-0000-7000-8000-000000000002';
    const sessionThree = '0192a000-0000-7000-8000-000000000003';
    const nowIso = new Date().toISOString();

    const batchPayload = {
      events: [
        {
          sessionId: sessionOne,
          type: EVENT_TYPES.SESSION_START,
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          occurredAt: nowIso,
        },
        {
          sessionId: sessionTwo,
          type: EVENT_TYPES.SCENE_VIEW,
          channel: EVENT_CHANNELS.VR,
          lang: 'ar',
          durationMs: 4000,
          occurredAt: nowIso,
        },
        {
          sessionId: sessionThree,
          type: EVENT_TYPES.SESSION_END,
          channel: EVENT_CHANNELS.WEB,
          lang: 'en',
          durationMs: 15000,
          occurredAt: nowIso,
        },
      ],
    };

    const response = await postEvents(batchPayload, fixture.deviceToken);

    expect(response.statusCode).toBe(200);
    const parsedBody = IngestResponseSchema.parse(parseJson(response.body));
    expect(parsedBody.accepted).toBe(3);

    const insertedRows = await prisma.event.findMany({
      where: {
        sessionId: { in: [sessionOne, sessionTwo, sessionThree] },
      },
      orderBy: { sessionId: 'asc' },
    });

    expect(insertedRows).toHaveLength(3);
    for (const row of insertedRows) {
      expect(row.channel).toBe(EVENT_CHANNELS.KIOSK);
      expect(row.kioskId).toBe(fixture.kioskId);
      expect(row.hotelId).toBe(fixture.hotelId);
    }
  });

  it('(2) envoi anonyme -> channel WEB forcé, kioskId null', async () => {
    const anonymousSessionId = '0192a000-0000-7000-8000-000000000010';
    const batchPayload = {
      events: [
        {
          sessionId: anonymousSessionId,
          type: EVENT_TYPES.SESSION_START,
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'fr',
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    const response = await postEvents(batchPayload);

    expect(response.statusCode).toBe(200);
    const parsedBody = IngestResponseSchema.parse(parseJson(response.body));
    expect(parsedBody.accepted).toBe(1);

    const row = await prisma.event.findFirst({
      where: { sessionId: anonymousSessionId },
    });

    expect(row).not.toBeNull();
    if (row !== null) {
      expect(row.channel).toBe(EVENT_CHANNELS.WEB);
      expect(row.kioskId).toBeNull();
      expect(row.hotelId).toBeNull();
    }
  });

  it('(3) lot de 201 événements -> 400', async () => {
    const nowIso = new Date().toISOString();
    const events = Array.from({ length: 201 }, (_, index) => {
      const hexIndex = String(index + 1).padStart(12, '0');
      return {
        sessionId: `0192a000-0000-7000-8000-${hexIndex}`,
        type: EVENT_TYPES.SCENE_VIEW,
        channel: EVENT_CHANNELS.WEB,
        lang: 'fr',
        occurredAt: nowIso,
      };
    });

    const response = await postEvents({ events });

    expect(response.statusCode).toBe(400);
    const parsedBody = ErrorResponseSchema.parse(parseJson(response.body));
    expect(parsedBody.error.code).toBe('VALIDATION_ERROR');

    const totalEventsInDb = await prisma.event.count();
    expect(totalEventsInDb).toBe(0);
  });

  it('(4) événement avec type inconnu -> 400', async () => {
    const invalidTypePayload = {
      events: [
        {
          sessionId: '0192a000-0000-7000-8000-000000000020',
          type: 'TYPE_INEXISTANT_INCONNU',
          channel: EVENT_CHANNELS.WEB,
          lang: 'fr',
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    const response = await postEvents(invalidTypePayload);

    expect(response.statusCode).toBe(400);
    const parsedBody = ErrorResponseSchema.parse(parseJson(response.body));
    expect(parsedBody.error.code).toBe('VALIDATION_ERROR');

    const totalEventsInDb = await prisma.event.count();
    expect(totalEventsInDb).toBe(0);
  });

  it('(5) jeton Bearer invalide -> 401', async () => {
    const validPayload = {
      events: [
        {
          sessionId: '0192a000-0000-7000-8000-000000000030',
          type: EVENT_TYPES.SESSION_START,
          channel: EVENT_CHANNELS.KIOSK,
          lang: 'fr',
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    const response = await postEvents(validPayload, 'jeton-bearer-invalide-non-reconnu');

    expect(response.statusCode).toBe(401);

    const totalEventsInDb = await prisma.event.count();
    expect(totalEventsInDb).toBe(0);
  });
});
