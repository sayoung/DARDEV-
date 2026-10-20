import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ENV } from '../config/config.module.js';
import { MAILER } from '../mail/mailer.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS } from '../redis/redis.module.js';
import { EventsController } from './events.controller.js';
import { EventsIngestService } from './events-ingest.service.js';
import { EventsPartitionService } from './events-partition.service.js';
import { EventsModule } from './events.module.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useValue: {
        defineCommand: () => {},
      },
    },
    {
      provide: MAILER,
      useValue: {
        send: () => Promise.resolve(),
      },
    },
    {
      provide: ENV,
      useValue: {
        SESSION_SECRET: 'test-session-secret-for-events-module',
        ADMIN_URL: 'http://localhost:5173',
      },
    },
  ],
  exports: [REDIS, MAILER, ENV],
})
class MockGlobalModule {}

describe('EventsModule', () => {
  it('compile le module et résout EventsPartitionService, EventsIngestService et EventsController', async () => {
    const fakePrisma = {
      $executeRaw: () => Promise.resolve(1),
      event: {
        createMany: () => Promise.resolve({ count: 0 }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [MockGlobalModule, EventsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();

    const partitionService = moduleRef.get(EventsPartitionService);
    expect(partitionService).toBeDefined();
    expect(partitionService).toBeInstanceOf(EventsPartitionService);

    const ingestService = moduleRef.get(EventsIngestService);
    expect(ingestService).toBeDefined();
    expect(ingestService).toBeInstanceOf(EventsIngestService);

    const controller = moduleRef.get(EventsController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(EventsController);

    await moduleRef.close();
  });
});
