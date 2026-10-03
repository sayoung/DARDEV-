import { Module, type DynamicModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ConfigModule } from './config/config.module.js';
import { type Env } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';
import { ViewerModule } from './viewer/viewer.module.js';

import { QueueModule } from './queue/queue.module.js';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        PrismaModule,
        RedisModule,
        QueueModule,
        MailModule,
        AuthModule,
        UsersModule,
        CatalogModule,
        StorageModule,
        ViewerModule,
        HealthModule,
        OpenApiModule,
      ],
    };
  }
}
