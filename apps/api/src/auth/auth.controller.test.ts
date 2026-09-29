import 'reflect-metadata';

import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role, type MeResponse } from '@xplor/shared';
import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';

import { AuthController } from './auth.controller.js';
import { AuthModule } from './auth.module.js';
import { ACCOUNT_LOCKED, AuthRejectedError, INVALID_CREDENTIALS } from './auth.errors.js';
import type { AuthService, LoginResult } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { SESSION_COOKIE_NAME, type SessionCookieOptions } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SessionGuard } from './session.guard.js';

const me: MeResponse = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada',
  role: Role.EDITOR,
  uiLang: 'fr',
  csrfToken: 'csrf-token',
};

type CookieCall = {
  op: 'set' | 'clear';
  name: string;
  value?: string;
  options: SessionCookieOptions;
};

function replySpy(): { reply: FastifyReply; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const reply = {
    setCookie(name: string, value: string, options: SessionCookieOptions): void {
      cookies.push({ op: 'set', name, value, options });
    },
    clearCookie(name: string, options: SessionCookieOptions): void {
      cookies.push({ op: 'clear', name, options });
    },
  };
  return { reply: reply as unknown as FastifyReply, cookies };
}

/** Clé de métadonnée Nest pour `@UseGuards` (`GUARDS_METADATA`). */
const GUARDS_METADATA = '__guards__';

function handler(name: 'login' | 'logout' | 'me'): object {
  const value: unknown = Object.getOwnPropertyDescriptor(AuthController.prototype, name)?.value;
  if (typeof value !== 'function') {
    throw new Error(`Méthode absente : ${name}`);
  }
  return value;
}

function controllerFor(
  auth: Partial<AuthService>,
  nodeEnv: 'development' | 'test' | 'production' = 'test',
): AuthController {
  return new AuthController(auth as AuthService, { NODE_ENV: nodeEnv });
}

describe('AuthController', () => {
  it('expose le module d’authentification', () => {
    expect(AuthModule).toBeDefined();
  });

  it('pose xplor_sid et renvoie MeResponse après un login', async () => {
    const result: LoginResult = { sessionId: 'sid-neuf', me };
    const auth = {
      login: () => Promise.resolve(result),
    };
    const { reply, cookies } = replySpy();
    const controller = controllerFor(auth, 'production');

    await expect(
      controller.login({ email: 'ada@xplor.test', password: 'secret' }, reply),
    ).resolves.toEqual(me);
    expect(cookies).toEqual([
      {
        op: 'set',
        name: SESSION_COOKIE_NAME,
        value: 'sid-neuf',
        options: { httpOnly: true, sameSite: 'lax', secure: true, path: '/' },
      },
    ]);
  });

  it('traduit INVALID_CREDENTIALS en 401 et ACCOUNT_LOCKED en 423', async () => {
    const { reply } = replySpy();
    const invalid = controllerFor({
      login: () => Promise.reject(new AuthRejectedError(401, INVALID_CREDENTIALS)),
    });
    const locked = controllerFor({
      login: () => Promise.reject(new AuthRejectedError(423, ACCOUNT_LOCKED)),
    });

    await expect(
      invalid.login({ email: 'ada@xplor.test', password: 'x' }, reply),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      invalid.login({ email: 'ada@xplor.test', password: 'x' }, reply),
    ).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      locked.login({ email: 'ada@xplor.test', password: 'x' }, reply),
    ).rejects.toMatchObject({
      status: 423,
    });
  });

  it('refuse un corps de login invalide', async () => {
    const { reply } = replySpy();
    const controller = controllerFor({
      login: () => Promise.reject(new Error('ne doit pas être appelé')),
    });

    await expect(controller.login({ email: 'pas-un-email' }, reply)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('détruit la session et efface le cookie au logout', async () => {
    const destroyed: string[] = [];
    const controller = controllerFor({
      logout: (sessionId: string) => {
        destroyed.push(sessionId);
        return Promise.resolve();
      },
    });
    const { reply, cookies } = replySpy();
    const request: SessionRequest = { method: 'POST', headers: {}, sessionId: 'sid-courant' };

    await controller.logout(request, reply);

    expect(destroyed).toEqual(['sid-courant']);
    expect(cookies).toEqual([
      {
        op: 'clear',
        name: SESSION_COOKIE_NAME,
        options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/' },
      },
    ]);
  });

  it('refuse le logout sans identifiant de session', async () => {
    const controller = controllerFor({ logout: () => Promise.resolve() });
    const { reply } = replySpy();

    await expect(controller.logout({ method: 'POST', headers: {} }, reply)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('renvoie MeResponse pour me et traduit un refus en 401', async () => {
    const ok = controllerFor({
      me: () => Promise.resolve(me),
    });
    const refused = controllerFor({
      me: () => Promise.reject(new AuthRejectedError(401, INVALID_CREDENTIALS)),
    });
    const request: SessionRequest = {
      method: 'GET',
      headers: {},
      principal: { userId: 'user-1', role: Role.EDITOR, hotelIds: [] },
      session: { userId: 'user-1', csrfToken: 'csrf-token', createdAt: '2026-09-29T00:00:00.000Z' },
    };

    await expect(ok.me(request)).resolves.toEqual(me);
    await expect(refused.me(request)).rejects.toMatchObject({ status: 401 });
  });

  it('laisse passer une erreur qui n’est pas un refus d’authentification', async () => {
    const { reply } = replySpy();
    const controller = controllerFor({
      login: () => Promise.reject(new Error('panne')),
    });

    await expect(
      controller.login({ email: 'ada@xplor.test', password: 'secret' }, reply),
    ).rejects.toThrow('panne');
  });

  it('limite POST login et protège logout et me', () => {
    const login = handler('login');
    const logout = handler('logout');
    const meHandler = handler('me');

    expect(Reflect.getMetadata(GUARDS_METADATA, login)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', login)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', login)).toBe(60_000);
    expect(Reflect.getMetadata(GUARDS_METADATA, logout)).toEqual([SessionGuard, CsrfGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, meHandler)).toEqual([SessionGuard]);
  });
});
