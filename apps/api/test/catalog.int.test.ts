/**
 * CRUD HTTP des villes et des catégories (API-25).
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
  type CategoryCreate,
  type CategoryResponse,
  type CityCreate,
  type CityResponse,
} from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppModule } from '../src/app.module.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { CATEGORY_IN_USE_MESSAGE, CITY_IN_USE_MESSAGE, IN_USE } from '../src/catalog/catalog.errors.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP du catalogue ont besoin de Redis (voir .env.example et docs/INSTALL.md).";

const EDITOR_EMAIL = 'editor@xplor.local';
const PARTNER_EMAIL = 'partner@xplor.local';
const MANAGER_EMAIL = 'manager@xplor.local';

const cityBody: CityCreate = {
  name: { fr: 'Testville', ar: 'تجربة', en: 'Testville' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.02,
  lng: -6.84,
};

const cityUpdate: CityCreate = {
  name: { fr: 'Testville nord', ar: 'تجربة', en: 'North Testville' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.03,
  lng: -6.85,
};

const categoryBody: CategoryCreate = {
  name: { fr: 'Test catégorie', ar: 'تصنيف', en: 'Test category' },
  icon: 'landmark',
  color: '#1F6F8B',
  weight: 1,
};

const categoryUpdate: CategoryCreate = {
  ...categoryBody,
  name: { fr: 'Test catégorie bis', ar: 'تصنيف', en: 'Test category two' },
  weight: 2,
};

const inUseBody = z.object({
  error: z.object({
    code: z.literal(IN_USE),
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

describe('catalogue HTTP', () => {
  it('répond 401 sans session', async () => {
    const cities = await application().inject({ method: 'GET', url: '/api/v1/admin/cities' });
    const categories = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/categories',
    });
    expect(cities.statusCode).toBe(401);
    expect(categories.statusCode).toBe(401);
  });

  it('répond 403 sans jeton CSRF', async () => {
    const session = await login(EDITOR_EMAIL);
    const response = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/cities',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(session.sessionId),
      },
      payload: JSON.stringify(cityBody),
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuse l’écriture à PARTNER et HOTEL_MANAGER, et autorise leur lecture', async () => {
    const partner = await login(PARTNER_EMAIL);
    const partnerWrite = await send('POST', '/api/v1/admin/cities', partner, cityBody);
    expect(partnerWrite.statusCode).toBe(403);
    const partnerRead = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/cities',
      headers: { cookie: sessionCookie(partner.sessionId) },
    });
    expect(partnerRead.statusCode).toBe(200);

    const manager = await login(MANAGER_EMAIL);
    const managerWrite = await send('POST', '/api/v1/admin/categories', manager, categoryBody);
    expect(managerWrite.statusCode).toBe(403);
  });

  it('laisse un EDITOR créer, lire, remplacer et supprimer', async () => {
    const editor = await login(EDITOR_EMAIL);

    const createdCity = await send('POST', '/api/v1/admin/cities', editor, cityBody);
    expect(createdCity.statusCode).toBe(201);
    const city = CityResponseSchema.parse(parseJson(createdCity.body));
    expect(city.name).toEqual(cityBody.name);

    const listed = await application().inject({
      method: 'GET',
      url: '/api/v1/admin/cities',
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(listed.statusCode).toBe(200);
    const cities = z.array(CityResponseSchema).parse(parseJson(listed.body));
    expect(cities.map((item) => item.id)).toContain(city.id);

    const read = await application().inject({
      method: 'GET',
      url: `/api/v1/admin/cities/${city.id}`,
      headers: { cookie: sessionCookie(editor.sessionId) },
    });
    expect(read.statusCode).toBe(200);

    const patched = await send('PATCH', `/api/v1/admin/cities/${city.id}`, editor, cityUpdate);
    expect(patched.statusCode).toBe(200);
    expect(CityResponseSchema.parse(parseJson(patched.body)).name.fr).toBe(cityUpdate.name.fr);

    const removed = await send('DELETE', `/api/v1/admin/cities/${city.id}`, editor);
    expect(removed.statusCode).toBe(204);
    expect(await prisma.city.count({ where: { id: city.id } })).toBe(0);

    const createdCategory = await send('POST', '/api/v1/admin/categories', editor, categoryBody);
    expect(createdCategory.statusCode).toBe(201);
    const category = CategoryResponseSchema.parse(parseJson(createdCategory.body));

    const patchedCategory = await send(
      'PATCH',
      `/api/v1/admin/categories/${category.id}`,
      editor,
      categoryUpdate,
    );
    expect(patchedCategory.statusCode).toBe(200);
    expect(CategoryResponseSchema.parse(parseJson(patchedCategory.body)).weight).toBe(2);

    const removedCategory = await send(
      'DELETE',
      `/api/v1/admin/categories/${category.id}`,
      editor,
    );
    expect(removedCategory.statusCode).toBe(204);
  });

  it('répond 409 IN_USE quand la ville ou la catégorie est encore liée à une visite', async () => {
    const editor = await login(EDITOR_EMAIL);
    const createdCity = await send('POST', '/api/v1/admin/cities', editor, cityBody);
    expect(createdCity.statusCode).toBe(201);
    const city = CityResponseSchema.parse(parseJson(createdCity.body));
    const createdCategory = await send('POST', '/api/v1/admin/categories', editor, categoryBody);
    expect(createdCategory.statusCode).toBe(201);
    const category = CategoryResponseSchema.parse(parseJson(createdCategory.body));
    await linkTour(city, category);

    const cityDenied = await send('DELETE', `/api/v1/admin/cities/${city.id}`, editor);
    expect(cityDenied.statusCode).toBe(409);
    expect(inUseBody.parse(parseJson(cityDenied.body))).toEqual({
      error: { code: IN_USE, message: CITY_IN_USE_MESSAGE },
    });

    const categoryDenied = await send('DELETE', `/api/v1/admin/categories/${category.id}`, editor);
    expect(categoryDenied.statusCode).toBe(409);
    expect(inUseBody.parse(parseJson(categoryDenied.body)).error.message).toBe(
      CATEGORY_IN_USE_MESSAGE,
    );
    expect(await prisma.city.count({ where: { id: city.id } })).toBe(1);
    expect(await prisma.category.count({ where: { id: category.id } })).toBe(1);
  });
});

async function linkTour(city: CityResponse, category: CategoryResponse): Promise<void> {
  const editor = await prisma.user.findUnique({ where: { email: EDITOR_EMAIL } });
  if (editor === null) {
    throw new Error('éditeur de démonstration absent');
  }
  const asset = await prisma.asset.create({
    data: {
      kind: AssetKind.IMAGE,
      originalKey: 'int/cover.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      contentHash: 'catalog-int-cover',
    },
  });
  await prisma.tour.create({
    data: {
      title: { fr: 'Visite liée' },
      summary: { fr: 'Résumé utilisé pour le conflit IN_USE.' },
      cityId: city.id,
      coverAssetId: asset.id,
      createdById: editor.id,
      categories: { create: { categoryId: category.id } },
    },
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

interface Session {
  sessionId: string;
  csrfToken: string;
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
  return { sessionId: requireSessionCookie(response), csrfToken: me.csrfToken };
}

function send(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  session: Session,
  body?: CityCreate | CategoryCreate,
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
