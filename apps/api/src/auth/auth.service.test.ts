import { Role, type LoginRequest } from '@xplor/shared';
import { describe, expect, it, vi } from 'vitest';

import { type RecordAuditParams } from '../audit/audit.service.js';
import { FakeMailer } from '../mail/fake-mailer.js';
import { type Mailer, type MailMessage } from '../mail/mailer.js';
import {
  ACCOUNT_LOCKED,
  PASSWORD_INVALID,
  PASSWORD_TOO_COMMON,
  TOKEN_INVALID,
  AuthRequestError,
  INVALID_CREDENTIALS,
} from './auth.errors.js';
import {
  AuthService,
  type AuditRecorder,
  type PasswordVerifier,
  type TwoFactorVerifier,
} from './auth.service.js';
import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import { InMemorySessionStore } from './in-memory-session.store.js';
import { type AuthTx, type UnitOfWork } from './unit-of-work.js';
import {
  type LoginStateUpdate,
  type NewInvitedUser,
  type PasswordUpdate,
  type AuthUser,
  type InvitedProfileUpdate,
  type UserRepository,
} from './user.repository.js';
import {
  type NewUserToken,
  type UserTokenRecord,
  type UserTokenRepository,
} from './user-token.repository.js';
import { INVITE_TTL_MS, PASSWORD_RESET_TTL_MS, hashToken } from './user-token.js';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const PASSWORD = 'phrase-secrete-xplor';
const NEW_PASSWORD = 'xplor-kiosque-rabat-2026';

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
    totpEnabled: false,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

class MemoryUsers implements UserRepository {
  readonly updates: { id: string; state: LoginStateUpdate }[] = [];
  readonly passwordUpdates: { id: string; state: PasswordUpdate }[] = [];
  readonly activations: { id: string; passwordHash: string }[] = [];
  /** Après ce nombre de lectures par id, le compte devient inactif. */
  inactiveAfterIdReads: number | null = null;
  private idReads = 0;

  constructor(private readonly byEmail: Map<string, AuthUser>) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return Promise.resolve(this.byEmail.get(email) ?? null);
  }

  findById(id: string): Promise<AuthUser | null> {
    const user = this.cached(id);
    this.idReads += 1;
    if (
      user !== null &&
      this.inactiveAfterIdReads !== null &&
      this.idReads > this.inactiveAfterIdReads
    ) {
      user.active = false;
    }
    return Promise.resolve(user);
  }

  private cached(id: string): AuthUser | null {
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        return user;
      }
    }
    return null;
  }

  updateLoginState(id: string, state: LoginStateUpdate): Promise<void> {
    this.updates.push({ id, state });
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.failedLoginCount = state.failedLoginCount;
        user.lockedUntil = state.lockedUntil;
        if (state.lastLoginAt !== undefined) {
          user.lastLoginAt = state.lastLoginAt;
        }
      }
    }
    return Promise.resolve();
  }

  updatePassword(id: string, state: PasswordUpdate): Promise<void> {
    this.passwordUpdates.push({ id, state });
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.passwordHash = state.passwordHash;
        user.failedLoginCount = state.failedLoginCount;
        user.lockedUntil = state.lockedUntil;
      }
    }
    return Promise.resolve();
  }

  createInvited(input: NewInvitedUser): Promise<AuthUser> {
    const user: AuthUser = {
      id: `invited-${input.email}`,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
      uiLang: input.uiLang,
      active: false,
      totpEnabled: false,
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    };
    this.byEmail.set(input.email, user);
    return Promise.resolve(user);
  }

  updateInvited(id: string, profile: InvitedProfileUpdate): Promise<AuthUser> {
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.name = profile.name;
        user.role = profile.role;
        user.uiLang = profile.uiLang;
        return Promise.resolve(user);
      }
    }
    return Promise.reject(new Error('compte absent'));
  }

  activate(id: string, passwordHash: string): Promise<void> {
    this.activations.push({ id, passwordHash });
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.passwordHash = passwordHash;
        user.active = true;
      }
    }
    return Promise.resolve();
  }
}

class ImmediateUnitOfWork implements UnitOfWork {
  active = false;

  run<T>(work: (db: AuthTx) => Promise<T>): Promise<T> {
    this.active = true;
    return work({} as AuthTx).finally(() => {
      this.active = false;
    });
  }
}

class MemoryTokens implements UserTokenRepository {
  readonly rows: UserTokenRecord[] = [];
  /** `false` simule une course : le jeton a été pris entre la lecture et l'écriture. */
  allowConsume = true;
  private seq = 0;

  create(input: NewUserToken): Promise<UserTokenRecord> {
    this.seq += 1;
    const row: UserTokenRecord = {
      id: `token-${String(this.seq)}`,
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  findByHash(tokenHash: string): Promise<UserTokenRecord | null> {
    return Promise.resolve(this.rows.find((row) => row.tokenHash === tokenHash) ?? null);
  }

  markUsed(id: string, usedAt: Date): Promise<boolean> {
    if (!this.allowConsume) {
      return Promise.resolve(false);
    }
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.usedAt !== null) {
      return Promise.resolve(false);
    }
    row.usedAt = usedAt;
    return Promise.resolve(true);
  }

  invalidateUnused(userId: string, type: UserTokenRecord['type']): Promise<void> {
    const usedAt = new Date();
    for (const row of this.rows) {
      if (row.userId === userId && row.type === type && row.usedAt === null) {
        row.usedAt = usedAt;
      }
    }
    return Promise.resolve();
  }
}

class FakePasswords implements PasswordVerifier {
  readonly calls: { hash: string; password: string }[] = [];
  hashedDuringTransaction = false;

