import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { KIOSK_DISABLED, KIOSK_DISABLED_MESSAGE } from './kiosks.errors.js';
import { KioskTokenGuard, type KioskDeviceRequest } from './kiosk-token.guard.js';

const KIOSK_ID = '01990000-0000-7000-8000-000000000301';
const HOTEL_ID = '01990000-0000-7000-8000-000000000101';

function contextFor(request: KioskDeviceRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function harness(
  authorization: string | string[] | undefined,
  result: { id: string; hotelId: string; status: 'ACTIVE' | 'DISABLED' } | null,
) {
  const request = { headers: { authorization } } as unknown as KioskDeviceRequest;
  const authenticateDevice = vi.fn().mockResolvedValue(result);
  const guard = new KioskTokenGuard({ authenticateDevice } as never);
  return { guard, request, authenticateDevice };
}

describe('KioskTokenGuard', () => {
  it('authenticates a valid bearer token and attaches kiosk and hotel ids', async () => {
    const { guard, request, authenticateDevice } = harness('Bearer device-token', {
      id: KIOSK_ID,
      hotelId: HOTEL_ID,
      status: 'ACTIVE',
    });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(authenticateDevice).toHaveBeenCalledWith('device-token');
    expect(request.kioskDevice).toEqual({ kioskId: KIOSK_ID, hotelId: HOTEL_ID });
  });

  it('rejects a missing token with an unauthorized error without looking it up', async () => {
    const { guard, request, authenticateDevice } = harness(undefined, null);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticateDevice).not.toHaveBeenCalled();
  });

  it('rejects an unknown token with the same generic unauthorized error', async () => {
    const missing = harness(undefined, null);
    const unknown = harness('Bearer unknown-token', null);

    const errors = await Promise.all([
      missing.guard.canActivate(contextFor(missing.request)).catch((error: unknown) => error),
      unknown.guard.canActivate(contextFor(unknown.request)).catch((error: unknown) => error),
    ]);

    expect(errors[0]).toBeInstanceOf(UnauthorizedException);
    expect(errors[1]).toBeInstanceOf(UnauthorizedException);
    expect((errors[0] as UnauthorizedException).getResponse()).toEqual(
      (errors[1] as UnauthorizedException).getResponse(),
    );
  });

  it('rejects a disabled kiosk with KIOSK_DISABLED', async () => {
    const { guard, request } = harness('Bearer device-token', {
      id: KIOSK_ID,
      hotelId: HOTEL_ID,
      status: 'DISABLED',
    });

    await expect(guard.canActivate(contextFor(request))).rejects.toMatchObject({
      response: { error: { code: KIOSK_DISABLED, message: KIOSK_DISABLED_MESSAGE } },
      status: 403,
    });
    expect(request.kioskDevice).toBeUndefined();
  });
});
