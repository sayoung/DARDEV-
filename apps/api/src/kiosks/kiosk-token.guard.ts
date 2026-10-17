import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { KIOSK_DISABLED, KIOSK_DISABLED_MESSAGE } from './kiosks.errors.js';
import { KioskService } from './kiosks.service.js';

export interface KioskDevice {
  kioskId: string;
  hotelId: string;
}

export type KioskDeviceRequest = FastifyRequest & { kioskDevice?: KioskDevice };

@Injectable()
export class KioskTokenGuard implements CanActivate {
  constructor(@Inject(KioskService) private readonly kiosks: KioskService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KioskDeviceRequest>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string'
      ? /^Bearer\s+(.+)$/i.exec(authorization.trim())
      : null;
    const token = match?.[1];
    if (!token) {
      throw new UnauthorizedException();
    }

    const kiosk = await this.kiosks.authenticateDevice(token);
    if (kiosk === null) {
      throw new UnauthorizedException();
    }
    if (kiosk.status === 'DISABLED') {
      throw new ForbiddenException({
        error: { code: KIOSK_DISABLED, message: KIOSK_DISABLED_MESSAGE },
      });
    }

    request.kioskDevice = { kioskId: kiosk.id, hotelId: kiosk.hotelId };
    return true;
  }
}
