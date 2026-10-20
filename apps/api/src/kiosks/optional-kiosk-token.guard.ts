import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';

import { KioskTokenGuard, type KioskDeviceRequest } from './kiosk-token.guard.js';

export interface KioskTokenGuardLike {
  canActivate(context: ExecutionContext): Promise<boolean> | boolean;
}

@Injectable()
export class OptionalKioskTokenGuard implements CanActivate {
  constructor(
    @Inject(KioskTokenGuard)
    private readonly kioskTokenGuard: KioskTokenGuardLike,
  ) {}

  canActivate(context: ExecutionContext): Promise<boolean> | boolean {
    const request = context.switchToHttp().getRequest<KioskDeviceRequest>();
    const authorization = request.headers.authorization;
    if (authorization === undefined) {
      return true;
    }
    return this.kioskTokenGuard.canActivate(context);
  }
}
