import { Role, type LoginRequest } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

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
import { AuthService, type PasswordVerifier } from './auth.service.js';
import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import { InMemorySessionStore } from './in-memory-session.store.js';
import { type AuthTx, type UnitOfWork } from './unit-of-work.js';
import {
  type LoginStateUpdate,
  type NewInvitedUser,
  type PasswordUpdate,
  type AuthUser,
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
      failedLoginCount: 0,
      lockedUntil: null,
    };
    this.byEmail.set(input.email, user);
    return Promise.resolve(user);
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
};
function setup(
  user: AuthUser | null,
  acceptPassword: boolean,
  mailer: Mailer,
): {
  users: MemoryUsers;
  passwords: FakePasswords;
  sessions: InMemorySessionStore;
  service: AuthService;
  tokens: MemoryTokens;
  mailer: Mailer;
};
function setup(user: AuthUser | null, acceptPassword: boolean, mailer: Mailer = new FakeMailer()) {
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
  );
  return { users, passwords, sessions, service, tokens, mailer };
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
});
