/**
 * Flux HTTP d'authentification (F-90) sur l'application Nest réelle.
 * PostgreSQL : `DATABASE_URL_TEST`. Redis : `REDIS_URL`. Courriels : `FakeMailer`.
 */
import 'reflect-metadata';

import fastifyCookie from '@fastify/cookie';
import { RequestMethod, type CanActivate } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import { MeResponseSchema, Role, type InviteUserRequest, type MeResponse } from '@xplor/shared';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ACCOUNT_LOCKED, INVALID_CREDENTIALS } from '../src/auth/auth.errors.js';
import { toPrismaRole } from '../src/auth/prisma-role.js';
import { PasswordService } from '../src/auth/password.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../src/auth/session-cookie.js';
import { AppModule } from '../src/app.module.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { FakeMailer } from '../src/mail/fake-mailer.js';
import { MAILER } from '../src/mail/mailer.js';
import { REDIS } from '../src/redis/redis.module.js';
import { buildSeedUsers } from '../src/seed/seed-users.js';
import { readDatabaseUrlTest, resetDb } from './global-setup.js';

const MISSING_SEED_PASSWORD =
  "SEED_DEFAULT_PASSWORD est absent. Les tests d'intégration du seed en ont besoin (voir .env.example et docs/INSTALL.md).";

const MISSING_REDIS_URL =
  "REDIS_URL est absent. Les tests HTTP d'authentification ont besoin de Redis (voir .env.example et docs/INSTALL.md).";

const ADMIN_EMAIL = 'admin@xplor.local';
const EDITOR_EMAIL = 'editor@xplor.local';
const WRONG_PASSWORD = 'mot-de-passe-faux-xplor';
const RESET_PASSWORD = 'xplor-reset-integ-2026';
const INVITE_PASSWORD = 'xplor-invite-integ-2026';
const INVITE_EMAIL = 'invite-int@xplor.test';

const databaseUrl = readDatabaseUrlTest();
const savedDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({
  datasourceUrl: databaseUrl,
  errorFormat: 'minimal',
});

const mailer = new FakeMailer();

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
  mailer.sent.length = 0;
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

