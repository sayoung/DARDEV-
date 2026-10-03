import { Module } from '@nestjs/common';
import { PublicToursController } from './public-tours.controller.js';
import { ViewerService } from './viewer.service.js';

@Module({
  controllers: [PublicToursController],
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}
