import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { HotelManagersService } from './hotel-managers.service.js';
import { HotelsController } from './hotels.controller.js';
import { HotelsService } from './hotels.service.js';
import { SelectionService } from './selection.service.js';

@Module({
  imports: [AuthModule],
  controllers: [HotelsController],
  providers: [HotelsService, HotelManagersService, SelectionService],
  exports: [HotelsService, HotelManagersService, SelectionService],
})
export class HotelsModule {}
