import 'reflect-metadata';

import { createHash } from 'node:crypto';

import { BadRequestException, HttpStatus, RequestMethod } from '@nestjs/common';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { AuthController } from '../auth/auth.controller.js';
import { AuthService, type PasswordVerifier } from '../auth/auth.service.js';
import { INVALID_CREDENTIALS, TOKEN_INVALID } from '../auth/auth.errors.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { InMemorySessionStore } from '../auth/in-memory-session.store.js';
import type { SessionRecord, SessionStore } from '../auth/session-store.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { type AuthTx, type UnitOfWork } from '../auth/unit-of-work.js';
import {
  type NewUserToken,
  type UserTokenRecord,
  type UserTokenRepository,
} from '../auth/user-token.repository.js';
import { INVITE_TTL_MS, hashToken } from '../auth/user-token.js';
import {
  type AuthUser,
  type LoginStateUpdate,
  type NewInvitedUser,
  type PasswordUpdate,
  type UserRepository,
} from '../auth/user.repository.js';
import { FakeMailer } from '../mail/fake-mailer.js';
import type { MailMessage } from '../mail/mailer.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const START = new Date('2026-09-29T12:00:00.000Z');
const NEW_PASSWORD = 'xplor-kiosque-rabat-2026';
const ARABIC_SUBJECT = 'دعوة للانضمام إلى Xplor';

const inviteBody = {
  email: 'nouveau@xplor.test',
  name: 'Nouveau',
  role: Role.EDITOR,
  uiLang: 'ar' as const,
};

function digest(password: string): string {
  return createHash('sha256').update(password).digest('hex');
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

class MemoryUsers implements UserRepository {
  readonly createdEmails: string[] = [];
  private seq = 0;

  constructor(
    private readonly byEmail: Map<string, AuthUser>,
    private readonly tokens: MemoryTokens,
  ) {}

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
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.failedLoginCount = state.failedLoginCount;
        user.lockedUntil = state.lockedUntil;
      }
    }
    return Promise.resolve();
  }

  updatePassword(id: string, state: PasswordUpdate): Promise<void> {
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
    this.seq += 1;
    const user: AuthUser = {
      id: `user-${String(this.seq)}`,
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
    this.createdEmails.push(input.email);
    this.tokens.rows.push({
      id: 'ancien',
      userId: user.id,
      type: 'INVITE',
      tokenHash: 'empreinte-ancienne',
      expiresAt: new Date(START.getTime() + INVITE_TTL_MS),
      usedAt: null,
    });
    return Promise.resolve(user);
  }

  activate(id: string, passwordHash: string): Promise<void> {
    for (const user of this.byEmail.values()) {
      if (user.id === id) {
        user.passwordHash = passwordHash;
        user.active = true;
      }
    }
    return Promise.resolve();
  }
}

class RecordingPasswords implements PasswordVerifier {
  readonly plaintexts: string[] = [];
  hashedDuringTransaction = false;

  constructor(private readonly unitOfWork: ImmediateUnitOfWork) {}

  verify(passwordHash: string, password: string): Promise<boolean> {
    return Promise.resolve(passwordHash === digest(password));
  }

  hash(password: string): Promise<string> {
    this.plaintexts.push(password);
    this.hashedDuringTransaction = this.unitOfWork.active;
    return Promise.resolve(digest(password));
  }
}

class SpySessions implements SessionStore {
  readonly created: string[] = [];

  constructor(private readonly inner: InMemorySessionStore) {}

  create(data: SessionRecord): Promise<string> {
    this.created.push(data.userId);
    return this.inner.create(data);
  }

  get(id: string): Promise<SessionRecord | null> {
    return this.inner.get(id);
  }

  touch(id: string): Promise<void> {
    return this.inner.touch(id);
  }

  destroy(id: string): Promise<void> {
    return this.inner.destroy(id);
  }

  destroyAllForUser(userId: string): Promise<void> {
    return this.inner.destroyAllForUser(userId);
  }
}

function asRole(role: Role): SessionRequest {
  return {
    method: 'POST',
    headers: {},
    principal: {
      userId: 'caller',
      role,
      hotelIds: role === Role.HOTEL_MANAGER || role === Role.PARTNER ? ['hotel-a'] : [],
    },
  };
}

function harness() {
  let now = START;
  const tokens = new MemoryTokens();
  const users = new MemoryUsers(new Map(), tokens);
  const unitOfWork = new ImmediateUnitOfWork();
  const passwords = new RecordingPasswords(unitOfWork);
  const sessions = new SpySessions(new InMemorySessionStore(() => now.getTime()));
  const mailer = new FakeMailer();
  const clock = (): Date => now;
  const env = { ADMIN_BASE_URL: 'http://admin.test' };
  const auth = new AuthService(users, sessions, passwords, clock, tokens, mailer, env, unitOfWork);
  const usersService = new UsersService(users, tokens, passwords, clock, mailer, env);
  return {
    tokens,
    users,
    passwords,
    sessions,
    mailer,
    auth,
    usersController: new UsersController(usersService),
    authController: new AuthController(auth, { NODE_ENV: 'test' }),
    setNow(value: Date) {
      now = value;
    },
  };
}

function sent(mailer: FakeMailer): MailMessage {
  const message = mailer.sent[0];
  if (message === undefined) {
    throw new Error('courriel absent');
  }
  return message;
}