describe('auth HTTP', () => {
  it('connecte l’ADMIN seedé, exige le CSRF au logout, puis refuse la session', async () => {
    const loggedIn = await postLogin(ADMIN_EMAIL, seedPassword);
    expect(loggedIn.statusCode).toBe(200);
    const sessionId = requireSessionCookie(loggedIn);

    const profile = await getMe(sessionId);
    expect(profile.statusCode).toBe(200);
    const me = readMe(profile.body);
    expect(me.csrfToken.length).toBeGreaterThan(0);
    expect(me.email).toBe(ADMIN_EMAIL);

    const denied = await application().inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: sessionCookie(sessionId) },
    });
    expect(denied.statusCode).toBe(403);

    const loggedOut = await application().inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: sessionCookie(sessionId),
        'x-csrf-token': me.csrfToken,
      },
    });
    expect(loggedOut.statusCode).toBe(204);

    const after = await getMe(sessionId);
    expect(after.statusCode).toBe(401);
  });

  it('incrémente failedLoginCount quand le mot de passe est faux', async () => {
    const response = await postLogin(ADMIN_EMAIL, WRONG_PASSWORD);
    expect(response.statusCode).toBe(401);
    expect(readCode(response.body)).toBe(INVALID_CREDENTIALS);
    expect(await failedLoginCount(ADMIN_EMAIL)).toBe(1);
  });

  it('verrouille le compte après 10 échecs', async () => {
    // D-40 : chacun des 10 échecs répond 401 et le 10e pose le verrou.
    // La tentative suivante répond 423 ACCOUNT_LOCKED.
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await postLogin(ADMIN_EMAIL, WRONG_PASSWORD);
      expect(response.statusCode).toBe(401);
      expect(readCode(response.body)).toBe(INVALID_CREDENTIALS);
    }
    expect(await failedLoginCount(ADMIN_EMAIL)).toBe(10);

    const locked = await postLogin(ADMIN_EMAIL, WRONG_PASSWORD);
    expect(locked.statusCode).toBe(423);
    expect(readCode(locked.body)).toBe(ACCOUNT_LOCKED);
    expect(await failedLoginCount(ADMIN_EMAIL)).toBe(10);
  });

  it('réinitialise le mot de passe via le lien du courriel et invalide l’ancienne session', async () => {
    const loggedIn = await postLogin(ADMIN_EMAIL, seedPassword);
    expect(loggedIn.statusCode).toBe(200);
    const sessionId = requireSessionCookie(loggedIn);

    const forgot = await application().inject({
      method: 'POST',
      url: '/api/v1/auth/password/forgot',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: ADMIN_EMAIL }),
    });
    expect(forgot.statusCode).toBe(202);
    const token = tokenFromMail('reset');

    const reset = await application().inject({
      method: 'POST',
      url: '/api/v1/auth/password/reset',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ token, password: RESET_PASSWORD }),
    });
    expect(reset.statusCode).toBe(204);

    const oldSession = await getMe(sessionId);
    expect(oldSession.statusCode).toBe(401);

    const again = await postLogin(ADMIN_EMAIL, RESET_PASSWORD);
    expect(again.statusCode).toBe(200);
    expect(requireSessionCookie(again).length).toBeGreaterThan(0);
  });

  it('laisse le compte invité inactif jusqu’à l’acceptation, puis autorise la connexion', async () => {
    const loggedIn = await postLogin(ADMIN_EMAIL, seedPassword);
    const sessionId = requireSessionCookie(loggedIn);
    const me = readMe((await getMe(sessionId)).body);

    const invite: InviteUserRequest = {
      email: INVITE_EMAIL,
      name: 'Invité intégration',
      role: Role.EDITOR,
      uiLang: 'fr',
    };
    const created = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/users/invitations',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(sessionId),
        'x-csrf-token': me.csrfToken,
      },
      payload: JSON.stringify(invite),
    });
    expect(created.statusCode).toBe(201);
    expect(await isActive(INVITE_EMAIL)).toBe(false);

    const accepted = await application().inject({
      method: 'POST',
      url: '/api/v1/auth/invite/accept',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ token: tokenFromMail('invite'), password: INVITE_PASSWORD }),
    });
    expect(accepted.statusCode).toBe(204);

    const session = await postLogin(INVITE_EMAIL, INVITE_PASSWORD);
    expect(session.statusCode).toBe(200);
    expect(requireSessionCookie(session).length).toBeGreaterThan(0);
  });

  it('refuse POST /admin/users/invitations à un EDITOR', async () => {
    const loggedIn = await postLogin(EDITOR_EMAIL, seedPassword);
    expect(loggedIn.statusCode).toBe(200);
    const sessionId = requireSessionCookie(loggedIn);
    const me = readMe(loggedIn.body);

    const response = await application().inject({
      method: 'POST',
      url: '/api/v1/admin/users/invitations',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie(sessionId),
        'x-csrf-token': me.csrfToken,
      },
      payload: JSON.stringify({
        email: 'autre@xplor.test',
        name: 'Autre',
        role: Role.PARTNER,
        uiLang: 'fr',
      } satisfies InviteUserRequest),
    });
    expect(response.statusCode).toBe(403);
  });
});

async function startApplication(): Promise<NestFastifyApplication> {
  const env = integrationEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
  })
    .overrideProvider(MAILER)
    .useValue(mailer)
    // ThrottlerGuard est coupé dans ce module de test seulement (production : 5/min, D-40).
    // Le verrouillage enchaîne plus de cinq POST /auth/login, qui répondraient sinon 429.
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

function postLogin(email: string, password: string): Promise<Injected> {
  return application().inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password }),
  });
}

function getMe(sessionId: string): Promise<Injected> {
  return application().inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: sessionCookie(sessionId) },
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

function readMe(body: string): MeResponse {
  return MeResponseSchema.parse(parseJson(body));
}

function readCode(body: string): string | undefined {
  const value = parseJson(body);
  if (typeof value !== 'object' || value === null || !('code' in value)) {
    return undefined;
  }
  const code = value.code;
  return typeof code === 'string' ? code : undefined;
}

function parseJson(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function tokenFromMail(kind: 'reset' | 'invite'): string {
  const message = mailer.sent.at(-1);
  if (message === undefined) {
    throw new Error('courriel absent');
  }
  const marker = kind === 'reset' ? '/reset/' : '/invite/';
  const match = new RegExp(`${marker}([A-Za-z0-9_-]+)`).exec(message.text);
  const token = match?.[1];
  if (token === undefined || token.length === 0) {
    throw new Error('jeton absent du courriel');
  }
  return token;
}

async function failedLoginCount(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null) {
    throw new Error(`compte absent : ${email}`);
  }
  return user.failedLoginCount;
}

async function isActive(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null) {
    throw new Error(`compte absent : ${email}`);
  }
  return user.active;
}

function readSeedPassword(): string {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  if (password === undefined || password.trim() === '') {
    throw new Error(MISSING_SEED_PASSWORD);
  }
  return password;
}
