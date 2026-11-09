import 'reflect-metadata';

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role, type MeResponse } from '@xplor/shared';
import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';

import { AuthController } from './auth.controller.js';
import { AuthModule } from './auth.module.js';
import {
  ACCOUNT_LOCKED,
  AuthRejectedError,
  AuthRequestError,
  INVALID_CREDENTIALS,
  PASSWORD_INVALID,
  PASSWORD_TOO_COMMON,
  TOKEN_INVALID,
} from './auth.errors.js';
import type { AuthService, LoginResult } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { SESSION_COOKIE_NAME, type SessionCookieOptions } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SessionGuard } from './session.guard.js';
import {
  TWO_FACTOR_INVALID_CODE,
  TWO_FACTOR_NOT_ENABLED,
  TWO_FACTOR_NOT_INITIALIZED,
  TWO_FACTOR_ROLE_NOT_ALLOWED,
  TWO_FACTOR_USER_NOT_FOUND,
  TwoFactorInvalidCodeError,
  TwoFactorNotEnabledError,
  TwoFactorNotInitializedError,
  TwoFactorRoleNotAllowedError,
  TwoFactorService,
  TwoFactorUserNotFoundError,
  type TwoFactorSetupResult,
} from './two-factor.service.js';
import type { AuthUser, UserRepository } from './user.repository.js';