  constructor(
    private readonly accept: (hash: string, password: string) => boolean,
    private readonly unitOfWork: ImmediateUnitOfWork,
  ) {}

  verify(passwordHash: string, password: string): Promise<boolean> {
    this.calls.push({ hash: passwordHash, password });
    if (passwordHash === `argon2id:${password}`) {
      return Promise.resolve(true);
    }
    return Promise.resolve(this.accept(passwordHash, password));
  }

  hash(password: string): Promise<string> {
    this.hashedDuringTransaction = this.unitOfWork.active;
    return Promise.resolve(`argon2id:${password}`);
  }
}

function setup(
  user: AuthUser | null,
  acceptPassword: boolean,
): {
  users: MemoryUsers;
  passwords: FakePasswords;
  sessions: InMemorySessionStore;
  service: AuthService;
  tokens: MemoryTokens;
  mailer: FakeMailer;
  twoFactor: TwoFactorVerifier;
  audit: AuditRecorder;
};
function setup(
  user: AuthUser | null,
  acceptPassword: boolean,
  mailer: Mailer,
  twoFactor?: TwoFactorVerifier,
  audit?: AuditRecorder,
): {
  users: MemoryUsers;
  passwords: FakePasswords;
  sessions: InMemorySessionStore;
  service: AuthService;
  tokens: MemoryTokens;
  mailer: Mailer;
  twoFactor: TwoFactorVerifier;
  audit: AuditRecorder;
};
function setup(
  user: AuthUser | null,
  acceptPassword: boolean,
  mailer: Mailer = new FakeMailer(),
  twoFactor: TwoFactorVerifier = { verifyLoginCode: vi.fn().mockResolvedValue(false) },
  audit: AuditRecorder = { record: vi.fn().mockResolvedValue(undefined) },
) {
  const users = new MemoryUsers(
    user === null ? new Map<string, AuthUser>() : new Map([[user.email, user]]),
  );
  const sessions = new InMemorySessionStore(() => NOW.getTime());
  const tokens = new MemoryTokens();
  const unitOfWork = new ImmediateUnitOfWork();
  const passwords = new FakePasswords(
    (hash, password) => acceptPassword && hash === user?.passwordHash && password === PASSWORD,
    unitOfWork,
  );
  const service = new AuthService(
    users,
    sessions,
    passwords,
    () => NOW,
    tokens,
    mailer,
    { ADMIN_BASE_URL: 'http://admin.test' },
    unitOfWork,
    twoFactor,
    audit,
  );
  return { users, passwords, sessions, service, tokens, mailer, twoFactor, audit };
}

function sentAt(mailer: FakeMailer, index: number): MailMessage {
  const message = mailer.sent[index];
  if (message === undefined) {
    throw new Error('courriel absent');
  }
  return message;
}

function tokenFrom(message: MailMessage): string {
  const match = /\/reset\/([^/\s"<]+)/.exec(message.text);
  const token = match?.[1];
  if (token === undefined) {
    throw new Error('lien de réinitialisation absent');
  }
  return token;
}

function requestShape(error: unknown): { statusCode: number; code: string; message: string } {
  if (error instanceof AuthRequestError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }
  throw error;
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
    if (!('me' in result)) {
      throw new Error('me attendu dans result');
    }

    expect(result.sessionId).not.toBe(previous);
    expect(Buffer.from(result.me.csrfToken, 'base64url')).toHaveLength(32);
    expect(result.me).toEqual({
      id: user.id,
      email: user.email,
      name: user.name,
      role: Role.EDITOR,
      uiLang: 'fr',
      csrfToken: result.me.csrfToken,
      totpEnabled: false,
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
    if (!('me' in first) || !('me' in second)) {
      throw new Error('me attendu dans first et second');
    }

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

  it('login ADMIN avec totpEnabled : retourne twoFactorRequired, session pending2fa, destroyAllForUser et registerSuccess non appelés (lastLoginAt non modifié)', async () => {
    const initialLastLogin = new Date('2026-09-01T10:00:00.000Z');
    const admin = account({
      id: 'admin-1',
      email: 'admin@xplor.test',
      role: Role.ADMIN,
      totpEnabled: true,
      failedLoginCount: 2,
      lastLoginAt: initialLastLogin,
    });
    const { service, sessions, users } = setup(admin, true);
    const existing = await sessions.create({
      userId: admin.id,
      csrfToken: 'session-existante',
      createdAt: '2026-09-29T08:00:00.000Z',
    });
    const destroyAllSpy = vi.spyOn(sessions, 'destroyAllForUser');

    const result = await service.login({ email: 'admin@xplor.test', password: PASSWORD });

    expect('twoFactorRequired' in result && result.twoFactorRequired).toBe(true);
    expect('me' in result).toBe(false);
    expect(typeof result.sessionId).toBe('string');

    const pendingSession = await sessions.get(result.sessionId);
    expect(pendingSession?.userId).toBe(admin.id);
    expect(typeof pendingSession?.csrfToken).toBe('string');
    expect(pendingSession?.createdAt).toBe(NOW.toISOString());
    expect(pendingSession?.pending2fa).toBe(true);

    // destroyAllForUser non appelé : la session préexistante est toujours active
    expect(destroyAllSpy).not.toHaveBeenCalled();
    expect(await sessions.get(existing)).not.toBeNull();

    // registerSuccess non appelé : ni mise à jour d'état de connexion, ni modification de lastLoginAt
    expect(users.updates).toEqual([]);
    expect(admin.failedLoginCount).toBe(2);
    expect(admin.lastLoginAt).toEqual(initialLastLogin);
  });

  it('login sans 2FA inchangé pour un administrateur sans TOTP (session complète, me retourné)', async () => {
    const admin = account({
      id: 'admin-1',
      email: 'admin@xplor.test',
      role: Role.ADMIN,
      totpEnabled: false,
    });
    const { service, sessions, users } = setup(admin, true);

    const result = await service.login({ email: 'admin@xplor.test', password: PASSWORD });

    if (!('me' in result)) {
      throw new Error('me attendu dans result');
    }
    expect(result.me.role).toBe(Role.ADMIN);
    expect(result.me.email).toBe(admin.email);
    expect(result.me.id).toBe(admin.id);
    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.me.csrfToken).toBe('string');
    expect(users.updates).toEqual([
      {
        id: admin.id,
        state: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: NOW },
      },
    ]);
    expect(admin.lastLoginAt).toEqual(NOW);
    const stored = await sessions.get(result.sessionId);
    expect(stored?.pending2fa).toBeUndefined();
    expect(stored?.userId).toBe(admin.id);
  });

  it('login sans 2FA inchangé pour un gestionnaire (HOTEL_MANAGER) même avec totpEnabled (session complète, me retourné)', async () => {
    const manager = account({
      id: 'manager-1',
      email: 'manager@xplor.test',
      role: Role.HOTEL_MANAGER,
      totpEnabled: true,
    });
    const { service, sessions, users } = setup(manager, true);

    const result = await service.login({ email: 'manager@xplor.test', password: PASSWORD });

    if (!('me' in result)) {
      throw new Error('me attendu dans result');
    }
    expect(result.me.role).toBe(Role.HOTEL_MANAGER);
    expect(result.me.email).toBe(manager.email);
    expect(result.me.id).toBe(manager.id);
    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.me.csrfToken).toBe('string');
    expect(users.updates).toEqual([
      {
        id: manager.id,
        state: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: NOW },
      },
    ]);
    expect(manager.lastLoginAt).toEqual(NOW);
    const stored = await sessions.get(result.sessionId);
    expect(stored?.pending2fa).toBeUndefined();
    expect(stored?.userId).toBe(manager.id);
  });

  it('n’exige pas de 2FA pour un non-administrateur même si totpEnabled est true', async () => {
    const editor = account({
      id: 'editor-1',
      email: 'editor@xplor.test',
      role: Role.EDITOR,
      totpEnabled: true,
    });
    const { service, sessions } = setup(editor, true);

    const result = await service.login({ email: 'editor@xplor.test', password: PASSWORD });

    if (!('me' in result)) {
      throw new Error('me attendu dans result');
    }
    expect(result.me.role).toBe(Role.EDITOR);
    const stored = await sessions.get(result.sessionId);
    expect(stored?.pending2fa).toBeUndefined();
  });
});

