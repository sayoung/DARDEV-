import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { KiosksModule } from '../kiosks/kiosks.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EventsController } from './events.controller.js';
import { EventsIngestService } from './events-ingest.service.js';
import { EventsPartitionService } from './events-partition.service.js';
import { EventsRateLimitService } from './events-rate-limit.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

@Module({
  imports: [PrismaModule, KiosksModule, AuthModule],
  controllers: [EventsController, StatsController],
  providers: [
    EventsPartitionService,
    EventsIngestService,
    EventsRateLimitService,
    StatsService,
  ],
  exports: [
    EventsPartitionService,
    EventsIngestService,
    EventsRateLimitService,
  ],
})
export class EventsModule {}
