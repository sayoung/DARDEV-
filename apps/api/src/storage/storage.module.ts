import { Global, Module } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import { S3_CLIENT, createS3Client } from '../health/health.probes.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: createS3Client,
      inject: [ENV],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
