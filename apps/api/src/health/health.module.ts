import { Module } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import { HealthController } from './health.controller.js';
import {
  DbHealthProbe,
  RedisHealthProbe,
  S3_CLIENT,
  StorageHealthProbe,
  createS3Client,
} from './health.probes.js';
import {
  DB_HEALTH_PROBE,
  HealthService,
  REDIS_HEALTH_PROBE,
  STORAGE_HEALTH_PROBE,
} from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: S3_CLIENT,
      useFactory: createS3Client,
      inject: [ENV],
    },
    { provide: DB_HEALTH_PROBE, useClass: DbHealthProbe },
    { provide: REDIS_HEALTH_PROBE, useClass: RedisHealthProbe },
    { provide: STORAGE_HEALTH_PROBE, useClass: StorageHealthProbe },
  ],
})
export class HealthModule {}
