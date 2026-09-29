import 'reflect-metadata';

import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { CsrfGuard } from './csrf.guard.js';
import { InMemorySessionStore } from './in-memory-session.store.js';
import { SESSION_COOKIE_NAME } from './session-cookie.js';
import { SessionGuard } from './session.guard.js';
import type { SessionRequest } from './session-request.js';
import { SESSION_IDLE_MS, type SessionRecord } from './session-store.js';
import { type SessionUser, type UserLookup } from './user-lookup.js';

const CSRF = 'csrf-token-value';

const sessionData: SessionRecord = {
  userId: 'user-1',
  csrfToken: CSRF,
  createdAt: '2026-09-29T00:00:00.000Z',
};

const activeUser: SessionUser = {
  id: 'user-1',
  role: Role.EDITOR,
  active: true,
};

function lookupOf(users: SessionUser[]): UserLookup {
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    findById(id: string): Promise<SessionUser | null> {
      return Promise.resolve(byId.get(id) ?? null);
    },
  };
}

function httpContext(request: SessionRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('SessionGuard', () => {
  it('accepte une session valide et attache un Principal sans hôtel', async () => {
    let now = 0;
    const store = new InMemorySessionStore(() => now);
    const users = lookupOf([activeUser]);
    const guard = new SessionGuard(store, users);
    const sessionId = await store.create(sessionData);
    const request: SessionRequest = {
      method: 'GET',
      cookies: { [SESSION_COOKIE_NAME]: sessionId },
      headers: {},
    };

    now = SESSION_IDLE_MS - 1;
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(request.principal).toEqual({
      userId: 'user-1',
      role: Role.EDITOR,
      hotelIds: [],
    });
    expect(request.session).toEqual(sessionData);

    now = SESSION_IDLE_MS - 1 + SESSION_IDLE_MS - 1;
    await expect(store.get(sessionId)).resolves.toEqual(sessionData);
  });

  it('répond 401 si le cookie est absent', async () => {
    const guard = new SessionGuard(new InMemorySessionStore(), lookupOf([activeUser]));
    const request: SessionRequest = { method: 'GET', headers: {} };

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('répond 401 si l’utilisateur est désactivé', async () => {
    const store = new InMemorySessionStore();
    const guard = new SessionGuard(store, lookupOf([{ ...activeUser, active: false }]));
    const sessionId = await store.create(sessionData);
    const request: SessionRequest = {
      method: 'GET',
      cookies: { [SESSION_COOKIE_NAME]: sessionId },
      headers: {},
    };

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('répond 401 si la session est expirée', async () => {
    let now = 0;
    const store = new InMemorySessionStore(() => now);
    const guard = new SessionGuard(store, lookupOf([activeUser]));
    const sessionId = await store.create(sessionData);
    now = SESSION_IDLE_MS;
    const request: SessionRequest = {
      method: 'GET',
      cookies: { [SESSION_COOKIE_NAME]: sessionId },
      headers: {},
    };

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('CsrfGuard', () => {
  async function postContext(
    store: InMemorySessionStore,
    header: string | undefined,
  ): Promise<{ guard: CsrfGuard; request: SessionRequest }> {
    const sessionId = await store.create(sessionData);
    const headers: SessionRequest['headers'] = {};
    if (header !== undefined) {
      headers['x-csrf-token'] = header;
    }
    const request: SessionRequest = {
      method: 'POST',
      cookies: { [SESSION_COOKIE_NAME]: sessionId },
      headers,
    };
    return { guard: new CsrfGuard(store), request };
  }

  it('refuse un POST sans jeton CSRF (403)', async () => {
    const { guard, request } = await postContext(new InMemorySessionStore(), undefined);

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuse un POST dont le jeton CSRF est faux (403)', async () => {
    const { guard, request } = await postContext(new InMemorySessionStore(), 'pas-le-bon-jeton');

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuse un jeton de longueur différente sans lever d’exception (403)', async () => {
    const { guard, request } = await postContext(new InMemorySessionStore(), 'court');

    await expect(guard.canActivate(httpContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepte un POST dont le jeton est celui de la session', async () => {
    const { guard, request } = await postContext(new InMemorySessionStore(), CSRF);

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });

  it('accepte un GET sans jeton CSRF', async () => {
    const guard = new CsrfGuard(new InMemorySessionStore());
    const request: SessionRequest = { method: 'GET', headers: {} };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
  });

  it('accepte HEAD et OPTIONS sans jeton CSRF', async () => {
    const guard = new CsrfGuard(new InMemorySessionStore());

    await expect(guard.canActivate(httpContext({ method: 'HEAD', headers: {} }))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(httpContext({ method: 'OPTIONS', headers: {} }))).resolves.toBe(
      true,
    );
  });
});