function inviteToken(message: MailMessage): string {
  const match = /\/invite\/([^/\s"<]+)/.exec(message.text);
  const token = match?.[1];
  if (token === undefined) {
    throw new Error('lien d’invitation absent');
  }
  return token;
}

describe('invitation par l’ADMIN', () => {
  it('protège POST /admin/users/invitations par la session, le CSRF et répond 201', () => {
    const invite = Object.getOwnPropertyDescriptor(UsersController.prototype, 'invite')?.value as
      object | undefined;
    if (invite === undefined) {
      throw new Error('méthode absente');
    }

    expect(Reflect.getMetadata('path', UsersController)).toBe('admin/users');
    expect(Reflect.getMetadata('path', invite)).toBe('invitations');
    expect(Reflect.getMetadata('method', invite)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata('__httpCode__', invite)).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata('__guards__', invite)).toEqual([SessionGuard, CsrfGuard]);
  });

  it('refuse EDITOR, HOTEL_MANAGER et PARTNER', async () => {
    for (const role of [Role.EDITOR, Role.HOTEL_MANAGER, Role.PARTNER]) {
      const { usersController, mailer, users } = harness();

      await expect(usersController.invite(asRole(role), inviteBody)).rejects.toMatchObject({
        status: 403,
      });
      expect(mailer.sent).toEqual([]);
      expect(users.createdEmails).toEqual([]);
    }
  });

  it('crée le compte inactif, envoie un courriel arabe, puis n’ouvre la session qu’au login', async () => {
    const ctx = harness();
    const response = await ctx.usersController.invite(asRole(Role.ADMIN), inviteBody);

    expect(response).toEqual({
      id: 'user-1',
      email: 'nouveau@xplor.test',
      name: 'Nouveau',
      role: Role.EDITOR,
    });
    expect(ctx.mailer.sent).toHaveLength(1);
    const message = sent(ctx.mailer);
    expect(message.to).toBe('nouveau@xplor.test');
    expect(message.subject).toBe(ARABIC_SUBJECT);
    const token = inviteToken(message);
    expect(message.text).toContain(`http://admin.test/invite/${token}`);
    expect(message.html).toContain(`http://admin.test/invite/${token}`);

    const secret = ctx.passwords.plaintexts[0];
    expect(secret).toBeDefined();
    expect(secret).not.toBe(NEW_PASSWORD);
    const user = await ctx.users.findByEmail('nouveau@xplor.test');
    expect(user?.active).toBe(false);
    expect(user?.uiLang).toBe('ar');
    expect(user?.passwordHash).toBe(digest(secret ?? ''));
    for (const value of [
      user?.email,
      user?.name,
      user?.passwordHash,
      message.text,
      message.html,
      JSON.stringify(response),
    ]) {
      expect(value?.includes(secret ?? 'secret-absent')).toBe(false);
    }
    expect(JSON.stringify(ctx.tokens.rows)).not.toContain(token);
    const fresh = ctx.tokens.rows.find((row) => row.usedAt === null);
    expect(fresh).toMatchObject({
      userId: 'user-1',
      type: 'INVITE',
      tokenHash: hashToken(token),
      expiresAt: new Date(START.getTime() + INVITE_TTL_MS),
    });
    expect(ctx.tokens.rows.find((row) => row.id === 'ancien')?.usedAt).not.toBeNull();
    expect(ctx.passwords.hashedDuringTransaction).toBe(false);

    await expect(
      ctx.usersController.invite(asRole(Role.ADMIN), {
        ...inviteBody,
        email: 'Nouveau@Xplor.test',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'EMAIL_TAKEN' },
    });
    expect(ctx.mailer.sent).toHaveLength(1);
    expect(ctx.users.createdEmails).toEqual(['nouveau@xplor.test']);

    await expect(
      ctx.auth.login({ email: 'nouveau@xplor.test', password: NEW_PASSWORD }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: INVALID_CREDENTIALS,
    });
    expect(user?.active).toBe(false);
    expect(ctx.sessions.created).toEqual([]);

    await expect(
      ctx.authController.acceptInvite({ token, password: NEW_PASSWORD }),
    ).resolves.toBeUndefined();
    expect(ctx.sessions.created).toEqual([]);
    expect(user?.active).toBe(true);
    expect(user?.passwordHash).toBe(digest(NEW_PASSWORD));
    expect(ctx.passwords.hashedDuringTransaction).toBe(true);

    const loggedIn = await ctx.auth.login({ email: 'nouveau@xplor.test', password: NEW_PASSWORD });
    expect(loggedIn.me).toMatchObject({
      email: 'nouveau@xplor.test',
      name: 'Nouveau',
      role: Role.EDITOR,
    });
    expect(ctx.sessions.created).toEqual(['user-1']);

    await expect(
      ctx.authController.acceptInvite({ token, password: NEW_PASSWORD }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: TOKEN_INVALID },
    });
    expect(user?.passwordHash).toBe(digest(NEW_PASSWORD));
  });

  it('refuse un jeton expiré à 48 h plus 1 ms', async () => {
    const ctx = harness();
    await ctx.usersController.invite(asRole(Role.ADMIN), inviteBody);
    const token = inviteToken(sent(ctx.mailer));
    ctx.setNow(new Date(START.getTime() + INVITE_TTL_MS + 1));

    await expect(
      ctx.authController.acceptInvite({ token, password: NEW_PASSWORD }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: TOKEN_INVALID },
    });

    const user = await ctx.users.findByEmail('nouveau@xplor.test');
    expect(user?.active).toBe(false);
    expect(ctx.tokens.rows.find((row) => row.tokenHash === hashToken(token))?.usedAt).toBeNull();
    expect(ctx.sessions.created).toEqual([]);
  });

  it('refuse un corps d’invitation invalide', async () => {
    const { usersController, mailer } = harness();

    await expect(
      usersController.invite(asRole(Role.ADMIN), { ...inviteBody, name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      usersController.invite({ method: 'POST', headers: {} }, inviteBody),
    ).rejects.toMatchObject({ status: 403 });
    expect(mailer.sent).toEqual([]);
  });
});