const me: MeResponse = {
  id: 'user-1',
  email: 'ada@xplor.test',
  name: 'Ada',
  role: Role.EDITOR,
  uiLang: 'fr',
  csrfToken: 'csrf-token',
  totpEnabled: false,
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

/** Clé de métadonnée Nest pour `@HttpCode` (`HTTP_CODE_METADATA`). */
const HTTP_CODE_METADATA = '__httpCode__';

function handler(
  name:
    | 'login'
    | 'login2fa'
    | 'logout'
    | 'me'
    | 'forgotPassword'
    | 'resetPassword'
    | 'acceptInvite'
    | 'setup2fa'
    | 'confirm2fa'
    | 'disable2fa',
): object {
  const value: unknown = Object.getOwnPropertyDescriptor(AuthController.prototype, name)?.value;
  if (typeof value !== 'function') {
    throw new Error(`Méthode absente : ${name}`);
  }
  return value;
}

class FakeTwoFactorService extends TwoFactorService {
  constructor(
    private readonly hooks: {
      beginSetup?: (userId: string, email: string) => Promise<TwoFactorSetupResult>;
      confirmSetup?: (userId: string, code: string) => Promise<void>;
      disable?: (userId: string, code: string) => Promise<void>;
      verifyLoginCode?: (userId: string, code: string) => Promise<boolean>;
    } = {},
  ) {
    super(
      {
        findById: () => Promise.resolve(null),
        updateTotp: () => Promise.resolve(),
      },
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  }

  override async beginSetup(userId: string, email: string): Promise<TwoFactorSetupResult> {
    if (this.hooks.beginSetup !== undefined) {
      return this.hooks.beginSetup(userId, email);
    }
    return {
      secret: 'fake-totp-secret',
      otpauthUri: 'otpauth://totp/Xplor:fake?secret=fake-totp-secret',
    };
  }

  override async confirmSetup(userId: string, code: string): Promise<void> {
    if (this.hooks.confirmSetup !== undefined) {
      await this.hooks.confirmSetup(userId, code);
    }
  }

  override async disable(userId: string, code: string): Promise<void> {
    if (this.hooks.disable !== undefined) {
      await this.hooks.disable(userId, code);
    }
  }

  override async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    if (this.hooks.verifyLoginCode !== undefined) {
      return this.hooks.verifyLoginCode(userId, code);
    }
    return true;
  }
}

class FakeUserRepository implements UserRepository {
  constructor(private readonly user: AuthUser | null = null) {}

  findByEmail(): Promise<AuthUser | null> {
    return Promise.resolve(this.user);
  }

  findById(): Promise<AuthUser | null> {
    return Promise.resolve(this.user);
  }

  updateLoginState(): Promise<void> {
    return Promise.resolve();
  }

  updatePassword(): Promise<void> {
    return Promise.resolve();
  }

  createInvited(): Promise<AuthUser> {
    if (this.user !== null) {
      return Promise.resolve(this.user);
    }
    return Promise.reject(new Error('User not configured'));
  }

  updateInvited(): Promise<AuthUser> {
    if (this.user !== null) {
      return Promise.resolve(this.user);
    }
    return Promise.reject(new Error('User not configured'));
  }

  activate(): Promise<void> {
    return Promise.resolve();
  }
}

const adminUser: AuthUser = {
  id: 'admin-1',
  email: 'admin@xplor.ma',
  name: 'Admin',
  passwordHash: 'hash',
  role: Role.ADMIN,
  uiLang: 'fr',
  active: true,
  totpEnabled: false,
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
};

const adminSessionRequest: SessionRequest = {
  method: 'POST',
  headers: { 'x-csrf-token': 'csrf-token' },
  principal: { userId: 'admin-1', role: Role.ADMIN, hotelIds: [] },
  session: { userId: 'admin-1', csrfToken: 'csrf-token', createdAt: '2026-09-29T00:00:00.000Z' },
  sessionId: 'sid-admin',
};

const editorSessionRequest: SessionRequest = {
  method: 'POST',
  headers: { 'x-csrf-token': 'csrf-token' },
  principal: { userId: 'editor-1', role: Role.EDITOR, hotelIds: [] },
  session: { userId: 'editor-1', csrfToken: 'csrf-token', createdAt: '2026-09-29T00:00:00.000Z' },
  sessionId: 'sid-editor',
};

const managerSessionRequest: SessionRequest = {
  method: 'POST',
  headers: { 'x-csrf-token': 'csrf-token' },
  principal: { userId: 'mgr-1', role: Role.HOTEL_MANAGER, hotelIds: ['hotel-1'] },
  session: { userId: 'mgr-1', csrfToken: 'csrf-token', createdAt: '2026-09-29T00:00:00.000Z' },
  sessionId: 'sid-mgr',
};

const unauthenticatedRequest: SessionRequest = {
  method: 'POST',
  headers: {},
};

const pending2faSessionRequest: SessionRequest = {
  method: 'POST',
  headers: { 'x-csrf-token': 'csrf-token' },
  principal: { userId: 'admin-1', role: Role.ADMIN, hotelIds: [] },
  session: {
    userId: 'admin-1',
    csrfToken: 'csrf-token',
    createdAt: '2026-09-29T00:00:00.000Z',
    pending2fa: true,
  },
  sessionId: 'sid-pending',
};

function controllerFor(
  auth: Partial<AuthService>,
  nodeEnv: 'development' | 'test' | 'production' = 'test',
): AuthController {
  return new AuthController(auth as AuthService, { NODE_ENV: nodeEnv });
}

function twoFactorController(
  twoFactor: TwoFactorService = new FakeTwoFactorService(),
  users?: UserRepository,
): AuthController {
  return new AuthController(undefined, { NODE_ENV: 'test' }, twoFactor, users);
}

describe('AuthController', () => {
  it('expose le module d’authentification', () => {
    expect(AuthModule).toBeDefined();
  });

  it('login normal inchangé : pose xplor_sid et renvoie MeResponse après un login', async () => {
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

  it('transmet l’adresse IP de la requête Fastify à AuthService.login pour l’audit (F-91)', async () => {
    let capturedIp: string | undefined;
    const result: LoginResult = { sessionId: 'sid-ip', me };
    const auth = {
      login: (_input: unknown, ip?: string) => {
        capturedIp = ip;
        return Promise.resolve(result);
      },
    };
    const { reply } = replySpy();
    const controller = controllerFor(auth, 'production');
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
      ip: '198.51.100.42',
    };

    await controller.login(
      { email: 'ada@xplor.test', password: 'secret' },
      reply,
      request,
    );
    expect(capturedIp).toBe('198.51.100.42');
  });

  it('transmet l’adresse IP de la requête Fastify à AuthService.login2fa pour l’audit (F-91)', async () => {
    let capturedIp: string | undefined;
    const auth = {
      login2fa: (_pendingSessionId: string, _code: string, ip?: string) => {
        capturedIp = ip;
        return Promise.resolve({ sessionId: 'sid-complet', me });
      },
    };
    const { reply } = replySpy();
    const controller = controllerFor(auth, 'production');
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
      cookies: { [SESSION_COOKIE_NAME]: 'sid-pending' },
      ip: '198.51.100.42',
    };

    await controller.login2fa({ code: '123456' }, request, reply);
    expect(capturedIp).toBe('198.51.100.42');
  });

  it('login ADMIN avec 2FA → { twoFactorRequired: true }', async () => {
    const result: LoginResult = { sessionId: 'sid-pending', twoFactorRequired: true };
    const auth = {
      login: () => Promise.resolve(result),
    };
    const { reply, cookies } = replySpy();
    const controller = controllerFor(auth, 'production');

    await expect(
      controller.login({ email: 'admin@xplor.test', password: 'secret' }, reply),
    ).resolves.toEqual({ twoFactorRequired: true });
    expect(cookies).toEqual([
      {
        op: 'set',
        name: SESSION_COOKIE_NAME,
        value: 'sid-pending',
        options: { httpOnly: true, sameSite: 'lax', secure: true, path: '/' },
      },
    ]);
  });

  it('login/2fa valide : valide le code, pose le cookie de session complète et renvoie MeResponse', async () => {
    const auth: Partial<AuthService> = {
      login2fa: (pendingSessionId: string, code: string) => {
        expect(pendingSessionId).toBe('sid-pending');
        expect(code).toBe('123456');
        return Promise.resolve({ sessionId: 'sid-complet', me });
      },
    };
    const { reply, cookies } = replySpy();
    const controller = controllerFor(auth, 'production');
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
      cookies: { [SESSION_COOKIE_NAME]: 'sid-pending' },
    };

    const res = await controller.login2fa({ code: '123456' }, request, reply);
    expect(res).toEqual(me);
    expect(cookies).toEqual([
      {
        op: 'set',
        name: SESSION_COOKIE_NAME,
        value: 'sid-complet',
        options: { httpOnly: true, sameSite: 'lax', secure: true, path: '/' },
      },
    ]);
  });

  it('login/2fa : code erroné → 401', async () => {
    const auth: Partial<AuthService> = {
      login2fa: () => Promise.reject(new AuthRejectedError(401, INVALID_CREDENTIALS)),
    };
    const { reply } = replySpy();
    const controller = controllerFor(auth);
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
      cookies: { [SESSION_COOKIE_NAME]: 'sid-pending' },
    };

    await expect(
      controller.login2fa({ code: '000000' }, request, reply),
    ).rejects.toMatchObject({
      status: 401,
      response: { code: INVALID_CREDENTIALS },
    });
  });

  it('login/2fa : sans cookie → 401', async () => {
    const auth: Partial<AuthService> = {
      login2fa: () => Promise.reject(new Error('ne doit pas être appelé')),
    };
    const { reply } = replySpy();
    const controller = controllerFor(auth);
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
    };

    await expect(
      controller.login2fa({ code: '123456' }, request, reply),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login/2fa : refuse un corps invalide avec 400', async () => {
    const auth: Partial<AuthService> = {
      login2fa: () => Promise.reject(new Error('ne doit pas être appelé')),
    };
    const { reply } = replySpy();
    const controller = controllerFor(auth);
    const request: SessionRequest = {
      method: 'POST',
      headers: {},
      cookies: { [SESSION_COOKIE_NAME]: 'sid-pending' },
    };

    await expect(
      controller.login2fa({ code: '12' }, request, reply),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('GET /auth/me avec la session pending → 401', async () => {
    const auth: Partial<AuthService> = {
      me: () => Promise.resolve(me),
    };
    const controller = controllerFor(auth);
    const request: SessionRequest = {
      method: 'GET',
      headers: {},
      principal: { userId: 'user-1', role: Role.ADMIN, hotelIds: [] },
      session: {
        userId: 'user-1',
        csrfToken: 'csrf-token',
        createdAt: '2026-09-29T00:00:00.000Z',
        pending2fa: true,
      },
    };

    await expect(controller.me(request)).rejects.toBeInstanceOf(UnauthorizedException);
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

  it('limite POST login et login2fa, et protège logout et me', () => {
    const login = handler('login');
    const login2fa = handler('login2fa');
    const logout = handler('logout');
    const meHandler = handler('me');

    expect(Reflect.getMetadata(GUARDS_METADATA, login)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', login)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', login)).toBe(60_000);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, login2fa)).toBe(200);
    expect(Reflect.getMetadata(GUARDS_METADATA, login2fa)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', login2fa)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', login2fa)).toBe(60_000);
    expect(Reflect.getMetadata(GUARDS_METADATA, logout)).toEqual([SessionGuard, CsrfGuard]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, logout)).toBe(204);
    expect(Reflect.getMetadata(GUARDS_METADATA, meHandler)).toEqual([SessionGuard]);
  });

  it('répond 202 pour forgot, limité à 5 par minute, sans session ni CSRF', async () => {
    const emails: string[] = [];
    const controller = controllerFor({
      forgotPassword: (email: string) => {
        emails.push(email);
        return Promise.resolve();
      },
    });

    await expect(controller.forgotPassword({ email: 'ada@xplor.test' })).resolves.toBeUndefined();
    expect(emails).toEqual(['ada@xplor.test']);

    const forgot = handler('forgotPassword');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, forgot)).toBe(202);
    expect(Reflect.getMetadata(GUARDS_METADATA, forgot)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', forgot)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', forgot)).toBe(60_000);
  });

  it('refuse un corps de forgot invalide', async () => {
    const controller = controllerFor({
      forgotPassword: () => Promise.reject(new Error('ne doit pas être appelé')),
    });

    await expect(controller.forgotPassword({ email: 'pas-un-email' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('répond 202 même lorsque le service rejette l’envoi', async () => {
    const controller = controllerFor({
      forgotPassword: () => Promise.reject(new Error('smtp')),
    });

    await expect(controller.forgotPassword({ email: 'ada@xplor.test' })).resolves.toBeUndefined();
  });

  it('répond 204 pour reset et traduit TOKEN_INVALID et PASSWORD_TOO_COMMON', async () => {
    const accepted = controllerFor({
      resetPassword: () => Promise.resolve(),
    });
    const invalid = controllerFor({
      resetPassword: () => Promise.reject(new AuthRequestError(TOKEN_INVALID)),
    });
    const common = controllerFor({
      resetPassword: () => Promise.reject(new AuthRequestError(PASSWORD_TOO_COMMON)),
    });
    const body = { token: 'jeton-opaque', password: 'x'.repeat(12) };

    await expect(accepted.resetPassword(body)).resolves.toBeUndefined();
    await expect(invalid.resetPassword(body)).rejects.toMatchObject({
      status: 400,
      response: { code: TOKEN_INVALID },
    });
    await expect(common.resetPassword(body)).rejects.toMatchObject({
      status: 400,
      response: { code: PASSWORD_TOO_COMMON },
    });

    const reset = handler('resetPassword');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, reset)).toBe(204);
    expect(Reflect.getMetadata(GUARDS_METADATA, reset)).toBeUndefined();
  });

  it('traduit un mot de passe trop court en PASSWORD_INVALID et un jeton vide en 400', async () => {
    const controller = controllerFor({
      resetPassword: () => Promise.reject(new Error('ne doit pas être appelé')),
    });

    await expect(
      controller.resetPassword({ token: 'jeton', password: 'court' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: PASSWORD_INVALID },
    });
    await expect(
      controller.resetPassword({ token: '', password: 'x'.repeat(12) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('répond 204 pour accept, limité à 5 par minute, sans session ni CSRF', async () => {
    const accepted = controllerFor({
      acceptInvite: () => Promise.resolve(),
    });
    const invalid = controllerFor({
      acceptInvite: () => Promise.reject(new AuthRequestError(TOKEN_INVALID)),
    });
    const body = { token: 'jeton-opaque', password: 'x'.repeat(12) };

    await expect(accepted.acceptInvite(body)).resolves.toBeUndefined();
    await expect(invalid.acceptInvite(body)).rejects.toMatchObject({
      status: 400,
      response: { code: TOKEN_INVALID },
    });

    const accept = handler('acceptInvite');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, accept)).toBe(204);
    expect(Reflect.getMetadata('path', accept)).toBe('invite/accept');
    expect(Reflect.getMetadata(GUARDS_METADATA, accept)).toEqual([ThrottlerGuard]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', accept)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', accept)).toBe(60_000);
  });

  it('traduit un mot de passe d’invitation trop court en PASSWORD_INVALID', async () => {
    const controller = controllerFor({
      acceptInvite: () => Promise.reject(new Error('ne doit pas être appelé')),
    });

    await expect(
      controller.acceptInvite({ token: 'jeton', password: 'court' }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: PASSWORD_INVALID },
    });
  });

  describe('2FA (M8 F-90)', () => {
    it('protège setup, confirm et disable par SessionGuard et CsrfGuard avec les bons statuts HTTP', () => {
      const setup = handler('setup2fa');
      const confirm = handler('confirm2fa');
      const disable = handler('disable2fa');

      expect(Reflect.getMetadata(GUARDS_METADATA, setup)).toEqual([SessionGuard, CsrfGuard]);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, setup)).toBe(200);

      expect(Reflect.getMetadata(GUARDS_METADATA, confirm)).toEqual([SessionGuard, CsrfGuard]);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, confirm)).toBe(204);

      expect(Reflect.getMetadata(GUARDS_METADATA, disable)).toEqual([SessionGuard, CsrfGuard]);
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, disable)).toBe(204);
    });

    describe('401 sans session ou avec session incomplète (pending 2FA)', () => {
      it('setup2fa : 401 sans session', async () => {
        const controller = twoFactorController();
        await expect(controller.setup2fa(unauthenticatedRequest)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });

      it('setup2fa : 401 si session pending2fa', async () => {
        const controller = twoFactorController();
        await expect(controller.setup2fa(pending2faSessionRequest)).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
      });

      it('confirm2fa : 401 sans session', async () => {
        const controller = twoFactorController();
        await expect(
          controller.confirm2fa({ code: '123456' }, unauthenticatedRequest),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('confirm2fa : 401 si session pending2fa', async () => {
        const controller = twoFactorController();
        await expect(
          controller.confirm2fa({ code: '123456' }, pending2faSessionRequest),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('disable2fa : 401 sans session', async () => {
        const controller = twoFactorController();
        await expect(
          controller.disable2fa({ code: '123456' }, unauthenticatedRequest),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });

      it('disable2fa : 401 si session pending2fa', async () => {
        const controller = twoFactorController();
        await expect(
          controller.disable2fa({ code: '123456' }, pending2faSessionRequest),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      });
    });

    describe('403 pour un non-ADMIN (EDITOR, etc.)', () => {
      it('setup2fa : 403 pour un EDITOR', async () => {
        const controller = twoFactorController();
        await expect(controller.setup2fa(editorSessionRequest)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });

      it('setup2fa : 403 pour un HOTEL_MANAGER', async () => {
        const controller = twoFactorController();
        await expect(controller.setup2fa(managerSessionRequest)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      });

      it('confirm2fa : 403 pour un EDITOR', async () => {
        const controller = twoFactorController();
        await expect(
          controller.confirm2fa({ code: '123456' }, editorSessionRequest),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('confirm2fa : 403 pour un HOTEL_MANAGER', async () => {
        const controller = twoFactorController();
        await expect(
          controller.confirm2fa({ code: '123456' }, managerSessionRequest),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('disable2fa : 403 pour un EDITOR', async () => {
        const controller = twoFactorController();
        await expect(
          controller.disable2fa({ code: '123456' }, editorSessionRequest),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it('disable2fa : 403 pour un HOTEL_MANAGER', async () => {
        const controller = twoFactorController();
        await expect(
          controller.disable2fa({ code: '123456' }, managerSessionRequest),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });

    describe('400 pour un code mal formé', () => {
      it('confirm2fa : refuse un code trop court, trop long, non numérique ou vide avec 400', async () => {
        const controller = twoFactorController();

        await expect(
          controller.confirm2fa({ code: '12' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.confirm2fa({ code: '1234567' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.confirm2fa({ code: 'abcdef' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.confirm2fa({ code: '12a456' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.confirm2fa({}, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.confirm2fa(null, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('disable2fa : refuse un code trop court, trop long, non numérique ou vide avec 400', async () => {
        const controller = twoFactorController();

        await expect(
          controller.disable2fa({ code: '12' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.disable2fa({ code: '1234567' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.disable2fa({ code: 'abcdef' }, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.disable2fa({}, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          controller.disable2fa(null, adminSessionRequest),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('succès avec faux service', () => {
      it('setup2fa : appelle beginSetup avec userId et email, retourne secret et otpauthUri', async () => {
        let capturedUserId = '';
        let capturedEmail = '';
        const fakeTwoFactor = new FakeTwoFactorService({
          beginSetup: (userId: string, email: string) => {
            capturedUserId = userId;
            capturedEmail = email;
            return Promise.resolve({
              secret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLS',
              otpauthUri:
                'otpauth://totp/Xplor:admin%40xplor.ma?secret=KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLS&issuer=Xplor',
            });
          },
        });
        const fakeUsers = new FakeUserRepository(adminUser);
        const controller = twoFactorController(fakeTwoFactor, fakeUsers);

        const response = await controller.setup2fa(adminSessionRequest);

        expect(capturedUserId).toBe('admin-1');
        expect(capturedEmail).toBe('admin@xplor.ma');
        expect(response).toEqual({
          secret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLS',
          otpauthUri:
            'otpauth://totp/Xplor:admin%40xplor.ma?secret=KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLS&issuer=Xplor',
        });
      });

      it('setup2fa : fonctionne avec email par défaut si UserRepository n’est pas injecté', async () => {
        let capturedEmail = '';
        const fakeTwoFactor = new FakeTwoFactorService({
          beginSetup: (_userId: string, email: string) => {
            capturedEmail = email;
            return Promise.resolve({
              secret: 'TESTSECRET',
              otpauthUri: 'otpauth://totp/Xplor:test?secret=TESTSECRET',
            });
          },
        });
        const controller = twoFactorController(fakeTwoFactor);

        const response = await controller.setup2fa(adminSessionRequest);
        expect(capturedEmail).toBe('admin@xplor.ma');
        expect(response.secret).toBe('TESTSECRET');
      });

      it('confirm2fa : appelle confirmSetup avec userId et code, résout 204 void', async () => {
        let capturedUserId = '';
        let capturedCode = '';
        const fakeTwoFactor = new FakeTwoFactorService({
          confirmSetup: (userId: string, code: string) => {
            capturedUserId = userId;
            capturedCode = code;
            return Promise.resolve();
          },
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.confirm2fa({ code: '654321' }, adminSessionRequest),
        ).resolves.toBeUndefined();
        expect(capturedUserId).toBe('admin-1');
        expect(capturedCode).toBe('654321');
      });

      it('disable2fa : appelle disable avec userId et code, résout 204 void', async () => {
        let capturedUserId = '';
        let capturedCode = '';
        const fakeTwoFactor = new FakeTwoFactorService({
          disable: (userId: string, code: string) => {
            capturedUserId = userId;
            capturedCode = code;
            return Promise.resolve();
          },
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.disable2fa({ code: '654321' }, adminSessionRequest),
        ).resolves.toBeUndefined();
        expect(capturedUserId).toBe('admin-1');
        expect(capturedCode).toBe('654321');
      });
    });

    describe('propagation des erreurs métier TwoFactorService via rethrowAsHttp', () => {
      it('confirm2fa : traduit TwoFactorInvalidCodeError en 400', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          confirmSetup: () => Promise.reject(new TwoFactorInvalidCodeError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.confirm2fa({ code: '000000' }, adminSessionRequest),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: TWO_FACTOR_INVALID_CODE },
        });
      });

      it('confirm2fa : traduit TwoFactorNotInitializedError en 400', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          confirmSetup: () => Promise.reject(new TwoFactorNotInitializedError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.confirm2fa({ code: '123456' }, adminSessionRequest),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: TWO_FACTOR_NOT_INITIALIZED },
        });
      });

      it('disable2fa : traduit TwoFactorInvalidCodeError en 400', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          disable: () => Promise.reject(new TwoFactorInvalidCodeError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.disable2fa({ code: '000000' }, adminSessionRequest),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: TWO_FACTOR_INVALID_CODE },
        });
      });

      it('disable2fa : traduit TwoFactorNotEnabledError en 400', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          disable: () => Promise.reject(new TwoFactorNotEnabledError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(
          controller.disable2fa({ code: '123456' }, adminSessionRequest),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: TWO_FACTOR_NOT_ENABLED },
        });
      });

      it('setup2fa : traduit TwoFactorRoleNotAllowedError en 403', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          beginSetup: () => Promise.reject(new TwoFactorRoleNotAllowedError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(controller.setup2fa(adminSessionRequest)).rejects.toMatchObject({
          status: 403,
          response: { code: TWO_FACTOR_ROLE_NOT_ALLOWED },
        });
      });

      it('setup2fa : traduit TwoFactorUserNotFoundError en 404', async () => {
        const fakeTwoFactor = new FakeTwoFactorService({
          beginSetup: () => Promise.reject(new TwoFactorUserNotFoundError()),
        });
        const controller = twoFactorController(fakeTwoFactor);

        await expect(controller.setup2fa(adminSessionRequest)).rejects.toMatchObject({
          status: 404,
          response: { code: TWO_FACTOR_USER_NOT_FOUND },
        });
      });
    });
  });
});
