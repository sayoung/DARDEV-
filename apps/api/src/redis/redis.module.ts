import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';

export const REDIS = Symbol('REDIS');

function createRedisClient(env: Env): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 1,
  });
  client.on('error', () => {
    // Coupure absorbée : GET /api/health rapporte redis=error sans arrêter le processus.
  });
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: createRedisClient,
      inject: [ENV],
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
