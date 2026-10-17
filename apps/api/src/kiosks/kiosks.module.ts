import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { KioskDeviceController } from './kiosk-device.controller.js';
import { KioskTokenGuard } from './kiosk-token.guard.js';
import { KiosksController } from './kiosks.controller.js';
import { KioskService } from './kiosks.service.js';

@Module({
  imports: [AuthModule],
  controllers: [KiosksController, KioskDeviceController],
  providers: [KioskService, KioskTokenGuard],
  exports: [KioskService],
})
export class KiosksModule {}
