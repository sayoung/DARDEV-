import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it, vi } from 'vitest';

import {
  OptionalKioskTokenGuard,
  type KioskTokenGuardLike,
} from './optional-kiosk-token.guard.js';

interface TestHeaders {
  authorization?: string;
  [key: string]: string | undefined;
}

interface TestKioskDevice {
  kioskId: string;
  hotelId: string;
}

interface TestRequest {
  headers: TestHeaders;
  kioskDevice?: TestKioskDevice;
}

const KIOSK_ID = '01990000-0000-7000-8000-000000000301';
const HOTEL_ID = '01990000-0000-7000-8000-000000000101';

describe('OptionalKioskTokenGuard', () => {
  it('sans en-tête Authorization : retourne true sans authentifier', async () => {
    const request: TestRequest = {
      headers: {},
    };
    const context: ExecutionContext = new ExecutionContextHost([request]);

    const canActivateMock = vi.fn().mockResolvedValue(true);
    const mockGuard: KioskTokenGuardLike = {
      canActivate: canActivateMock,
    };

    const guard = new OptionalKioskTokenGuard(mockGuard);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(canActivateMock).not.toHaveBeenCalled();
    expect(request.kioskDevice).toBeUndefined();
  });

  it('sans en-tête Authorization (valeur undefined explicite) : retourne true sans authentifier', async () => {
    const request: TestRequest = {
      headers: { authorization: undefined },
    };
    const context: ExecutionContext = new ExecutionContextHost([request]);

    const canActivateMock = vi.fn().mockResolvedValue(true);
    const mockGuard: KioskTokenGuardLike = {
      canActivate: canActivateMock,
    };

    const guard = new OptionalKioskTokenGuard(mockGuard);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(canActivateMock).not.toHaveBeenCalled();
    expect(request.kioskDevice).toBeUndefined();
  });

  it('avec en-tête : délègue à KioskTokenGuard et propage la réussite', async () => {
    const request: TestRequest = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const context: ExecutionContext = new ExecutionContextHost([request]);

    const canActivateMock = vi.fn((ctx: ExecutionContext): Promise<boolean> => {
      const req = ctx.switchToHttp().getRequest<TestRequest>();
      req.kioskDevice = { kioskId: KIOSK_ID, hotelId: HOTEL_ID };
      return Promise.resolve(true);
    });
    const mockGuard: KioskTokenGuardLike = {
      canActivate: canActivateMock,
    };

    const guard = new OptionalKioskTokenGuard(mockGuard);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(canActivateMock).toHaveBeenCalledWith(context);
    expect(request.kioskDevice).toEqual({ kioskId: KIOSK_ID, hotelId: HOTEL_ID });
  });

  it('avec en-tête : un jeton invalide donne 401 (UnauthorizedException)', async () => {
    const request: TestRequest = {
      headers: { authorization: 'Bearer invalid-token' },
    };
    const context: ExecutionContext = new ExecutionContextHost([request]);

    const canActivateMock = vi.fn((): Promise<boolean> => {
      return Promise.reject(new UnauthorizedException());
    });
    const mockGuard: KioskTokenGuardLike = {
      canActivate: canActivateMock,
    };

    const guard = new OptionalKioskTokenGuard(mockGuard);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(canActivateMock).toHaveBeenCalledWith(context);
    expect(request.kioskDevice).toBeUndefined();
  });

  it('avec en-tête : propage ForbiddenException si le kiosque est désactivé', async () => {
    const request: TestRequest = {
      headers: { authorization: 'Bearer disabled-kiosk-token' },
    };
    const context: ExecutionContext = new ExecutionContextHost([request]);

    const canActivateMock = vi.fn((): Promise<boolean> => {
      return Promise.reject(new ForbiddenException());
    });
    const mockGuard: KioskTokenGuardLike = {
      canActivate: canActivateMock,
    };

    const guard = new OptionalKioskTokenGuard(mockGuard);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(canActivateMock).toHaveBeenCalledWith(context);
  });
});
