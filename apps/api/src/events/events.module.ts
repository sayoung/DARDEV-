import { Module } from '@nestjs/common';

import { KiosksModule } from '../kiosks/kiosks.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EventsController } from './events.controller.js';
import { EventsIngestService } from './events-ingest.service.js';
import { EventsPartitionService } from './events-partition.service.js';

@Module({
  imports: [PrismaModule, KiosksModule],
  controllers: [EventsController],
  providers: [EventsPartitionService, EventsIngestService],
  exports: [EventsPartitionService, EventsIngestService],
})
export class EventsModule {}
