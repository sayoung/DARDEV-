import { forwardRef, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { type Redis } from 'ioredis';

import { AuditModule } from '../audit/audit.module.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CLOCK } from './clock.js';
import { CsrfGuard } from './csrf.guard.js';
import { PasswordService } from './password.service.js';
import { PrismaTwoFactorUserRepository } from './prisma-two-factor.user.repository.js';
import { PrismaUserLookup } from './prisma-user.lookup.js';
import { PrismaUserRepository } from './prisma-user.repository.js';
import { asSessionRedis, RedisSessionStore } from './redis-session.store.js';
import { SessionGuard } from './session.guard.js';
import { SESSION_STORE } from './session-store.js';
import {
  TOTP_ENCRYPTION_KEY,
  TWO_FACTOR_USER_REPOSITORY,
  TwoFactorService,
} from './two-factor.service.js';
import { PrismaUnitOfWork, UNIT_OF_WORK } from './unit-of-work.js';
import { USER_LOOKUP } from './user-lookup.js';
import { PrismaUserTokenRepository, USER_TOKEN_REPOSITORY } from './user-token.repository.js';
import { USER_REPOSITORY } from './user.repository.js';

export const DEFAULT_TEST_TOTP_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
    }),
    forwardRef(() => AuditModule),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: SESSION_STORE,
      useFactory: (redis: Redis) => new RedisSessionStore(asSessionRedis(redis)),
      inject: [REDIS],
    },
    PrismaUserLookup,
    { provide: USER_LOOKUP, useExisting: PrismaUserLookup },
    PrismaUserRepository,
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
    PrismaUserTokenRepository,
    { provide: USER_TOKEN_REPOSITORY, useExisting: PrismaUserTokenRepository },
    PrismaTwoFactorUserRepository,
    { provide: TWO_FACTOR_USER_REPOSITORY, useExisting: PrismaTwoFactorUserRepository },
    PrismaUnitOfWork,
    { provide: UNIT_OF_WORK, useExisting: PrismaUnitOfWork },
    PasswordService,
    { provide: CLOCK, useValue: (): Date => new Date() },
    {
      provide: TOTP_ENCRYPTION_KEY,
      useFactory: (env: Pick<Env, 'TOTP_ENCRYPTION_KEY'>): string => {
        return env.TOTP_ENCRYPTION_KEY || DEFAULT_TEST_TOTP_ENCRYPTION_KEY;
      },
      inject: [ENV],
    },
    TwoFactorService,
    AuthService,
    SessionGuard,
    CsrfGuard,
  ],
  exports: [
    SESSION_STORE,
    USER_LOOKUP,
    USER_REPOSITORY,
    USER_TOKEN_REPOSITORY,
    TWO_FACTOR_USER_REPOSITORY,
    TOTP_ENCRYPTION_KEY,
    UNIT_OF_WORK,
    PasswordService,
    CLOCK,
    SessionGuard,
    CsrfGuard,
    TwoFactorService,
  ],
})
export class AuthModule {}
