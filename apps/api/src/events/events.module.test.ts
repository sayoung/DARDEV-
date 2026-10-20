import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { EventsIngestService } from './events-ingest.service.js';
import { EventsPartitionService } from './events-partition.service.js';
import { EventsModule } from './events.module.js';

describe('EventsModule', () => {
  it('compile le module et résout EventsPartitionService et EventsIngestService', async () => {
    const fakePrisma = {
      $executeRaw: () => Promise.resolve(1),
      event: {
        createMany: () => Promise.resolve({ count: 0 }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
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

    await moduleRef.close();
  });
});
