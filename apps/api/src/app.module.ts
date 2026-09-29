import { Module, type DynamicModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { type Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        PrismaModule,
        RedisModule,
        MailModule,
        AuthModule,
        UsersModule,
        HealthModule,
      ],
    };
  }
}