describe('AuthService.login2fa', () => {
  it('login2fa avec code valide : promeut la session (pending détruite, destroyAllForUser appelé, nouvelle session sans pending2fa, compteur remis à zéro, lastLoginAt renseigné)', async () => {
    const admin = account({
      id: 'admin-1',
      email: 'admin@xplor.test',
      role: Role.ADMIN,
      totpEnabled: true,
      failedLoginCount: 3,
      lastLoginAt: null,
    });
    const verifyMock = vi.fn().mockImplementation((_userId: string, code: string) => {
      return Promise.resolve(code === '123456');
    });
    const { service, sessions, users } = setup(
      admin,
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );
    const previous = await sessions.create({
      userId: admin.id,
      csrfToken: 'ancienne-session',
      createdAt: '2026-09-29T08:00:00.000Z',
    });

    const loginRes = await service.login({ email: admin.email, password: PASSWORD });
    if (!('twoFactorRequired' in loginRes)) {
      throw new Error('2FA attendu');
    }
    const pendingSessionId = loginRes.sessionId;
    const destroyAllSpy = vi.spyOn(sessions, 'destroyAllForUser');

    const result = await service.login2fa(pendingSessionId, '123456');

    expect(verifyMock).toHaveBeenCalledWith(admin.id, '123456');
    // pending détruite
    expect(await sessions.get(pendingSessionId)).toBeNull();
    // destroyAllForUser appelé et ancienne session détruite
    expect(destroyAllSpy).toHaveBeenCalledWith(admin.id);
    expect(await sessions.get(previous)).toBeNull();

    // nouvelle session créée sans pending2fa
    expect(result.sessionId).not.toBe(pendingSessionId);
    expect(result.sessionId).not.toBe(previous);
    const finalSession = await sessions.get(result.sessionId);
    expect(finalSession).toEqual({
      userId: admin.id,
      csrfToken: result.me.csrfToken,
      createdAt: NOW.toISOString(),
    });
    expect(finalSession?.pending2fa).toBeUndefined();

    // me retourné
    expect(result.me).toEqual({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: Role.ADMIN,
      uiLang: 'fr',
      csrfToken: result.me.csrfToken,
      totpEnabled: false,
    });

    // compteur remis à zéro et lastLoginAt renseigné
    expect(admin.failedLoginCount).toBe(0);
    expect(admin.lockedUntil).toBeNull();
    expect(admin.lastLoginAt).toEqual(NOW);
    expect(users.updates).toEqual([
      {
        id: admin.id,
        state: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: NOW },
      },
    ]);
  });

  it('session inconnue refusée avec invalidCredentials', async () => {
    const verifyMock = vi.fn();
    const { service } = setup(
      account({ role: Role.ADMIN, totpEnabled: true }),
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );

    await expect(service.login2fa('session-inconnue', '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('session non pending2fa refusée avec invalidCredentials', async () => {
    const admin = account({ role: Role.ADMIN, totpEnabled: true });
    const verifyMock = vi.fn();
    const { service, sessions } = setup(
      admin,
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );
    const normalSessionId = await sessions.create({
      userId: admin.id,
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
    });

    await expect(service.login2fa(normalSessionId, '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('refuse si l’utilisateur est introuvable ou inactif', async () => {
    const inactiveAdmin = account({
      id: 'admin-inactif',
      role: Role.ADMIN,
      totpEnabled: true,
      active: false,
    });
    const { service, sessions } = setup(inactiveAdmin, true);
    const pendingSessionId = await sessions.create({
      userId: inactiveAdmin.id,
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
      pending2fa: true,
    });

    await expect(service.login2fa(pendingSessionId, '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });

    const unknownUserSessionId = await sessions.create({
      userId: 'id-inexistant',
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
      pending2fa: true,
    });

    await expect(service.login2fa(unknownUserSessionId, '123456')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
  });

  it('compte verrouillé → accountLocked sans appel à verifyLoginCode', async () => {
    const lockedAdmin = account({
      id: 'admin-locked',
      role: Role.ADMIN,
      totpEnabled: true,
      failedLoginCount: 10,
      lockedUntil: new Date(NOW.getTime() + FIFTEEN_MIN_MS),
    });
    const verifyMock = vi.fn();
    const { service, sessions } = setup(
      lockedAdmin,
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );
    const pendingSessionId = await sessions.create({
      userId: lockedAdmin.id,
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
      pending2fa: true,
    });

    await expect(service.login2fa(pendingSessionId, '123456')).rejects.toMatchObject({
      statusCode: 423,
      code: ACCOUNT_LOCKED,
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('login2fa avec code erroné : failedLoginCount incrémenté et invalidCredentials', async () => {
    const admin = account({
      id: 'admin-1',
      role: Role.ADMIN,
      totpEnabled: true,
      failedLoginCount: 0,
    });
    const verifyMock = vi.fn().mockResolvedValue(false);
    const { service, sessions, users } = setup(
      admin,
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );
    const pendingSessionId = await sessions.create({
      userId: admin.id,
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
      pending2fa: true,
    });

    await expect(service.login2fa(pendingSessionId, '000000')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });

    expect(verifyMock).toHaveBeenCalledWith(admin.id, '000000');
    expect(admin.failedLoginCount).toBe(1);
    expect(admin.lockedUntil).toBeNull();
    expect(users.updates).toEqual([
      {
        id: admin.id,
        state: { failedLoginCount: 1, lockedUntil: null },
      },
    ]);
    expect(await sessions.get(pendingSessionId)).not.toBeNull();
  });

  it('login2fa avec code erroné : verrouille au 10e échec consécutif (selon lockout.ts) avec invalidCredentials', async () => {
    const admin = account({
      id: 'admin-1',
      role: Role.ADMIN,
      totpEnabled: true,
      failedLoginCount: 0,
    });
    const verifyMock = vi.fn().mockResolvedValue(false);
    const { service, sessions, users } = setup(
      admin,
      true,
      new FakeMailer(),
      { verifyLoginCode: verifyMock },
    );
    const pendingSessionId = await sessions.create({
      userId: admin.id,
      csrfToken: 'csrf',
      createdAt: NOW.toISOString(),
      pending2fa: true,
    });

    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await expect(service.login2fa(pendingSessionId, '000000')).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(admin.failedLoginCount).toBe(attempt);
      expect(admin.lockedUntil).toBeNull();
    }

    // 10e échec : rejeté avec invalidCredentials et verrouille pour 15 min selon lockout.ts
    await expect(service.login2fa(pendingSessionId, '000000')).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(admin.failedLoginCount).toBe(10);
    expect(admin.lockedUntil).toEqual(new Date(NOW.getTime() + FIFTEEN_MIN_MS));
    expect(users.updates).toHaveLength(10);
    expect(users.updates[9]).toEqual({
      id: admin.id,
      state: {
        failedLoginCount: 10,
        lockedUntil: new Date(NOW.getTime() + FIFTEEN_MIN_MS),
      },
    });
    expect(verifyMock).toHaveBeenCalledTimes(10);

    // Tentative suivante : compte désormais verrouillé (ACCOUNT_LOCKED)
    await expect(service.login2fa(pendingSessionId, '000000')).rejects.toMatchObject({
      statusCode: 423,
      code: ACCOUNT_LOCKED,
    });
    expect(verifyMock).toHaveBeenCalledTimes(10);
    expect(admin.failedLoginCount).toBe(10);
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
      totpEnabled: false,
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

describe('AuthService.forgotPassword', () => {
  it('ne envoie pas de courriel pour un email inconnu', async () => {
    const { service, mailer, tokens } = setup(null, false);

    await expect(service.forgotPassword('inconnu@xplor.test')).resolves.toBeUndefined();

    expect(mailer.sent).toEqual([]);
    expect(tokens.rows).toEqual([]);
  });

  it('ne crée pas de jeton pour un compte inactif', async () => {
    const { service, mailer, tokens } = setup(account({ active: false }), true);

    await service.forgotPassword('ada@xplor.test');

    expect(mailer.sent).toEqual([]);
    expect(tokens.rows).toEqual([]);
  });

  it('envoie un courriel dont le lien contient /reset/ sans stocker le jeton en clair', async () => {
    const user = account();
    const { service, mailer, tokens } = setup(user, true);

    await service.forgotPassword('  Ada@Xplor.test ');

    expect(mailer.sent).toHaveLength(1);
    const message = sentAt(mailer, 0);
    expect(message.to).toBe(user.email);
    expect(message.subject).toBe('Réinitialisation de votre mot de passe Xplor');
    expect(message.text).toContain('/reset/');
    expect(message.html).toContain('/reset/');
    const token = tokenFrom(message);
    expect(message.text).toContain(`http://admin.test/reset/${token}`);
    expect(tokens.rows).toHaveLength(1);
    const stored = tokens.rows[0];
    expect(stored?.type).toBe('PASSWORD_RESET');
    expect(stored?.tokenHash).toBe(hashToken(token));
    expect(stored?.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored?.expiresAt).toEqual(new Date(NOW.getTime() + PASSWORD_RESET_TTL_MS));
    expect(stored?.usedAt).toBeNull();
  });

  it('reste résolu si l’envoi échoue, sans persister le jeton en clair', async () => {
    let plaintext = '';
    const mailer: Mailer = {
      send: (message) => {
        const match = /\/reset\/([^/\s"<]+)/.exec(message.text);
        plaintext = match?.[1] ?? '';
        return Promise.reject(new Error('smtp'));
      },
    };
    const { service, tokens } = setup(account(), true, mailer);

    await expect(service.forgotPassword('ada@xplor.test')).resolves.toBeUndefined();

    expect(plaintext.length).toBeGreaterThan(0);
    expect(tokens.rows).toHaveLength(1);
    expect(JSON.stringify(tokens.rows)).not.toContain(plaintext);
  });
});

describe('AuthService.resetPassword', () => {
  it('refuse l’ancien jeton après une nouvelle demande', async () => {
    const { service, mailer } = setup(account(), true);

    await service.forgotPassword(credentials.email);
    const first = tokenFrom(sentAt(mailer, 0));
    await service.forgotPassword(credentials.email);
    const second = tokenFrom(sentAt(mailer, 1));

    await expect(service.resetPassword(first, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });
    await expect(service.resetPassword(second, NEW_PASSWORD)).resolves.toBeUndefined();
  });

  it('répond TOKEN_INVALID pour un jeton expiré, déjà utilisé ou inconnu', async () => {
    const user = account();
    const { service, tokens } = setup(user, true);
    const expired = 'jeton-expire';
    const used = 'jeton-utilise';
    tokens.rows.push(
      {
        id: 'expired',
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(expired),
        expiresAt: new Date(NOW.getTime() - 1),
        usedAt: null,
      },
      {
        id: 'used',
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: hashToken(used),
        expiresAt: new Date(NOW.getTime() + PASSWORD_RESET_TTL_MS),
        usedAt: NOW,
      },
    );

    const failures: { statusCode: number; code: string; message: string }[] = [];
    for (const token of [expired, used, 'jeton-inconnu']) {
      try {
        await service.resetPassword(token, NEW_PASSWORD);
        throw new Error('devrait refuser');
      } catch (error: unknown) {
        failures.push(requestShape(error));
      }
    }

    const [first, second, third] = failures;
    expect(first).toEqual({ statusCode: 400, code: TOKEN_INVALID, message: TOKEN_INVALID });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('refuse un jeton d’invitation avec le même code', async () => {
    const user = account();
    const { service, tokens } = setup(user, true);
    const token = 'jeton-invitation';
    tokens.rows.push({
      id: 'invite',
      userId: user.id,
      type: 'INVITE',
      tokenHash: hashToken(token),
      expiresAt: new Date(NOW.getTime() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
    });

    await expect(service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });
    expect(tokens.rows[0]?.usedAt).toBeNull();
  });

  it('répond TOKEN_INVALID pour un compte inactif, sans changer le mot de passe', async () => {
    const user = account({
      failedLoginCount: 4,
      lockedUntil: new Date(NOW.getTime() + FIFTEEN_MIN_MS),
    });
    const { service, mailer, tokens, users, sessions } = setup(user, true);
    const previous = await sessions.create({
      userId: user.id,
      csrfToken: 'session-existante',
      createdAt: NOW.toISOString(),
    });
    await service.forgotPassword(user.email);
    const token = tokenFrom(sentAt(mailer, 0));
    user.active = false;

    await expect(service.resetPassword(token, 'password1234')).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });

    expect(user.passwordHash).toBe('hash-ada');
    expect(user.failedLoginCount).toBe(4);
    expect(user.lockedUntil).toEqual(new Date(NOW.getTime() + FIFTEEN_MIN_MS));
    expect(users.passwordUpdates).toEqual([]);
    expect(tokens.rows[0]?.usedAt).toEqual(NOW);
    expect(await sessions.get(previous)).not.toBeNull();
  });

  it('répond TOKEN_INVALID si le compte est désactivé pendant la transaction', async () => {
    const user = account();
    const { service, mailer, tokens, users, sessions } = setup(user, true);
    users.inactiveAfterIdReads = 1;
    const previous = await sessions.create({
      userId: user.id,
      csrfToken: 'session-existante',
      createdAt: NOW.toISOString(),
    });
    await service.forgotPassword(user.email);
    const token = tokenFrom(sentAt(mailer, 0));

    await expect(service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });

    expect(users.passwordUpdates).toEqual([]);
    expect(tokens.rows[0]?.usedAt).toBeNull();
    expect(await sessions.get(previous)).not.toBeNull();
  });

  it('répond TOKEN_INVALID si le jeton est pris entre-temps, sans changer le mot de passe', async () => {
    const user = account();
    const { service, mailer, tokens, users, sessions } = setup(user, true);
    const previous = await sessions.create({
      userId: user.id,
      csrfToken: 'session-existante',
      createdAt: NOW.toISOString(),
    });
    await service.forgotPassword(user.email);
    const token = tokenFrom(sentAt(mailer, 0));
    tokens.allowConsume = false;

    await expect(service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });

    expect(users.passwordUpdates).toEqual([]);
    expect(tokens.rows[0]?.usedAt).toBeNull();
    expect(await sessions.get(previous)).not.toBeNull();
  });

  it('refuse un mot de passe courant sans consommer le jeton', async () => {
    const { service, mailer, tokens } = setup(account(), true);
    await service.forgotPassword(credentials.email);
    const token = tokenFrom(sentAt(mailer, 0));

    await expect(service.resetPassword(token, 'password1234')).rejects.toMatchObject({
      statusCode: 400,
      code: PASSWORD_TOO_COMMON,
    });
    expect(tokens.rows[0]?.usedAt).toBeNull();
  });

  it('refuse un mot de passe trop court', async () => {
    const { service, mailer, tokens } = setup(account(), true);
    await service.forgotPassword(credentials.email);
    const token = tokenFrom(sentAt(mailer, 0));

    await expect(service.resetPassword(token, 'court')).rejects.toMatchObject({
      statusCode: 400,
      code: PASSWORD_INVALID,
    });
    expect(tokens.rows[0]?.usedAt).toBeNull();
  });

  it('permet le login avec le nouveau mot de passe, détruit les sessions et remet le compteur à zéro', async () => {
    const user = account({
      failedLoginCount: 10,
      lockedUntil: new Date(NOW.getTime() + FIFTEEN_MIN_MS),
    });
    const { service, sessions, mailer, passwords, users } = setup(user, true);
    const previous = await sessions.create({
      userId: user.id,
      csrfToken: 'session-existante',
      createdAt: NOW.toISOString(),
    });

    await service.forgotPassword(user.email);
    const token = tokenFrom(sentAt(mailer, 0));
    await service.resetPassword(token, NEW_PASSWORD);

    expect(passwords.hashedDuringTransaction).toBe(true);
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(users.passwordUpdates).toEqual([
      {
        id: user.id,
        state: {
          passwordHash: `argon2id:${NEW_PASSWORD}`,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      },
    ]);
    expect(await sessions.get(previous)).toBeNull();

    const result = await service.login({ email: user.email, password: NEW_PASSWORD });
    if (!('me' in result)) {
      throw new Error('me attendu dans result');
    }
    expect(result.me.email).toBe(user.email);
    await expect(sessions.get(result.sessionId)).resolves.not.toBeNull();
    await expect(service.resetPassword(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });
  });
});

function plantInvite(tokens: MemoryTokens, userId: string, token: string, expiresAt: Date): void {
  tokens.rows.push({
    id: `invite-${token}`,
    userId,
    type: 'INVITE',
    tokenHash: hashToken(token),
    expiresAt,
    usedAt: null,
  });
}

describe('AuthService.acceptInvite', () => {
  it('répond TOKEN_INVALID pour un jeton inconnu, d’un autre type ou expiré, sans le consommer', async () => {
    const user = account({ active: false });
    const { service, tokens } = setup(user, false);
    const reset = 'jeton-reset';
    const expired = 'jeton-expire';
    tokens.rows.push({
      id: 'reset',
      userId: user.id,
      type: 'PASSWORD_RESET',
      tokenHash: hashToken(reset),
      expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS),
      usedAt: null,
    });
    plantInvite(tokens, user.id, expired, new Date(NOW.getTime() - 1));

    for (const token of ['inconnu', reset, expired]) {
      await expect(service.acceptInvite(token, NEW_PASSWORD)).rejects.toMatchObject({
        statusCode: 400,
        code: TOKEN_INVALID,
      });
    }

    expect(tokens.rows.every((row) => row.usedAt === null)).toBe(true);
    expect(user.active).toBe(false);
    expect(user.passwordHash).toBe('hash-ada');
  });

  it('consomme le jeton si le compte a disparu', async () => {
    const { service, tokens } = setup(null, false);
    const token = 'jeton-orphelin';
    plantInvite(tokens, 'absent', token, new Date(NOW.getTime() + INVITE_TTL_MS));

    await expect(service.acceptInvite(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });

    expect(tokens.rows[0]?.usedAt).toEqual(NOW);
  });

  it('refuse un mot de passe courant ou trop court sans consommer le jeton', async () => {
    const user = account({ active: false });
    const { service, tokens } = setup(user, false);
    const token = 'jeton-invite';
    plantInvite(tokens, user.id, token, new Date(NOW.getTime() + INVITE_TTL_MS));

    await expect(service.acceptInvite(token, 'password1234')).rejects.toMatchObject({
      statusCode: 400,
      code: PASSWORD_TOO_COMMON,
    });
    await expect(service.acceptInvite(token, 'court')).rejects.toMatchObject({
      statusCode: 400,
      code: PASSWORD_INVALID,
    });

    expect(tokens.rows[0]?.usedAt).toBeNull();
    expect(user.active).toBe(false);
  });

  it('n’active pas le compte si le jeton est pris entre-temps', async () => {
    const user = account({ active: false });
    const { service, tokens, users } = setup(user, false);
    const token = 'jeton-invite';
    plantInvite(tokens, user.id, token, new Date(NOW.getTime() + INVITE_TTL_MS));
    tokens.allowConsume = false;

    await expect(service.acceptInvite(token, NEW_PASSWORD)).rejects.toMatchObject({
      statusCode: 400,
      code: TOKEN_INVALID,
    });

    expect(user.active).toBe(false);
    expect(user.passwordHash).toBe('hash-ada');
    expect(users.activations).toEqual([]);
    expect(tokens.rows[0]?.usedAt).toBeNull();
  });

  describe('Audit des connexions (F-91)', () => {
    it('enregistre auth.login avec userId et ip lors d’une connexion réussie', async () => {
      const user = account();
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      const result = await service.login(credentials, '192.168.1.50');
      expect(result).toHaveProperty('sessionId');
      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        ip: '192.168.1.50',
      });
    });

    it('enregistre auth.login_failed sans mot de passe ni email dans diff quand l’utilisateur est inconnu', async () => {
      const recorded: RecordAuditParams[] = [];
      const recordMock = vi.fn((params: RecordAuditParams) => {
        recorded.push(params);
        return Promise.resolve();
      });
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        null,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: 'inconnu@xplor.test', password: 'bad-password' }, '10.0.0.1'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: null,
        userId: null,
        diff: { reason: 'invalid_credentials' },
        ip: '10.0.0.1',
      });

      const firstCall = recorded[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        expect(firstCall.diff).not.toBeNull();
        expect(firstCall.diff).not.toHaveProperty('password');
        expect(firstCall.diff).not.toHaveProperty('email');
        const serialized = JSON.stringify(firstCall.diff ?? {});
        expect(serialized).not.toContain('bad-password');
        expect(serialized).not.toContain('inconnu@xplor.test');
      }
    });

    it('enregistre auth.login_failed avec entityId si l’utilisateur est connu lors d’un mot de passe erroné', async () => {
      const user = account();
      const recorded: RecordAuditParams[] = [];
      const recordMock = vi.fn((params: RecordAuditParams) => {
        recorded.push(params);
        return Promise.resolve();
      });
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: credentials.email, password: 'faux-mot-de-passe' }, '10.0.0.2'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        diff: { reason: 'invalid_credentials' },
        ip: '10.0.0.2',
      });

      const firstCall = recorded[0];
      expect(firstCall).toBeDefined();
      if (firstCall !== undefined) {
        expect(firstCall.diff).not.toBeNull();
        expect(firstCall.diff).not.toHaveProperty('password');
        expect(firstCall.diff).not.toHaveProperty('email');
        const serialized = JSON.stringify(firstCall.diff ?? {});
        expect(serialized).not.toContain('faux-mot-de-passe');
        expect(serialized).not.toContain(credentials.email);
      }
    });

    it('enregistre auth.login_failed avec entityId si le compte est verrouillé', async () => {
      const user = account({ lockedUntil: new Date('2026-09-29T12:30:00.000Z') });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login(credentials, '10.0.0.3'),
      ).rejects.toMatchObject({
        statusCode: 423,
        code: ACCOUNT_LOCKED,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        diff: { reason: 'account_locked' },
        ip: '10.0.0.3',
      });
    });

    it('enregistre auth.login_failed avec entityId si le compte est inactif', async () => {
      const user = account({ active: false });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login(credentials, '10.0.0.4'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        diff: { reason: 'inactive' },
        ip: '10.0.0.4',
      });
    });

    it('ne bloque pas la connexion si audit.record rejette une erreur', async () => {
      const user = account();
      const recordMock = vi.fn().mockRejectedValue(new Error('Erreur base audit'));
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      const result = await service.login(credentials, '192.168.1.50');
      expect(result).toHaveProperty('sessionId');
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('ne bloque pas la connexion si audit.record lève une exception synchrone', async () => {
      const user = account();
      const recordMock = vi.fn().mockImplementation(() => {
        throw new Error('Crash synchrone');
      });
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      const result = await service.login(credentials, '192.168.1.50');
      expect(result).toHaveProperty('sessionId');
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('lève toujours INVALID_CREDENTIALS si audit.record rejette une erreur lors d’un mot de passe erroné', async () => {
      const user = account();
      const recordMock = vi.fn().mockRejectedValue(new Error('Erreur base audit'));
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: credentials.email, password: 'faux-mot-de-passe' }, '10.0.0.5'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('lève toujours INVALID_CREDENTIALS si audit.record lève une exception synchrone lors d’un mot de passe erroné', async () => {
      const user = account();
      const recordMock = vi.fn().mockImplementation(() => {
        throw new Error('Crash synchrone audit');
      });
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        user,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: credentials.email, password: 'faux-mot-de-passe' }, '10.0.0.5'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('lève toujours INVALID_CREDENTIALS si audit.record rejette une erreur pour un utilisateur inconnu', async () => {
      const recordMock = vi.fn().mockRejectedValue(new Error('Erreur base audit'));
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        null,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: 'inconnu@xplor.test', password: 'bad-password' }, '10.0.0.6'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('lève toujours INVALID_CREDENTIALS si audit.record lève une exception synchrone pour un utilisateur inconnu', async () => {
      const recordMock = vi.fn().mockImplementation(() => {
        throw new Error('Crash synchrone audit');
      });
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        null,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login({ email: 'inconnu@xplor.test', password: 'bad-password' }, '10.0.0.6'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('login2fa : enregistre auth.login avec userId et ip lors d’un second facteur réussi', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
      });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(true) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      const result = await service.login2fa(pendingSessionId, '123456', '192.168.1.60');
      expect(result).toHaveProperty('sessionId');
      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login',
        entityType: 'User',
        entityId: admin.id,
        userId: admin.id,
        ip: '192.168.1.60',
      });
    });

    it('login2fa : enregistre auth.login_failed avec reason invalid_code quand le code TOTP est faux', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
      });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      await expect(
        service.login2fa(pendingSessionId, '000000', '192.168.1.61'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: admin.id,
        userId: admin.id,
        diff: { reason: 'invalid_code' },
        ip: '192.168.1.61',
      });
    });

    it('login2fa : enregistre auth.login_failed avec reason invalid_session quand la session est inconnue', async () => {
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service } = setup(
        null,
        false,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      await expect(
        service.login2fa('session-inconnue', '123456', '192.168.1.62'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: null,
        userId: null,
        diff: { reason: 'invalid_session' },
        ip: '192.168.1.62',
      });
    });

    it('login2fa : enregistre auth.login_failed avec reason account_locked quand le compte est verrouillé', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
        lockedUntil: new Date('2026-09-29T12:30:00.000Z'),
      });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(true) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      await expect(
        service.login2fa(pendingSessionId, '123456', '192.168.1.63'),
      ).rejects.toMatchObject({
        statusCode: 423,
        code: ACCOUNT_LOCKED,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: admin.id,
        userId: admin.id,
        diff: { reason: 'account_locked' },
        ip: '192.168.1.63',
      });
    });

    it('login2fa : enregistre auth.login_failed avec reason inactive quand le compte est inactif', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
        active: false,
      });
      const recordMock = vi.fn().mockResolvedValue(undefined);
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(true) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      await expect(
        service.login2fa(pendingSessionId, '123456', '192.168.1.64'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });

      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(recordMock).toHaveBeenCalledWith({
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: admin.id,
        userId: admin.id,
        diff: { reason: 'inactive' },
        ip: '192.168.1.64',
      });
    });

    it('login2fa : ne bloque pas la connexion si audit.record rejette une erreur', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
      });
      const recordMock = vi.fn().mockRejectedValue(new Error('Erreur base audit'));
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(true) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      const result = await service.login2fa(pendingSessionId, '123456', '192.168.1.65');
      expect(result).toHaveProperty('sessionId');
      expect(recordMock).toHaveBeenCalledTimes(1);
    });

    it('login2fa : lève toujours INVALID_CREDENTIALS si audit.record rejette une erreur lors d’un code erroné', async () => {
      const admin = account({
        id: 'admin-2fa',
        email: 'admin2fa@xplor.test',
        role: Role.ADMIN,
        totpEnabled: true,
      });
      const recordMock = vi.fn().mockRejectedValue(new Error('Erreur base audit'));
      const fakeAudit: AuditRecorder = { record: recordMock };
      const { service, sessions } = setup(
        admin,
        true,
        new FakeMailer(),
        { verifyLoginCode: vi.fn().mockResolvedValue(false) },
        fakeAudit,
      );

      const pendingSessionId = await sessions.create({
        userId: admin.id,
        csrfToken: 'csrf-pending',
        createdAt: '2026-09-29T08:00:00.000Z',
        pending2fa: true,
      });

      await expect(
        service.login2fa(pendingSessionId, '000000', '192.168.1.66'),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: INVALID_CREDENTIALS,
      });
      expect(recordMock).toHaveBeenCalledTimes(1);
    });
  });
});
