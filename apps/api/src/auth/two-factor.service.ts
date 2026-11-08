import { Inject, Injectable, Optional } from '@nestjs/common';
import { Role } from '@xplor/shared';

import { CLOCK, type Clock } from './clock.js';
import { decryptTotpSecret, encryptTotpSecret } from './totp-secret-cipher.js';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp.js';

export const TWO_FACTOR_ROLE_NOT_ALLOWED = 'TWO_FACTOR_ROLE_NOT_ALLOWED';
export const TWO_FACTOR_USER_NOT_FOUND = 'TWO_FACTOR_USER_NOT_FOUND';
export const TWO_FACTOR_INVALID_CODE = 'TWO_FACTOR_INVALID_CODE';
export const TWO_FACTOR_NOT_INITIALIZED = 'TWO_FACTOR_NOT_INITIALIZED';
export const TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED';

export class TwoFactorRoleNotAllowedError extends Error {
  readonly statusCode = 403;
  readonly code = TWO_FACTOR_ROLE_NOT_ALLOWED;

  constructor(message = '2FA is only applicable to ADMIN users') {
    super(message);
    this.name = 'TwoFactorRoleNotAllowedError';
  }
}

export class TwoFactorUserNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = TWO_FACTOR_USER_NOT_FOUND;

  constructor(message = 'User not found') {
    super(message);
    this.name = 'TwoFactorUserNotFoundError';
  }
}

export class TwoFactorInvalidCodeError extends Error {
  readonly statusCode = 400;
  readonly code = TWO_FACTOR_INVALID_CODE;

  constructor(message = 'Invalid two-factor authentication code') {
    super(message);
    this.name = 'TwoFactorInvalidCodeError';
  }
}

export class TwoFactorNotInitializedError extends Error {
  readonly statusCode = 400;
  readonly code = TWO_FACTOR_NOT_INITIALIZED;

  constructor(message = 'Two-factor setup has not been initiated') {
    super(message);
    this.name = 'TwoFactorNotInitializedError';
  }
}

export class TwoFactorNotEnabledError extends Error {
  readonly statusCode = 400;
  readonly code = TWO_FACTOR_NOT_ENABLED;

  constructor(message = 'Two-factor authentication is not enabled') {
    super(message);
    this.name = 'TwoFactorNotEnabledError';
  }
}

export type TwoFactorUser = {
  id: string;
  role: Role;
  totpSecret: string | null;
  totpEnabled: boolean;
};

export type TwoFactorTotpUpdate = {
  totpSecret?: string | null;
  totpEnabled?: boolean;
};

export interface TwoFactorUserRepository {
  findById(id: string): Promise<TwoFactorUser | null>;
  updateTotp(id: string, update: TwoFactorTotpUpdate): Promise<void>;
}

export const TWO_FACTOR_USER_REPOSITORY = Symbol('TWO_FACTOR_USER_REPOSITORY');
export const TOTP_ENCRYPTION_KEY = Symbol('TOTP_ENCRYPTION_KEY');

export type TwoFactorSetupResult = {
  secret: string;
  otpauthUri: string;
};

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(TWO_FACTOR_USER_REPOSITORY)
    private readonly users: TwoFactorUserRepository,
    @Inject(TOTP_ENCRYPTION_KEY)
    private readonly encryptionKey: string,
    @Optional()
    @Inject(CLOCK)
    private readonly clock: Clock = (): Date => new Date(),
  ) {
    if (typeof this.encryptionKey !== 'string' || !HEX_64_REGEX.test(this.encryptionKey)) {
      throw new Error('Invalid TOTP encryption key: must be a 64-character hex string (32 bytes)');
    }
  }

  async beginSetup(userId: string, email: string): Promise<TwoFactorSetupResult> {
    const cleanEmail = email.trim();
    if (cleanEmail.length === 0) {
      throw new Error('Invalid email address');
    }

    const user = await this.users.findById(userId);
    if (user === null) {
      throw new TwoFactorUserNotFoundError();
    }
    if (user.role !== Role.ADMIN) {
      throw new TwoFactorRoleNotAllowedError();
    }

    const secret = generateTotpSecret();
    const uri = otpauthUri(secret, cleanEmail, 'Xplor');
    const encryptedSecret = encryptTotpSecret(secret, this.encryptionKey);

    await this.users.updateTotp(userId, {
      totpSecret: encryptedSecret,
      totpEnabled: false,
    });

    return {
      secret,
      otpauthUri: uri,
    };
  }

  async confirmSetup(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new TwoFactorUserNotFoundError();
    }
    if (user.role !== Role.ADMIN) {
      throw new TwoFactorRoleNotAllowedError();
    }
    if (user.totpSecret === null || user.totpSecret.length === 0) {
      throw new TwoFactorNotInitializedError();
    }

    const secret = decryptTotpSecret(user.totpSecret, this.encryptionKey);
    const valid = verifyTotp(secret, code, this.clock().getTime());
    if (!valid) {
      throw new TwoFactorInvalidCodeError();
    }

    await this.users.updateTotp(userId, {
      totpEnabled: true,
    });
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new TwoFactorUserNotFoundError();
    }
    if (user.role !== Role.ADMIN) {
      throw new TwoFactorRoleNotAllowedError();
    }
    if (!user.totpEnabled || user.totpSecret === null || user.totpSecret.length === 0) {
      throw new TwoFactorNotEnabledError();
    }

    const secret = decryptTotpSecret(user.totpSecret, this.encryptionKey);
    const valid = verifyTotp(secret, code, this.clock().getTime());
    if (!valid) {
      throw new TwoFactorInvalidCodeError();
    }

    await this.users.updateTotp(userId, {
      totpSecret: null,
      totpEnabled: false,
    });
  }

  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new TwoFactorUserNotFoundError();
    }
    if (user.role !== Role.ADMIN) {
      throw new TwoFactorRoleNotAllowedError();
    }
    if (!user.totpEnabled || user.totpSecret === null || user.totpSecret.length === 0) {
      return false;
    }

    try {
      const secret = decryptTotpSecret(user.totpSecret, this.encryptionKey);
      return verifyTotp(secret, code, this.clock().getTime());
    } catch {
      return false;
    }
  }
}
