import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { EventsIngestService } from './events-ingest.service.js';
import { EventsPartitionService } from './events-partition.service.js';

@Module({
  imports: [PrismaModule],
  providers: [EventsPartitionService, EventsIngestService],
  exports: [EventsPartitionService, EventsIngestService],
})
export class EventsModule {}
