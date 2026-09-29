import { Module } from '@nestjs/common';
import { type Redis } from 'ioredis';

import { REDIS } from '../redis/redis.module.js';
import { CsrfGuard } from './csrf.guard.js';
import { PrismaUserLookup } from './prisma-user.lookup.js';
import { asSessionRedis, RedisSessionStore } from './redis-session.store.js';
import { SessionGuard } from './session.guard.js';
import { SESSION_STORE } from './session-store.js';
import { USER_LOOKUP } from './user-lookup.js';

@Module({
  providers: [
    {
      provide: SESSION_STORE,
      useFactory: (redis: Redis) => new RedisSessionStore(asSessionRedis(redis)),
      inject: [REDIS],
    },
    PrismaUserLookup,
    { provide: USER_LOOKUP, useExisting: PrismaUserLookup },
    SessionGuard,
    CsrfGuard,
  ],
  exports: [SESSION_STORE, USER_LOOKUP, SessionGuard, CsrfGuard],
})
export class AuthModule {}
