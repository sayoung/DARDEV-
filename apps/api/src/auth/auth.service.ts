import { Inject, Injectable } from '@nestjs/common';
import { MeResponseSchema, type LoginRequest, type MeResponse } from '@xplor/shared';

import { accountLocked, invalidCredentials } from './auth.errors.js';
import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import { isLocked, registerFailure, registerSuccess } from './lockout.js';
import { PasswordService } from './password.service.js';
import { createCsrfToken, SESSION_STORE, type SessionStore } from './session-store.js';
import { USER_REPOSITORY, type AuthUser, type UserRepository } from './user.repository.js';

/** Vérification argon2id. `PasswordService` en production, un faux dans les tests. */
export type PasswordVerifier = {
  verify(passwordHash: string, password: string): Promise<boolean>;
};

export const CLOCK = Symbol('CLOCK');

export type Clock = () => Date;

export type LoginResult = {
  sessionId: string;
  me: MeResponse;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(PasswordService) private readonly passwords: PasswordVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
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
