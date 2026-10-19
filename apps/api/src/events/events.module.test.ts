import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { EventsPartitionService } from './events-partition.service.js';
import { EventsModule } from './events.module.js';

describe('EventsModule', () => {
  it('compile le module et résout EventsPartitionService', async () => {
    const fakePrisma = {
      $executeRaw: () => Promise.resolve(1),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();

    const service = moduleRef.get(EventsPartitionService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EventsPartitionService);
    await moduleRef.close();
  });
});
