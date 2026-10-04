import { Module } from '@nestjs/common';
import { PublicShareController, PublicToursController } from './public-tours.controller.js';
import { ViewerService } from './viewer.service.js';

@Module({
  controllers: [PublicToursController, PublicShareController],
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}
