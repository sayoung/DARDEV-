import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { KioskDeviceController } from './kiosk-device.controller.js';
import { KioskTokenGuard } from './kiosk-token.guard.js';
import { KiosksController } from './kiosks.controller.js';
import { KioskService } from './kiosks.service.js';
import { OptionalKioskTokenGuard } from './optional-kiosk-token.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [KiosksController, KioskDeviceController],
  providers: [KioskService, KioskTokenGuard, OptionalKioskTokenGuard],
  exports: [KioskService, KioskTokenGuard, OptionalKioskTokenGuard],
})
export class KiosksModule {}
