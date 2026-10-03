import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { ENV } from '../config/config.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE } from '../storage/storage.service.js';
import { ViewerModule } from './viewer.module.js';
import { ViewerService } from './viewer.service.js';

@Global()
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }])],
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: STORAGE_SERVICE, useValue: {} },
    { provide: ENV, useValue: { MEDIA_PUBLIC_URL: 'http://test' } },
  ],
  exports: [PrismaService, STORAGE_SERVICE, ENV, ThrottlerModule],
})
class MockGlobalModule {}

describe('ViewerModule', () => {
  it('should compile the module and resolve ViewerService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MockGlobalModule, ViewerModule],
    }).compile();

    const service = moduleRef.get(ViewerService);
    expect(service).toBeDefined();
  });
});
