/**
 * Tests d'intégration pour les statistiques de consultation (M7 F-81/F-82).
 * Vérifie le point de terminaison GET /api/v1/admin/stats (et export.csv) :
 * - Agrégats complets (totaux, séries journalières, histogramme horaire, classements, langues/canaux)
 * - Filtres individuels (hôtel, visite, canal, langue, période)
 * - Combinaisons de filtres
 * - Cloisonnement multi-tenant (un gestionnaire de l'hôtel A ne voit pas l'hôtel B)
 * - Contrôle d'accès (401 sans session, 403 pour EDITOR ou gestionnaire sans hôtel)
 * - Validation des paramètres de requête (400)
 * - Export CSV
 */
import 'reflect-metadata';

import { createHash } from 'node:crypto';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  EVENT_CHANNELS,
  MeResponseSchema,
  Role,
  StatsDashboardSchema,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { sessionKey, userSessionsKey } from '../src/auth/session-store.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { makeStatsDemoEvents, type DemoTour } from '../prisma/stats-demo.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  'REDIS_URL est absent. Les tests HTTP ont besoin de Redis (voir .env.example et docs/INSTALL.md).';

const ADMIN_EMAIL = 'admin@xplor.local';
const EDITOR_EMAIL = 'editor@xplor.local';
const MANAGER_A_EMAIL = 'manager@xplor.local';
const MANAGER_B_EMAIL = 'manager-b@xplor.local';
const MANAGER_UNATTACHED_EMAIL = 'manager-unattached@xplor.local';

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

interface CreatedSession {
  sessionId: string;
  userId: string;
}

const createdSessions: CreatedSession[] = [];

async function cleanupCreatedSessions(client: Redis): Promise<void> {
  if (createdSessions.length === 0) {
    return;
  }
  const sessionKeys: string[] = [];
  for (const session of createdSessions) {
    sessionKeys.push(sessionKey(session.sessionId));
    await client.srem(userSessionsKey(session.userId), session.sessionId);
  }
  if (sessionKeys.length > 0) {
    await client.del(...sessionKeys);
  }
  createdSessions.length = 0;
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
  const sessionId = requireSessionCookie(response);
  createdSessions.push({ sessionId, userId: me.id });
  return { sessionId, csrfToken: me.csrfToken, userId: me.id };
}

function sessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

