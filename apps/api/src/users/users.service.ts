import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  InviteUserResponseSchema,
  type InviteUserRequest,
  type InviteUserResponse,
} from '@xplor/shared';

import { CLOCK, type Clock, type PasswordVerifier } from '../auth/auth.service.js';
import { PasswordService } from '../auth/password.service.js';
import { USER_TOKEN_REPOSITORY, type UserTokenRepository } from '../auth/user-token.repository.js';
import { expiryFor, generateToken } from '../auth/user-token.js';
import { USER_REPOSITORY, type UserRepository } from '../auth/user.repository.js';
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
  ) {}

  /**
   * Crée un compte inactif et envoie le lien d'invitation.
   * Le mot de passe initial est le hachage d'un secret aléatoire qui n'est pas conservé.
   */
  async invite(input: InviteUserRequest): Promise<InviteUserResponse> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw emailTaken();
    }
    const passwordHash = await this.passwords.hash(randomBytes(32).toString('base64url'));
    const user = await this.users.createInvited({
      email,
      name,
      passwordHash,
      role: input.role,
      uiLang: input.uiLang,
    });
    const now = this.clock();
    await this.tokens.invalidateUnused(user.id, 'INVITE');
    const generated = generateToken();
    await this.tokens.create({
      userId: user.id,
      type: 'INVITE',
      tokenHash: generated.tokenHash,
      expiresAt: expiryFor('INVITE', now),
    });
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
}
