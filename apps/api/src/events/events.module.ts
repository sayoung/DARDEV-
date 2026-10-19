import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { EventsPartitionService } from './events-partition.service.js';

@Module({
  imports: [PrismaModule],
  providers: [EventsPartitionService],
  exports: [EventsPartitionService],
})
export class EventsModule {}
