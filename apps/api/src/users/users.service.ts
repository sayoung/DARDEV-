import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  InviteUserResponseSchema,
  type InviteUserRequest,
  type InviteUserResponse,
  type Lang,
  type Role,
} from '@xplor/shared';

import { CLOCK, type Clock, type PasswordVerifier } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { UNIT_OF_WORK, type AuthTx, type UnitOfWork } from '../auth/unit-of-work.js';
import { USER_TOKEN_REPOSITORY, type UserTokenRepository } from '../auth/user-token.repository.js';
import { expiryFor, generateToken } from '../auth/user-token.js';
import { USER_REPOSITORY, type AuthUser, type UserRepository } from '../auth/user.repository.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import { mailActionLink, renderMail } from '../mail/render-mail.js';
import { emailTaken } from './users.errors.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_TOKEN_REPOSITORY) private readonly tokens: UserTokenRepository,
    @Inject(PasswordService) private readonly passwords: PasswordVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Pick<Env, 'ADMIN_BASE_URL'>,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /**
   * Crée un compte inactif, ou renouvelle une invitation jamais acceptée, puis envoie le lien.
   * Les écritures tiennent dans une transaction. Le courriel part après le commit.
   * Le mot de passe initial est le hachage d'un secret aléatoire qui n'est pas conservé.
   */
  async invite(input: InviteUserRequest): Promise<InviteUserResponse> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const existing = await this.users.findByEmail(email);
    if (existing !== null && !canRenewInvite(existing)) {
      throw emailTaken();
    }

    const now = this.clock();
    const generated = generateToken();
    const user =
      existing === null
        ? await this.createInvite(email, name, input.role, input.uiLang, generated, now)
        : await this.renewInvite(existing.id, name, input.role, input.uiLang, generated, now);

    const link = mailActionLink(this.env.ADMIN_BASE_URL, 'invite', generated.token);
    const rendered = renderMail('invite', input.uiLang, link);
    await this.mailer.send({ to: user.email, ...rendered });
    return InviteUserResponseSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  /** Le hachage du secret initial reste hors transaction : seul l'insert est transactionnel. */
  private async createInvite(
    email: string,
    name: string,
    role: Role,
    uiLang: Lang,
    generated: { tokenHash: string },
    now: Date,
  ): Promise<AuthUser> {
    const passwordHash = await this.passwords.hash(randomBytes(32).toString('base64url'));
    return this.writeInvite(
      (db) =>
        this.users.createInvited(
          {
            email,
            name,
            passwordHash,
            role,
            uiLang,
          },
          db,
        ),
      generated,
      now,
    );
  }

  private renewInvite(
    userId: string,
    name: string,
    role: Role,
    uiLang: Lang,
    generated: { tokenHash: string },
    now: Date,
  ): Promise<AuthUser> {
    return this.writeInvite(
      (db) => this.users.updateInvited(userId, { name, role, uiLang }, db),
      generated,
      now,
    );
  }

  /** Création ou mise à jour, invalidation des jetons INVITE, puis nouveau jeton. */
  private writeInvite(
    save: (db: AuthTx) => Promise<AuthUser>,
    generated: { tokenHash: string },
    now: Date,
  ): Promise<AuthUser> {
    return this.unitOfWork.run(async (db) => {
      const saved = await save(db);
      await this.tokens.invalidateUnused(saved.id, 'INVITE', db);
      await this.tokens.create(
        {
          userId: saved.id,
          type: 'INVITE',
          tokenHash: generated.tokenHash,
          expiresAt: expiryFor('INVITE', now),
        },
        db,
      );
      return saved;
    });
  }
}

/** Invitation jamais acceptée : le compte est inactif et ne s'est jamais connecté. */
function canRenewInvite(user: AuthUser): boolean {
  return !user.active && user.lastLoginAt === null;
}
