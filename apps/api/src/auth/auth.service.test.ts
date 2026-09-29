import { Role, type LoginRequest } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_LOCKED, INVALID_CREDENTIALS } from './auth.errors.js';
import { AuthService, type PasswordVerifier } from './auth.service.js';
import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import { InMemorySessionStore } from './in-memory-session.store.js';
import { type LoginStateUpdate, type AuthUser, type UserRepository } from './user.repository.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const PASSWORD = 'phrase-secrete-xplor';

const credentials: LoginRequest = {
  email: 'ada@xplor.test',
  password: PASSWORD,
};

function account(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'ada@xplor.test',
    name: 'Ada',
    passwordHash: 'hash-ada',
    role: Role.EDITOR,
    uiLang: 'fr',
    active: true,
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

class MemoryUsers implements UserRepository {
  readonly updates: { id: string; state: LoginStateUpdate }[] = [];

  constructor(private readonly byEmail: Map<string, AuthUser>) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.byEmail.get(email) ?? null);
  }

  findById(id: string): Promise<AuthUser | null> {
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }

  updateLoginState(id: string, state: LoginStateUpdate): Promise<void> {
    this.updates.push({ id, state });
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.failedLoginCount = state.failedLoginCount;
        user.lockedUntil = state.lockedUntil;
      }
    }
    return Promise.resolve();
  }
}

class FakePasswords implements PasswordVerifier {
  readonly calls: { hash: string; password: string }[] = [];

  constructor(private readonly accept: (hash: string, password: string) => boolean) {}

  verify(passwordHash: string, password: string): Promise<boolean> {
    this.calls.push({ hash: passwordHash, password });
    return Promise.resolve(this.accept(passwordHash, password));
  }
}

function setup(user: AuthUser | null, acceptPassword: boolean) {
  const users = new MemoryUsers(
    user === null ? new Map<string, AuthUser>() : new Map([[user.email, user]]),
  );
  const passwords = new FakePasswords(
    (hash, password) => acceptPassword && hash === user?.passwordHash && password === PASSWORD,
  );
  const sessions = new InMemorySessionStore(() => NOW.getTime());
  const service = new AuthService(users, sessions, passwords, () => NOW);
  return { users, passwords, sessions, service };
}

describe('AuthService.login', () => {
  it('ouvre une session neuve et remet le compteur à zéro', async () => {
    const user = account({ failedLoginCount: 4 });
    const { service, sessions, users } = setup(user, true);
    const previous = await sessions.create({
      userId: user.id,
      csrfToken: 'ancien-jeton',
      createdAt: '2026-09-29T08:00:00.000Z',
    });

    const result = await service.login({ email: '  Ada@Xplor.test ', password: PASSWORD });

    expect(result.sessionId).not.toBe(previous);
    expect(Buffer.from(result.me.csrfToken, 'base64url')).toHaveLength(32);
    expect(result.me).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: Role.EDITOR,
      uiLang: 'fr',
      csrfToken: result.me.csrfToken,
    });
    expect(await sessions.get(previous)).toBeNull();
    expect(await sessions.get(result.sessionId)).toEqual({
      userId: user.id,
      csrfToken: result.me.csrfToken,
      createdAt: NOW.toISOString(),
    });
    expect(users.updates).toEqual([
      {
        id: user.id,
        state: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: NOW },
      },
    ]);
  });

  it('crée une session différente à chaque connexion', async () => {
    const { service, sessions } = setup(account(), true);

    const first = await service.login(credentials);
    const second = await service.login(credentials);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.me.csrfToken).not.toBe(first.me.csrfToken);
    expect(await sessions.get(first.sessionId)).toBeNull();
    expect(await sessions.get(second.sessionId)).not.toBeNull();
  });

  it('refuse un mauvais mot de passe avec INVALID_CREDENTIALS', async () => {
    const user = account();
    const { service, passwords, users } = setup(user, false);

    await expect(service.login(credentials)).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(passwords.calls).toEqual([{ hash: user.passwordHash, password: PASSWORD }]);
    expect(user.failedLoginCount).toBe(1);
    expect(user.lockedUntil).toBeNull();
    expect(users.updates).toHaveLength(1);
  });

  it('refuse un email inconnu avec le même code et vérifie le hash factice', async () => {
    const { service, passwords, users } = setup(null, false);

    await expect(
      service.login({ email: 'inconnu@xplor.test', password: 'autre-mot-de-passe' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(passwords.calls).toEqual([
      { hash: DUMMY_PASSWORD_HASH, password: 'autre-mot-de-passe' },
    ]);
    expect(users.updates).toEqual([]);
  });

  it('refuse un compte inactif avec le même code', async () => {
    const user = account({ active: false });
    const { service, passwords, users, sessions } = setup(user, true);
    const before = await sessions.create({
      userId: user.id,
      csrfToken: 'session-existante',
      createdAt: NOW.toISOString(),
    });

    await expect(service.login(credentials)).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(passwords.calls).toEqual([{ hash: user.passwordHash, password: PASSWORD }]);
    expect(users.updates).toEqual([]);
    expect(user.failedLoginCount).toBe(0);
    expect(await sessions.get(before)).not.toBeNull();
  });

  it('verrouille au 10e échec puis répond 423', async () => {
    const user = account();
    const { service, passwords, users } = setup(user, false);

    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await expect(service.login(credentials)).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(user.failedLoginCount).toBe(attempt);
      expect(user.lockedUntil).toBeNull();
    }

    await expect(service.login(credentials)).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(user.failedLoginCount).toBe(10);
    expect(user.lockedUntil).toEqual(new Date(NOW.getTime() + FIFTEEN_MIN_MS));
    expect(users.updates).toHaveLength(10);
    expect(passwords.calls).toHaveLength(10);

    await expect(service.login(credentials)).rejects.toMatchObject({
      statusCode: 423,
      code: ACCOUNT_LOCKED,
    });
    expect(passwords.calls).toHaveLength(10);
    expect(user.failedLoginCount).toBe(10);
    expect(users.updates).toHaveLength(10);
  });
});

describe('AuthService.me', () => {
  it('renvoie le profil et le jeton de la session', async () => {
    const user = account({ uiLang: 'ar', role: Role.ADMIN });
    const { service } = setup(user, true);

    await expect(service.me(user.id, 'csrf-courant')).resolves.toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: Role.ADMIN,
      uiLang: 'ar',
      csrfToken: 'csrf-courant',
    });
  });

  it('refuse un compte absent ou inactif', async () => {
    const missing = setup(null, false).service;
    const inactive = setup(account({ active: false }), true).service;

    await expect(missing.me('user-1', 'csrf')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    await expect(inactive.me('user-1', 'csrf')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
  });
});

describe('AuthService.logout', () => {
  it('détruit la session', async () => {
    const { service, sessions } = setup(account(), true);
    const sessionId = await sessions.create({
      userId: 'user-1',
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
    });

    await service.logout(sessionId);

    await expect(sessions.get(sessionId)).resolves.toBeNull();
  });
});