function requireSessionCookie(response: Injected): string {
  const raw = response.headers['set-cookie'];
  const headers = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  for (const header of headers) {
    const match = /^xplor_sid=([^;]+)/.exec(header);
    if (match !== null) {
      const value = match[1];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  throw new Error('cookie xplor_sid absent');
}

function deterministicUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  const byte6 = bytes[6];
  const byte8 = bytes[8];
  if (byte6 === undefined || byte8 === undefined) {
    throw new Error('Hash truncated');
  }
  bytes[6] = (byte6 & 0x0f) | 0x40;
  bytes[8] = (byte8 & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generateHotelEvents(
  tour: DemoTour,
  hotelId: string,
  prefix: string,
  anchorDate: Date,
): Prisma.EventCreateManyInput[] {
  const rawEvents = makeStatsDemoEvents([tour], hotelId, anchorDate);
  const result: Prisma.EventCreateManyInput[] = [];
  for (const event of rawEvents) {
    const uniqueSessionId = deterministicUuid(`${prefix}-${event.sessionId}`);
    const eventDate = new Date(event.occurredAt);
    result.push({
      ...event,
      sessionId: uniqueSessionId,
      occurredAt: eventDate,
      receivedAt: eventDate,
    });
  }
  return result;
}

function getStats(
  session?: Session,
  query?: Record<string, string>,
): Promise<Injected> {
  const headers: Record<string, string> = {};
  if (session !== undefined) {
    headers.cookie = sessionCookie(session.sessionId);
  }
  let url = '/api/v1/admin/stats';
  if (query !== undefined) {
    const params = new URLSearchParams(query);
    const qs = params.toString();
    if (qs.length > 0) {
      url = `${url}?${qs}`;
    }
  }
  return application().inject({
    method: 'GET',
    url,
    headers,
  });
}

function getExportCsv(
  session?: Session,
  query?: Record<string, string>,
): Promise<Injected> {
  const headers: Record<string, string> = {};
  if (session !== undefined) {
    headers.cookie = sessionCookie(session.sessionId);
  }
  let url = '/api/v1/admin/stats/export.csv';
  if (query !== undefined) {
    const params = new URLSearchParams(query);
    const qs = params.toString();
    if (qs.length > 0) {
      url = `${url}?${qs}`;
    }
  }
  return application().inject({
    method: 'GET',
    url,
    headers,
  });
}

interface TestFixtures {
  hotelA: { id: string; name: string };
  hotelB: { id: string; name: string };
  tourA: { id: string; title: string };
  tourB: { id: string; title: string };
  sceneA: { id: string; title: string };
  sceneB: { id: string; title: string };
  expectedDays: string[];
  subWindowFrom: string;
  subWindowTo: string;
}

let fixtures: TestFixtures;
let adminSession: Session;
let editorSession: Session;
let managerASession: Session;
let managerBSession: Session;
let managerUnattachedSession: Session;

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

  await resetDb();
  await cleanupCreatedSessions(requireRedis());

  // 1. Seed demo users
  const seedUsers = buildSeedUsers(seedPassword, passwordHash);
  for (const user of seedUsers) {
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

  // Créer un second gestionnaire pour l'hôtel B et un gestionnaire sans hôtel
  const managerBUser = await prisma.user.create({
    data: {
      email: MANAGER_B_EMAIL,
      name: 'Gestionnaire B',
      passwordHash,
      role: toPrismaRole(Role.HOTEL_MANAGER),
      active: true,
      uiLang: 'fr',
    },
  });

  await prisma.user.create({
    data: {
      email: MANAGER_UNATTACHED_EMAIL,
      name: 'Gestionnaire Sans Hotel',
      passwordHash,
      role: toPrismaRole(Role.HOTEL_MANAGER),
      active: true,
      uiLang: 'fr',
    },
  });

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
  const managerAUser = await prisma.user.findUniqueOrThrow({ where: { email: MANAGER_A_EMAIL } });

  // 2. Créer Ville et Hôtels A & B
  const city = await prisma.city.create({
    data: {
      name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
      region: 'Rabat-Salé-Kénitra',
      lat: 34.02,
      lng: -6.84,
    },
  });

  const hotelA = await prisma.hotel.create({
    data: {
      name: 'Hôtel Tour Hassan Palace',
      stars: 'FIVE',
      cityId: city.id,
      address: 'Boulevard Mohamed V, Rabat',
      phone: '+212537000001',
      email: 'hotel-a@xplor.test',
      brandColor: '#6958A5',
      languages: ['fr', 'ar', 'en'],
      contractType: 'RENTAL',
      contractStart: new Date('2026-01-01T00:00:00.000Z'),
      contractEnd: new Date('2027-01-01T00:00:00.000Z'),
      active: true,
    },
  });

  const hotelB = await prisma.hotel.create({
    data: {
      name: 'Hôtel Kasbah Rabat',
      stars: 'FOUR',
      cityId: city.id,
      address: 'Avenue Al Marsa, Rabat',
      phone: '+212537000002',
      email: 'hotel-b@xplor.test',
      brandColor: '#BA4F9D',
      languages: ['fr', 'ar', 'en'],
      contractType: 'RENTAL',
      contractStart: new Date('2026-01-01T00:00:00.000Z'),
      contractEnd: new Date('2027-01-01T00:00:00.000Z'),
      active: true,
    },
  });

  // 3. Rattacher les gestionnaires à leurs hôtels
  await prisma.userHotel.createMany({
    data: [
      { userId: managerAUser.id, hotelId: hotelA.id },
      { userId: managerBUser.id, hotelId: hotelB.id },
    ],
  });

  // 4. Médias pour visites et scènes
  const coverAsset = await prisma.asset.create({
    data: {
      kind: 'IMAGE',
      originalKey: 'assets/test-cover.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      contentHash: 'hash-cover-test',
      processingStatus: 'READY',
    },
  });

  const panoAsset = await prisma.asset.create({
    data: {
      kind: 'PANORAMA',
      originalKey: 'assets/test-pano.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4096,
      contentHash: 'hash-pano-test',
      processingStatus: 'READY',
    },
  });

  // 5. Créer deux visites avec scènes
  const tourA = await prisma.tour.create({
    data: {
      title: { fr: 'Visite Tour Hassan', en: 'Hassan Tour' },
      summary: { fr: 'Découvrez la Tour Hassan' },
      cityId: city.id,
      coverAssetId: coverAsset.id,
      createdById: adminUser.id,
      status: 'PUBLISHED',
    },
  });

  const sceneA = await prisma.scene.create({
    data: {
      tourId: tourA.id,
      title: { fr: 'Minaret Hassan', en: 'Hassan Minaret' },
      panoramaAssetId: panoAsset.id,
      createdById: adminUser.id,
      weight: 0,
    },
  });

  const tourB = await prisma.tour.create({
    data: {
      title: { fr: 'Visite Kasbah Oudayas', en: 'Oudayas Tour' },
      summary: { fr: 'Découvrez les Oudayas' },
      cityId: city.id,
      coverAssetId: coverAsset.id,
      createdById: adminUser.id,
      status: 'PUBLISHED',
    },
  });

  const sceneB = await prisma.scene.create({
    data: {
      tourId: tourB.id,
      title: { fr: 'Jardin Oudayas', en: 'Oudayas Garden' },
      panoramaAssetId: panoAsset.id,
      createdById: adminUser.id,
      weight: 0,
    },
  });

  // 6. Insérer les événements déterministes sur 7 jours
  // Ancre fixée à hier 00:00 UTC pour que tous les événements soient strictement dans le passé (< now)
  // et dans la fenêtre par défaut des 30 derniers jours.
  const now = new Date();
  const anchorDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

  const demoTourA: DemoTour = { id: tourA.id, scenes: [{ id: sceneA.id }] };
  const demoTourB: DemoTour = { id: tourB.id, scenes: [{ id: sceneB.id }] };

  const eventsHotelA = generateHotelEvents(demoTourA, hotelA.id, 'hotelA', anchorDate);
  const eventsHotelB = generateHotelEvents(demoTourB, hotelB.id, 'hotelB', anchorDate);

  await prisma.event.createMany({
    data: [...eventsHotelA, ...eventsHotelB],
  });

  const days: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const d = new Date(anchorDate.getTime() - (6 - offset) * 86_400_000);
    days.push(d.toISOString().slice(0, 10));
  }

  const day1 = days[1];
  const day3 = days[3];
  if (day1 === undefined || day3 === undefined) {
    throw new Error('Jours attendus introuvables');
  }

  fixtures = {
    hotelA: { id: hotelA.id, name: hotelA.name },
    hotelB: { id: hotelB.id, name: hotelB.name },
    tourA: { id: tourA.id, title: 'Visite Tour Hassan' },
    tourB: { id: tourB.id, title: 'Visite Kasbah Oudayas' },
    sceneA: { id: sceneA.id, title: 'Minaret Hassan' },
    sceneB: { id: sceneB.id, title: 'Jardin Oudayas' },
    expectedDays: days,
    subWindowFrom: `${day1}T00:00:00.000Z`,
    subWindowTo: `${day3}T00:00:00.000Z`,
  };

  // 7. Connexion des différents utilisateurs
  adminSession = await login(ADMIN_EMAIL);
  editorSession = await login(EDITOR_EMAIL);
  managerASession = await login(MANAGER_A_EMAIL);
  managerBSession = await login(MANAGER_B_EMAIL);
  managerUnattachedSession = await login(MANAGER_UNATTACHED_EMAIL);
});

afterAll(async () => {
  await resetDb();
  if (redis !== undefined) {
    await cleanupCreatedSessions(redis);
  }
  await app?.close();
  await prisma.$disconnect();
  if (savedDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = savedDatabaseUrl;
  }
});

describe('GET /api/admin/stats (M7 F-81/F-82)', () => {
  it('(1) répond 401 si aucun cookie de session n’est fourni', async () => {
    const response = await getStats();
    expect(response.statusCode).toBe(401);
  });

  it('(2) répond 403 si l’utilisateur a le rôle EDITOR', async () => {
    const response = await getStats(editorSession);
    expect(response.statusCode).toBe(403);
  });

  it('(3) calcule les agrégats complets (totaux, séries journalières, histogramme horaire, classements, langues, canaux) pour ADMIN sans filtre', async () => {
    const response = await getStats(adminSession);
    expect(response.statusCode).toBe(200);

    const data = StatsDashboardSchema.parse(parseJson(response.body));

    // Totaux (168 sessions au total = 84 hôtel A + 84 hôtel B)
    expect(data.summary.sessions).toBe(168);
    expect(data.summary.averageSessionDurationMs).toBe(131_000);
    expect(data.summary.toursOpened).toBe(168);
    expect(data.summary.scenesViewed).toBe(168);
    expect(data.summary.hotspotClicks).toBe(84);
    expect(data.summary.vrEntries).toBe(56);
    expect(data.summary.qrScans).toBe(24);

    // Séries journalières : 7 jours consécutifs, chacun avec 24 sessions
    expect(data.daily).toHaveLength(7);
    const returnedDays = data.daily.map((entry) => entry.day);
    expect(returnedDays).toEqual(fixtures.expectedDays);
    for (const dayEntry of data.daily) {
      expect(dayEntry.sessions).toBe(24);
      expect(dayEntry.toursOpened).toBe(24);
      expect(dayEntry.scenesViewed).toBe(24);
    }

    // Histogramme horaire : 24 heures (0..23)
    expect(data.hourly).toHaveLength(24);
    for (let h = 0; h < 24; h += 1) {
      expect(data.hourly[h]?.hour).toBe(h);
    }
    const totalHourlySessions = data.hourly.reduce((acc, entry) => acc + entry.sessions, 0);
    expect(totalHourlySessions).toBe(168);

    // Classements : les deux visites et les deux scènes à égalité (84 chacune)
    expect(data.topTours).toHaveLength(2);
    expect(data.topTours).toEqual(
      expect.arrayContaining([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 84 },
        { id: fixtures.tourB.id, label: fixtures.tourB.title, opens: 84 },
      ]),
    );

    expect(data.topScenes).toHaveLength(2);
    expect(data.topScenes).toEqual(
      expect.arrayContaining([
        { id: fixtures.sceneA.id, label: fixtures.sceneA.title, views: 84 },
        { id: fixtures.sceneB.id, label: fixtures.sceneB.title, views: 84 },
      ]),
    );

    // Langues : répartition équitable (56 chacune)
    expect(data.languages).toEqual([
      { lang: 'ar', sessions: 56 },
      { lang: 'en', sessions: 56 },
      { lang: 'fr', sessions: 56 },
    ]);

    // Canaux : répartition équitable (56 chacun)
    expect(data.channels).toEqual([
      { channel: EVENT_CHANNELS.KIOSK, sessions: 56 },
      { channel: EVENT_CHANNELS.VR, sessions: 56 },
      { channel: EVENT_CHANNELS.WEB, sessions: 56 },
    ]);
  });

  describe('filtres pris individuellement', () => {
    it('(4) filtre par hôtel (hotelId) : restreint tous les agrégats à l’hôtel demandé', async () => {
      // Filtrer sur l'hôtel A
      const resA = await getStats(adminSession, { hotelId: fixtures.hotelA.id });
      expect(resA.statusCode).toBe(200);
      const dataA = StatsDashboardSchema.parse(parseJson(resA.body));

      expect(dataA.summary.sessions).toBe(84);
      expect(dataA.summary.toursOpened).toBe(84);
      expect(dataA.summary.scenesViewed).toBe(84);
      expect(dataA.summary.hotspotClicks).toBe(42);
      expect(dataA.summary.vrEntries).toBe(28);
      expect(dataA.summary.qrScans).toBe(12);
      expect(dataA.topTours).toEqual([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 84 },
      ]);
      expect(dataA.topScenes).toEqual([
        { id: fixtures.sceneA.id, label: fixtures.sceneA.title, views: 84 },
      ]);

      // Filtrer sur l'hôtel B
      const resB = await getStats(adminSession, { hotelId: fixtures.hotelB.id });
      expect(resB.statusCode).toBe(200);
      const dataB = StatsDashboardSchema.parse(parseJson(resB.body));

      expect(dataB.summary.sessions).toBe(84);
      expect(dataB.topTours).toEqual([
        { id: fixtures.tourB.id, label: fixtures.tourB.title, opens: 84 },
      ]);
      expect(dataB.topScenes).toEqual([
        { id: fixtures.sceneB.id, label: fixtures.sceneB.title, views: 84 },
      ]);
    });

    it('(5) filtre par visite (tourId) : restreint les ouvertures et vues à la visite demandée', async () => {
      const res = await getStats(adminSession, { tourId: fixtures.tourA.id });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      expect(data.summary.toursOpened).toBe(84);
      expect(data.summary.scenesViewed).toBe(84);
      expect(data.topTours).toEqual([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 84 },
      ]);
      expect(data.topScenes).toEqual([
        { id: fixtures.sceneA.id, label: fixtures.sceneA.title, views: 84 },
      ]);
    });

    it('(6) filtre par canal (channel=KIOSK, VR, WEB)', async () => {
      // Canal KIOSK : aucune entrée VR, aucun scan QR
      const resKiosk = await getStats(adminSession, { channel: EVENT_CHANNELS.KIOSK });
      expect(resKiosk.statusCode).toBe(200);
      const dataKiosk = StatsDashboardSchema.parse(parseJson(resKiosk.body));
      expect(dataKiosk.summary.sessions).toBe(56);
      expect(dataKiosk.summary.vrEntries).toBe(0);
      expect(dataKiosk.summary.qrScans).toBe(0);
      expect(dataKiosk.channels).toEqual([
        { channel: EVENT_CHANNELS.KIOSK, sessions: 56 },
      ]);

      // Canal VR : contient toutes les entrées VR
      const resVr = await getStats(adminSession, { channel: EVENT_CHANNELS.VR });
      expect(resVr.statusCode).toBe(200);
      const dataVr = StatsDashboardSchema.parse(parseJson(resVr.body));
      expect(dataVr.summary.sessions).toBe(56);
      expect(dataVr.summary.vrEntries).toBe(56);
      expect(dataVr.summary.qrScans).toBe(0);
      expect(dataVr.channels).toEqual([
        { channel: EVENT_CHANNELS.VR, sessions: 56 },
      ]);

      // Canal WEB : contient tous les scans QR
      const resWeb = await getStats(adminSession, { channel: EVENT_CHANNELS.WEB });
      expect(resWeb.statusCode).toBe(200);
      const dataWeb = StatsDashboardSchema.parse(parseJson(resWeb.body));
      expect(dataWeb.summary.sessions).toBe(56);
      expect(dataWeb.summary.vrEntries).toBe(0);
      expect(dataWeb.summary.qrScans).toBe(24);
      expect(dataWeb.channels).toEqual([
        { channel: EVENT_CHANNELS.WEB, sessions: 56 },
      ]);
    });

    it('(7) filtre par langue (lang=fr, ar, en)', async () => {
      const targetLanguages: readonly string[] = ['fr', 'ar', 'en'];
      for (const lang of targetLanguages) {
        const res = await getStats(adminSession, { lang });
        expect(res.statusCode).toBe(200);
        const data = StatsDashboardSchema.parse(parseJson(res.body));
        expect(data.summary.sessions).toBe(56);
        expect(data.languages).toEqual([{ lang, sessions: 56 }]);
      }
    });

    it('(8) filtre par période (from et to) sur une sous-fenêtre de 2 jours', async () => {
      const res = await getStats(adminSession, {
        from: fixtures.subWindowFrom,
        to: fixtures.subWindowTo,
      });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      // 2 jours * 24 sessions par jour = 48 sessions
      expect(data.summary.sessions).toBe(48);
      expect(data.summary.toursOpened).toBe(48);
      expect(data.summary.scenesViewed).toBe(48);

      expect(data.daily).toHaveLength(2);
      const day1 = fixtures.expectedDays[1];
      const day2 = fixtures.expectedDays[2];
      if (day1 === undefined || day2 === undefined) {
        throw new Error('Jours attendus introuvables');
      }
      expect(data.daily.map((e) => e.day)).toEqual([day1, day2]);
    });
  });

  describe('combinaisons de filtres', () => {
    it('(9) combine hôtel et canal : hotelId + channel=KIOSK', async () => {
      const res = await getStats(adminSession, {
        hotelId: fixtures.hotelA.id,
        channel: EVENT_CHANNELS.KIOSK,
      });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      expect(data.summary.sessions).toBe(28);
      expect(data.channels).toEqual([{ channel: EVENT_CHANNELS.KIOSK, sessions: 28 }]);
      expect(data.topTours).toEqual([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 28 },
      ]);
    });

    it('(10) combine hôtel, visite et langue : hotelId + tourId + lang=fr', async () => {
      const res = await getStats(adminSession, {
        hotelId: fixtures.hotelA.id,
        tourId: fixtures.tourA.id,
        lang: 'fr',
      });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      expect(data.summary.sessions).toBe(28);
      expect(data.languages).toEqual([{ lang: 'fr', sessions: 28 }]);
      expect(data.topTours).toEqual([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 28 },
      ]);
    });

    it('(11) combine hôtel, canal et période : hotelId + channel=VR + [from, to] (2 jours)', async () => {
      const res = await getStats(adminSession, {
        hotelId: fixtures.hotelB.id,
        channel: EVENT_CHANNELS.VR,
        from: fixtures.subWindowFrom,
        to: fixtures.subWindowTo,
      });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      // Pour l'hôtel B, 4 sessions VR par jour * 2 jours = 8 sessions
      expect(data.summary.sessions).toBe(8);
      expect(data.summary.vrEntries).toBe(8);
      expect(data.channels).toEqual([{ channel: EVENT_CHANNELS.VR, sessions: 8 }]);
      expect(data.topTours).toEqual([
        { id: fixtures.tourB.id, label: fixtures.tourB.title, opens: 8 },
      ]);
    });
  });

  describe('contrôle d’accès et isolation multi-tenant (D-04, AGENTS.md)', () => {
    it('(12) le gestionnaire de l’hôtel A ne voit que les statistiques de l’hôtel A (par défaut)', async () => {
      const res = await getStats(managerASession);
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));

      expect(data.summary.sessions).toBe(84);
      expect(data.topTours).toEqual([
        { id: fixtures.tourA.id, label: fixtures.tourA.title, opens: 84 },
      ]);
      expect(data.topScenes).toEqual([
        { id: fixtures.sceneA.id, label: fixtures.sceneA.title, views: 84 },
      ]);
    });

    it('(13) le gestionnaire de l’hôtel A peut filtrer explicitement sur son hôtel A', async () => {
      const res = await getStats(managerASession, { hotelId: fixtures.hotelA.id });
      expect(res.statusCode).toBe(200);
      const data = StatsDashboardSchema.parse(parseJson(res.body));
      expect(data.summary.sessions).toBe(84);
    });

    it('(14) le gestionnaire de l’hôtel A reçoit 404 s’il tente de filtrer sur l’hôtel B', async () => {
      const res = await getStats(managerASession, { hotelId: fixtures.hotelB.id });
      expect(res.statusCode).toBe(404);
    });

    it('(15) le gestionnaire de l’hôtel B ne voit que l’hôtel B et reçoit 404 sur l’hôtel A', async () => {
      const resDefault = await getStats(managerBSession);
      expect(resDefault.statusCode).toBe(200);
      const dataDefault = StatsDashboardSchema.parse(parseJson(resDefault.body));
      expect(dataDefault.summary.sessions).toBe(84);
      expect(dataDefault.topTours).toEqual([
        { id: fixtures.tourB.id, label: fixtures.tourB.title, opens: 84 },
      ]);

      const resAllowed = await getStats(managerBSession, { hotelId: fixtures.hotelB.id });
      expect(resAllowed.statusCode).toBe(200);

      const resForbiddenHotel = await getStats(managerBSession, { hotelId: fixtures.hotelA.id });
      expect(resForbiddenHotel.statusCode).toBe(404);
    });

    it('(16) un gestionnaire sans hôtel rattaché reçoit 403 Forbidden', async () => {
      const res = await getStats(managerUnattachedSession);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('validation des filtres (requêtes erronées 400)', () => {
    it('(17) répond 400 si from > to', async () => {
      const res = await getStats(adminSession, {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      });
      expect(res.statusCode).toBe(400);
    });

    it('(18) répond 400 si l’intervalle dépasse 366 jours', async () => {
      const res = await getStats(adminSession, {
        from: '2024-01-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      });
      expect(res.statusCode).toBe(400);
    });

    it('(19) répond 400 si une date est malformée', async () => {
      const resFrom = await getStats(adminSession, { from: 'date-invalide' });
      expect(resFrom.statusCode).toBe(400);

      const resTo = await getStats(adminSession, { to: 'autre-date-invalide' });
      expect(resTo.statusCode).toBe(400);
    });

    it('(20) répond 400 si le canal est invalide', async () => {
      const res = await getStats(adminSession, { channel: 'CANAL_INEXISTANT' });
      expect(res.statusCode).toBe(400);
    });

    it('(21) répond 400 si hotelId ou tourId n’est pas un UUID valide', async () => {
      const resHotel = await getStats(adminSession, { hotelId: 'pas-un-uuid' });
      expect(resHotel.statusCode).toBe(400);

      const resTour = await getStats(adminSession, { tourId: 'pas-un-uuid' });
      expect(resTour.statusCode).toBe(400);
    });
  });

  describe('export CSV (GET /api/admin/stats/export.csv)', () => {
    it('(22) renvoie un fichier CSV UTF-8 BOM avec les totaux, séries journalières et classements', async () => {
      const res = await getExportCsv(adminSession);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="xplor-statistiques.csv"');

      // Doit commencer par le BOM UTF-8 (\uFEFF)
      expect(res.body.startsWith('\uFEFF')).toBe(true);

      // Vérifier les lignes clés
      expect(res.body).toContain('"Indicateur";"Valeur"');
      expect(res.body).toContain('"Sessions";"168"');
      expect(res.body).toContain('"Visites ouvertes";"168"');
      expect(res.body).toContain('"Scènes vues";"168"');
      expect(res.body).toContain('"Clics sur les points";"84"');
      expect(res.body).toContain('"Entrées VR";"56"');
      expect(res.body).toContain('"Scans QR";"24"');
      expect(res.body).toContain('"Jour";"Sessions";"Visites ouvertes";"Scènes vues"');
      expect(res.body).toContain('"Top visites";"Ouvertures"');
      expect(res.body).toContain('"Top scènes";"Vues"');
    });

    it('(23) applique le cloisonnement multi-tenant sur l’export CSV pour un gestionnaire d’hôtel', async () => {
      const res = await getExportCsv(managerASession);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"Sessions";"84"');
      expect(res.body).toContain('"Visites ouvertes";"84"');
      expect(res.body).toContain(`"${fixtures.tourA.title}";"84"`);
      expect(res.body).not.toContain(`"${fixtures.tourB.title}"`);
    });

    it('(24) répond 403 sur l’export CSV si l’utilisateur est EDITOR', async () => {
      const res = await getExportCsv(editorSession);
      expect(res.statusCode).toBe(403);
    });
  });
});
