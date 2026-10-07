import { Module } from '@nestjs/common';
import { PublicPreviewController, PublicShareController, PublicToursController } from './public-tours.controller.js';
import { ViewerService } from './viewer.service.js';

@Module({
  controllers: [PublicToursController, PublicShareController, PublicPreviewController],
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}
