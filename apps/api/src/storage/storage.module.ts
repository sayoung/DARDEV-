import { Global, Module } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { S3_CLIENT, createS3Client } from '../health/health.probes.js';
import {
  LocalStorageService,
  S3StorageService,
  STORAGE_SERVICE,
} from './storage.service.js';
import { StorageController } from './storage.controller.js';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: createS3Client,
      inject: [ENV],
    },
    {
      provide: STORAGE_SERVICE,
      useFactory: (env: Env, s3Storage: S3StorageService, localStorage: LocalStorageService) => {
        return env.STORAGE_PROVIDER === 'local' ? localStorage : s3Storage;
      },
      inject: [ENV, S3StorageService, LocalStorageService],
    },
    S3StorageService,
    LocalStorageService,
  ],
  controllers: [StorageController],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
