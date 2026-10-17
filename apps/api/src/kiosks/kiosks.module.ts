import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { KiosksController } from './kiosks.controller.js';
import { KioskService } from './kiosks.service.js';

@Module({
  imports: [AuthModule],
  controllers: [KiosksController],
  providers: [KioskService],
  exports: [KioskService],
})
export class KiosksModule {}
