import { Inject, Injectable, Logger } from '@nestjs/common';
import { MeResponseSchema, type LoginRequest, type MeResponse } from '@xplor/shared';
import { ZodError } from 'zod';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { mailActionLink, renderMail } from '../mail/render-mail.js';
import {
  PASSWORD_INVALID,
  PASSWORD_TOO_COMMON,
  AuthRequestError,
  accountLocked,
  invalidCredentials,
  tokenInvalid,
} from './auth.errors.js';
import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import { isLocked, registerFailure, registerSuccess } from './lockout.js';
import {
  PasswordService,
  PasswordTooCommonError,
  validateNewPassword,
} from './password.service.js';
import { createCsrfToken, SESSION_STORE, type SessionStore } from './session-store.js';
import { UNIT_OF_WORK, type UnitOfWork } from './unit-of-work.js';
import { USER_REPOSITORY, type AuthUser, type UserRepository } from './user.repository.js';
import { USER_TOKEN_REPOSITORY, type UserTokenRepository } from './user-token.repository.js';
import { checkToken, expiryFor, generateToken, hashToken } from './user-token.js';

/** Vérification et hachage argon2id. `PasswordService` en production, un faux dans les tests. */
export type PasswordVerifier = {
  verify(passwordHash: string, password: string): Promise<boolean>;
  hash(password: string): Promise<string>;
};

export const CLOCK = Symbol('CLOCK');

export type Clock = () => Date;

export type LoginResult = {
  sessionId: string;
  me: MeResponse;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(PasswordService) private readonly passwords: PasswordVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(USER_TOKEN_REPOSITORY) private readonly tokens: UserTokenRepository,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Pick<Env, 'ADMIN_BASE_URL'>,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async login(input: LoginRequest): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    const now = this.clock();

    if (!user) {
      await this.passwords.verify(DUMMY_PASSWORD_HASH, input.password);
      throw invalidCredentials();
    }

    if (isLocked(user, now)) {
      throw accountLocked();
    }

    const passwordOk = await this.passwords.verify(user.passwordHash, input.password);
    if (!passwordOk) {
      await this.users.updateLoginState(user.id, registerFailure(user, now));
      throw invalidCredentials();
    }

    if (!user.active) {
      throw invalidCredentials();
    }

    const reset = registerSuccess();
    await this.users.updateLoginState(user.id, { ...reset, lastLoginAt: now });
    await this.sessions.destroyAllForUser(user.id);
    const csrfToken = createCsrfToken();
    const sessionId = await this.sessions.create({
      userId: user.id,
      csrfToken,
      createdAt: now.toISOString(),
    });
    return { sessionId, me: toMe(user, csrfToken) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.destroy(sessionId);
  }

  async me(userId: string, csrfToken: string): Promise<MeResponse> {
    const user = await this.users.findById(userId);
    if (!user || !user.active) {
      throw invalidCredentials();
    }
    return toMe(user, csrfToken);
  }

  /**
   * Réponse identique pour toute adresse : la promesse est tenue, même si l'envoi échoue.
   * Un compte actif reçoit un nouveau jeton après invalidation des jetons PASSWORD_RESET encore inutilisés.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || !user.active) {
      return;
    }
    try {
      const now = this.clock();
      await this.tokens.invalidateUnused(user.id, 'PASSWORD_RESET');
      const generated = generateToken();
      await this.tokens.create({
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash: generated.tokenHash,
        expiresAt: expiryFor('PASSWORD_RESET', now),
      });
      const link = mailActionLink(this.env.ADMIN_BASE_URL, 'reset', generated.token);
      const rendered = renderMail('reset', user.uiLang, link);
      await this.mailer.send({ to: user.email, ...rendered });
    } catch {
      this.logger.warn('Envoi de réinitialisation interrompu');
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const now = this.clock();
    const record = await this.tokens.findByHash(hashToken(token));
    if (record === null || record.type !== 'PASSWORD_RESET' || checkToken(record, now) !== 'OK') {
      throw tokenInvalid();
    }
    const user = await this.users.findById(record.userId);
    if (!user || !user.active) {
      await this.tokens.markUsed(record.id, now);
      throw tokenInvalid();
    }
    assertNewPassword(password);
    await this.unitOfWork.run(async (db) => {
      const current = await this.users.findById(record.userId, db);
      if (!current || !current.active) {
        throw tokenInvalid();
      }
      const consumed = await this.tokens.markUsed(record.id, now, db);
      if (!consumed) {
        throw tokenInvalid();
      }
      const passwordHash = await this.passwords.hash(password);
      await this.users.updatePassword(
        record.userId,
        { passwordHash, failedLoginCount: 0, lockedUntil: null },
        db,
      );
    });
    await this.sessions.destroyAllForUser(record.userId);
  }
}

function toMe(user: AuthUser, csrfToken: string): MeResponse {
  return MeResponseSchema.parse({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    uiLang: user.uiLang,
    csrfToken,
  });
}

function assertNewPassword(password: string): void {
  try {
    validateNewPassword(password);
  } catch (error: unknown) {
    if (error instanceof PasswordTooCommonError) {
      throw new AuthRequestError(PASSWORD_TOO_COMMON);
    }
    if (error instanceof ZodError) {
      throw new AuthRequestError(PASSWORD_INVALID);
    }
    throw error;
  }
}
