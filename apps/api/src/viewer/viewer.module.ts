import { Module } from '@nestjs/common';
import { ViewerService } from './viewer.service.js';

@Module({
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}
