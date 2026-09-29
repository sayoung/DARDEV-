import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { type Redis } from 'ioredis';

import { REDIS } from '../redis/redis.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService, CLOCK } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { PasswordService } from './password.service.js';
import { PrismaUserLookup } from './prisma-user.lookup.js';
import { PrismaUserRepository } from './prisma-user.repository.js';
import { asSessionRedis, RedisSessionStore } from './redis-session.store.js';
import { SessionGuard } from './session.guard.js';
import { SESSION_STORE } from './session-store.js';
import { PrismaUnitOfWork, UNIT_OF_WORK } from './unit-of-work.js';
import { USER_LOOKUP } from './user-lookup.js';
import { PrismaUserTokenRepository, USER_TOKEN_REPOSITORY } from './user-token.repository.js';
import { USER_REPOSITORY } from './user.repository.js';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
    }),
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
    PrismaUnitOfWork,
    { provide: UNIT_OF_WORK, useExisting: PrismaUnitOfWork },
    PasswordService,
    { provide: CLOCK, useValue: (): Date => new Date() },
    AuthService,
    SessionGuard,
    CsrfGuard,
  ],
  exports: [
    SESSION_STORE,
    USER_LOOKUP,
    USER_REPOSITORY,
    USER_TOKEN_REPOSITORY,
    UNIT_OF_WORK,
    PasswordService,
    CLOCK,
    SessionGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
