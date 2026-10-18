/**
 * Manifeste et heartbeat HTTP des kiosques (API-02/03).
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
  KioskManifestSchema,
  KioskSchema,
  MeResponseSchema,
  type KioskHeartbeatRequest,
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
import { KIOSK_DISABLED, KIOSK_DISABLED_MESSAGE } from '../src/kiosks/kiosks.errors.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";
const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP des kiosques ont besoin de Redis (voir .env.example et docs/INSTALL.md).";
const ADMIN_EMAIL = 'admin@xplor.local';

const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const EnrollmentCodeResponseSchema = z.object({ code: z.string().length(8), expiresAt: z.iso.datetime() });
const EnrollResponseSchema = z.object({ kioskId: z.uuid(), token: z.string().min(1) });
const HeartbeatResponseSchema = z.object({ forceSync: z.boolean(), serverTime: z.iso.datetime() });

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

describe('manifeste et heartbeat kiosque HTTP (API-02/03)', () => {
  it('exige un jeton valide pour le manifeste et le heartbeat', async () => {
    const responseWithoutToken = await application().inject({ method: 'GET', url: '/api/v1/kiosk/manifest' });
    const responseWithWrongToken = await application().inject({
      method: 'GET',
      url: '/api/v1/kiosk/manifest',
      headers: { authorization: 'Bearer faux-jeton' },
    });
    const heartbeatWithoutToken = await heartbeat(null);
    const heartbeatWithWrongToken = await heartbeat('faux-jeton');

    expect(responseWithoutToken.statusCode).toBe(401);
    expect(responseWithWrongToken.statusCode).toBe(401);
    expect(heartbeatWithoutToken.statusCode).toBe(401);
    expect(heartbeatWithWrongToken.statusCode).toBe(401);
  });

  it('sert le manifeste publié, enregistre le heartbeat, acquitte force-sync et bloque un kiosque désactivé', async () => {
    const admin = await login();
    const fixture = await createEnrolledKiosk(admin);

    const manifestResponse = await manifest(fixture.token);
    expect(manifestResponse.statusCode).toBe(200);
    const parsedManifest = KioskManifestSchema.parse(parseJson(manifestResponse.body));
    expect(parsedManifest).toMatchObject({
      kiosk: {
        id: fixture.kioskId,
        label: 'Kiosque API-02/03',
        idleTimeoutSeconds: 90,
        deviceType: 'TOUCH_AND_HEADSET',
      },
      hotel: { id: fixture.hotelId, name: 'Hôtel API-02/03' },
      selection: {
        featuredTourId: fixture.tourId,
        attractTourIds: [fixture.tourId],
        tours: [{ id: fixture.tourId, contentVersion: 3, sizeBytes: 0, url: `/api/v1/tours/${fixture.tourId}` }],
      },
    });

    const heartbeatPayload = {
      appVersion: '2.4.1',
      syncedManifestVersion: parsedManifest.manifestVersion,
      storageFreeMb: 4096,
      recentErrors: ['cache refreshed'],
    };
    const heartbeatResponse = await heartbeat(fixture.token, heartbeatPayload);
    expect(heartbeatResponse.statusCode).toBe(200);
    expect(HeartbeatResponseSchema.parse(parseJson(heartbeatResponse.body))).toMatchObject({ forceSync: false });
    const heartbeatRow = await prisma.kiosk.findUniqueOrThrow({ where: { id: fixture.kioskId } });
    expect(heartbeatRow).toMatchObject({
      appVersion: '2.4.1',
      syncedManifestVersion: parsedManifest.manifestVersion,
      storageFreeMb: 4096,
      lastIp: '127.0.0.1',
    });
    expect(heartbeatRow.lastHeartbeatAt).toBeInstanceOf(Date);

    const forceSyncResponse = await send('POST', `/api/v1/admin/kiosks/${fixture.kioskId}/force-sync`, admin);
    expect(forceSyncResponse.statusCode).toBe(204);
    const pendingSync = await prisma.kiosk.findUniqueOrThrow({ where: { id: fixture.kioskId } });
    expect(pendingSync.forceSyncRequestedAt).toBeInstanceOf(Date);

    const forceSyncHeartbeat = await heartbeat(fixture.token, heartbeatPayload);
    expect(forceSyncHeartbeat.statusCode).toBe(200);
    expect(HeartbeatResponseSchema.parse(parseJson(forceSyncHeartbeat.body)).forceSync).toBe(true);

    const acknowledgement = await manifest(fixture.token);
    expect(acknowledgement.statusCode).toBe(200);
    KioskManifestSchema.parse(parseJson(acknowledgement.body));
    await expect(
      prisma.kiosk.findUniqueOrThrow({ where: { id: fixture.kioskId }, select: { forceSyncRequestedAt: true } }),
    ).resolves.toEqual({ forceSyncRequestedAt: null });

    const disableResponse = await send('POST', `/api/v1/admin/kiosks/${fixture.kioskId}/disable`, admin);
    expect(disableResponse.statusCode).toBe(200);
    const revoked = await prisma.kiosk.findUniqueOrThrow({ where: { id: fixture.kioskId }, select: { tokenHash: true } });
    expect(revoked.tokenHash).toBeNull();
    // disable() révoque le hash. Le remettre ici permet d'exercer le 403 KIOSK_DISABLED du guard
    // pour un jeton encore reconnu; sans cela, le chemin HTTP retourne 401 avant le contrôle du statut.
    await prisma.kiosk.update({
      where: { id: fixture.kioskId },
      data: { tokenHash: createHash('sha256').update(fixture.token).digest('hex') },
    });
    const disabledManifest = await manifest(fixture.token);
    const disabledHeartbeat = await heartbeat(fixture.token, heartbeatPayload);
    for (const response of [disabledManifest, disabledHeartbeat]) {
      expect(response.statusCode).toBe(403);
      expect(ErrorResponseSchema.parse(parseJson(response.body)).error).toEqual({
        code: KIOSK_DISABLED,
        message: KIOSK_DISABLED_MESSAGE,
      });
    }
  });

  it("un kiosque de l'hôtel A ne reçoit que les visites de la sélection de l'hôtel A", async () => {
    const admin = await login();

    const hotelA = await createEnrolledKiosk(admin, {
      hotelName: 'Hôtel A Rabat',
      hotelEmail: 'contact@hotel-a.ma',
      kioskLabel: 'Kiosque Hôtel A',
      tourTitles: ['Visite A1 des Oudayas', 'Visite A2 du Chellah'],
    });

    const hotelB = await createEnrolledKiosk(admin, {
      hotelName: 'Hôtel B Casablanca',
      hotelEmail: 'contact@hotel-b.ma',
      kioskLabel: 'Kiosque Hôtel B',
      tourTitles: ['Visite B1 de la Corniche', 'Visite B2 des Habous'],
    });

    const creator = await prisma.user.findUniqueOrThrow({ where: { id: admin.userId } });
    const cityC = await prisma.city.create({
      data: { name: { fr: 'Fès' }, region: 'Fès-Meknès', lat: 34.03, lng: -5.0 },
    });
    const coverC = await prisma.asset.create({
      data: {
        kind: 'IMAGE',
        originalKey: 'kiosk-device-test/unselected-cover-c.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        width: 100,
        height: 50,
        contentHash: 'kiosk-device-test-unselected-cover-hash-c',
        processingStatus: 'READY',
      },
    });
    const tourC = await prisma.tour.create({
      data: {
        title: { fr: 'Visite Hors Sélection C' },
        summary: { fr: 'Visite non sélectionnée' },
        cityId: cityC.id,
        coverAssetId: coverC.id,
        createdById: creator.id,
        contentVersion: 1,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    // Erreur : requête avec jeton d'autorisation invalide
    const unauthorizedResponse = await application().inject({
      method: 'GET',
      url: '/api/v1/kiosk/manifest',
      headers: { authorization: 'Bearer faux-jeton-cloisonnement' },
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    // Kiosque A : récupère uniquement la sélection de l'hôtel A
    const responseA = await manifest(hotelA.token);
    expect(responseA.statusCode).toBe(200);
    const manifestA = KioskManifestSchema.parse(parseJson(responseA.body));

    expect(manifestA.hotel.id).toBe(hotelA.hotelId);
    expect(manifestA.hotel.name).toBe('Hôtel A Rabat');
    const manifestTourIdsA = manifestA.selection.tours.map((tour) => tour.id);
    expect(manifestTourIdsA).toHaveLength(hotelA.tourIds.length);
    for (const expectedTourId of hotelA.tourIds) {
      expect(manifestTourIdsA).toContain(expectedTourId);
    }
    for (const forbiddenTourId of hotelB.tourIds) {
      expect(manifestTourIdsA).not.toContain(forbiddenTourId);
    }
    expect(manifestTourIdsA).not.toContain(tourC.id);
    expect(manifestA.selection.featuredTourId).toBe(hotelA.tourId);
    expect(hotelB.tourIds).not.toContain(manifestA.selection.featuredTourId);
    for (const attractId of manifestA.selection.attractTourIds) {
      expect(hotelA.tourIds).toContain(attractId);
      expect(hotelB.tourIds).not.toContain(attractId);
    }

    // Kiosque B : récupère uniquement la sélection de l'hôtel B
    const responseB = await manifest(hotelB.token);
    expect(responseB.statusCode).toBe(200);
    const manifestB = KioskManifestSchema.parse(parseJson(responseB.body));

    expect(manifestB.hotel.id).toBe(hotelB.hotelId);
    expect(manifestB.hotel.name).toBe('Hôtel B Casablanca');
    const manifestTourIdsB = manifestB.selection.tours.map((tour) => tour.id);
    expect(manifestTourIdsB).toHaveLength(hotelB.tourIds.length);
    for (const expectedTourId of hotelB.tourIds) {
      expect(manifestTourIdsB).toContain(expectedTourId);
    }
    for (const forbiddenTourId of hotelA.tourIds) {
      expect(manifestTourIdsB).not.toContain(forbiddenTourId);
    }
    expect(manifestTourIdsB).not.toContain(tourC.id);
    expect(manifestB.selection.featuredTourId).toBe(hotelB.tourId);
    expect(hotelA.tourIds).not.toContain(manifestB.selection.featuredTourId);
    for (const attractId of manifestB.selection.attractTourIds) {
      expect(hotelB.tourIds).toContain(attractId);
      expect(hotelA.tourIds).not.toContain(attractId);
    }
  });
});

interface CreateEnrolledKioskOptions {
  hotelName?: string;
  hotelEmail?: string;
  kioskLabel?: string;
  tourTitles?: string[];
}

async function createEnrolledKiosk(
  admin: Session,
  options?: CreateEnrolledKioskOptions,
): Promise<{
  hotelId: string;
  hotelName: string;
  kioskId: string;
  token: string;
  tourId: string;
  tourIds: string[];
}> {
  const hotelName = options?.hotelName ?? 'Hôtel API-02/03';
  const hotelEmail = options?.hotelEmail ?? 'contact@oudayas.ma';
  const kioskLabel = options?.kioskLabel ?? 'Kiosque API-02/03';
  const tourTitles = options?.tourTitles ?? ['Kasbah des Oudayas'];

  const city = await prisma.city.create({
    data: { name: { fr: 'Rabat' }, region: 'Rabat-Salé-Kénitra', lat: 34.02, lng: -6.84 },
  });
  const hotelResponse = await send('POST', '/api/v1/admin/hotels', admin, buildHotelCreate(city.id, hotelName, hotelEmail));
  expect(hotelResponse.statusCode).toBe(201);
  const hotel = HotelResponseSchema.parse(parseJson(hotelResponse.body));
  const kioskResponse = await send('POST', '/api/v1/admin/kiosks', admin, {
    label: kioskLabel, hotelId: hotel.id, deviceType: 'TOUCH_AND_HEADSET',
  });
  expect(kioskResponse.statusCode).toBe(201);
  const kioskId = KioskSchema.parse(parseJson(kioskResponse.body)).id;
  const enrollmentCodeResponse = await send('POST', `/api/v1/admin/kiosks/${kioskId}/enrollment-code`, admin);
  expect(enrollmentCodeResponse.statusCode).toBe(200);
  const { code } = EnrollmentCodeResponseSchema.parse(parseJson(enrollmentCodeResponse.body));
  const enrollResponse = await application().inject({
    method: 'POST',
    url: '/api/v1/kiosk/enroll',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ code, deviceInfo: { userAgent: 'Xplor kiosk integration test' } }),
  });
  expect(enrollResponse.statusCode).toBe(200);
  const enrolled = EnrollResponseSchema.parse(parseJson(enrollResponse.body));
  expect(enrolled.kioskId).toBe(kioskId);
  await expect(prisma.kiosk.findUniqueOrThrow({ where: { id: kioskId }, select: { tokenHash: true } }))
    .resolves.toEqual({ tokenHash: createHash('sha256').update(enrolled.token).digest('hex') });

  const creator = await prisma.user.findUniqueOrThrow({ where: { id: admin.userId } });
  const createdTours: Array<{ id: string }> = [];
  for (let index = 0; index < tourTitles.length; index += 1) {
    const title = tourTitles[index];
    if (title === undefined) {
      continue;
    }
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cover = await prisma.asset.create({
      data: {
        kind: 'IMAGE',
        originalKey: `kiosk-device-test/${slug}-${String(index)}-cover.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        width: 100,
        height: 50,
        contentHash: `kiosk-device-test-cover-${slug}-${String(index)}`,
        processingStatus: 'READY',
      },
    });
    const tour = await prisma.tour.create({
      data: {
        title: { fr: title },
        summary: { fr: `Visite de test ${title}` },
        cityId: city.id,
        coverAssetId: cover.id,
        createdById: creator.id,
        contentVersion: 3,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    createdTours.push({ id: tour.id });
  }

  const primaryTour = createdTours.find((_, index) => index === 0);
  if (primaryTour === undefined) {
    throw new Error('Au moins une visite est requise pour la sélection');
  }

  await prisma.selection.create({
    data: {
      hotelId: hotel.id,
      featuredTourId: primaryTour.id,
      attractTourIds: createdTours.map((tour) => tour.id),
      version: 5,
      items: {
        create: createdTours.map((tour, index) => ({
          tourId: tour.id,
          position: index,
        })),
      },
    },
  });
  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    kioskId,
    token: enrolled.token,
    tourId: primaryTour.id,
    tourIds: createdTours.map((tour) => tour.id),
  };
}

function buildHotelCreate(cityId: string, name = 'Hôtel API-02/03', email = 'contact@oudayas.ma'): HotelCreate {
  return {
    name, stars: HotelStars.FIVE, cityId, address: '1 avenue des Oudayas, Rabat',
    phone: '+212537000001', email, logoAssetId: null, brandColor: '#6958A5',
    languages: ['fr', 'ar', 'en'], contractType: ContractType.RENTAL,
    contractStart: '2026-01-01T00:00:00.000Z', contractEnd: '2027-01-01T00:00:00.000Z', active: true,
  };
}

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideGuard(ThrottlerGuard)
    .useValue(allowThrottle)
    .compile();
  const instance = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await instance.register(fastifyCookie);
  instance.getHttpAdapter().getInstance().decorate('sessionCookie', {
    name: SESSION_COOKIE_NAME, ...sessionCookieOptions(env.NODE_ENV === 'production'),
  });
  instance.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/health', method: RequestMethod.GET }] });
  await instance.init();
  await instance.getHttpAdapter().getInstance().ready();
  return instance;
}

function integrationEnv(): Env {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl === undefined || redisUrl.trim() === '') throw new Error(MISSING_REDIS_URL);
  return loadEnv({
    NODE_ENV: 'test', DATABASE_URL: databaseUrl, REDIS_URL: redisUrl,
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'xplor', S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'xplor-dev-secret',
    S3_BUCKET: process.env.S3_BUCKET ?? 'xplor', SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
    SMTP_PORT: process.env.SMTP_PORT ?? '1025',
    SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-session-secret-not-for-production',
    ADMIN_BASE_URL: process.env.ADMIN_BASE_URL,
  });
}

async function seedDemoUsers(): Promise<void> {
  for (const user of buildSeedUsers(seedPassword, passwordHash)) {
    await prisma.user.create({
      data: {
        email: user.email, name: user.name, passwordHash: user.passwordHash,
        role: toPrismaRole(user.role), active: user.active, uiLang: user.uiLang,
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

interface Session { sessionId: string; csrfToken: string; userId: string }

async function login(): Promise<Session> {
  const response = await application().inject({
    method: 'POST', url: '/api/v1/auth/login', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email: ADMIN_EMAIL, password: seedPassword }),
  });
  expect(response.statusCode).toBe(200);
  const me = MeResponseSchema.parse(parseJson(response.body));
  return { sessionId: requireSessionCookie(response), csrfToken: me.csrfToken, userId: me.id };
}

function send(method: 'POST', url: string, session: Session, body?: unknown): Promise<Injected> {
  const headers: Record<string, string> = {
    cookie: `${SESSION_COOKIE_NAME}=${session.sessionId}`, 'x-csrf-token': session.csrfToken,
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return application().inject({ method, url, headers, payload: body === undefined ? undefined : JSON.stringify(body) });
}

function manifest(token: string): Promise<Injected> {
  return application().inject({ method: 'GET', url: '/api/v1/kiosk/manifest', headers: { authorization: `Bearer ${token}` } });
}

function heartbeat(token: string | null, body: KioskHeartbeatRequest = {
  appVersion: '2.4.1', syncedManifestVersion: null, storageFreeMb: null, recentErrors: [],
}): Promise<Injected> {
  return application().inject({
    method: 'POST', url: '/api/v1/kiosk/heartbeat',
    headers: {
      'content-type': 'application/json',
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    payload: JSON.stringify(body),
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

function parseJson(body: string): unknown { return JSON.parse(body) as unknown }

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') throw new Error(MISSING_SEED_PASSWORD);
  return password;
}
