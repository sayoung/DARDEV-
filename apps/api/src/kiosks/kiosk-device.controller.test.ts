import 'reflect-metadata';

import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { KioskEnrollRequest, KioskEnrollResponse } from '@xplor/shared';
import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionGuard } from '../auth/session.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { KIOSK_ENROLLMENT_INVALID } from './kiosks.errors.js';
import { KioskDeviceController } from './kiosk-device.controller.js';
import { KioskService } from './kiosks.service.js';

const validRequest: KioskEnrollRequest = {
  code: 'AB12CD34',
  deviceInfo: { userAgent: 'Xplor Kiosk' },
};

const response: KioskEnrollResponse = {
  kioskId: '01990000-0000-7000-8000-000000000101',
  token: 'device-token',
};

function enrollHandler(): object {
  const handler: unknown = Object.getOwnPropertyDescriptor(KioskDeviceController.prototype, 'enroll')?.value;
  if (typeof handler !== 'function') throw new Error('Méthode absente : enroll');
  return handler;
}

describe('KioskDeviceController', () => {
  const enrollMock = vi.fn<KioskService['enroll']>();
  let controller: KioskDeviceController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new KioskDeviceController({ enroll: enrollMock } as unknown as KioskService);
  });

  it('valide le corps puis transmet le corps et l’adresse IP au service', async () => {
    enrollMock.mockResolvedValue(response);
    const request = { ip: '203.0.113.8' } as FastifyRequest;

    await expect(controller.enroll(validRequest, request)).resolves.toEqual(response);
    expect(enrollMock).toHaveBeenCalledWith(validRequest, '203.0.113.8');
  });

  it('rejette un code de 7 caractères avec 400 sans appeler le service', () => {
    expect(() => controller.enroll({ ...validRequest, code: 'AB12CD3' }, { ip: '192.0.2.1' } as FastifyRequest))
      .toThrow(BadRequestException);
    expect(enrollMock).not.toHaveBeenCalled();
  });

  it('propage l’erreur de code invalide avec son statut 401', async () => {
    const error = new HttpException(
      { error: { code: KIOSK_ENROLLMENT_INVALID } },
      HttpStatus.UNAUTHORIZED,
    );
    enrollMock.mockRejectedValue(error);

    await expect(controller.enroll(validRequest, { ip: '192.0.2.1' } as FastifyRequest)).rejects.toBe(error);
    expect(enrollMock).toHaveBeenCalledWith(validRequest, '192.0.2.1');
  });

  it('est public et limité à 10 requêtes par minute', () => {
    const handler = enrollHandler();
    const rawGuards: unknown = Reflect.getMetadata('__guards__', handler);
    const guards = Array.isArray(rawGuards) ? rawGuards : [];
    expect(guards).toContain(ThrottlerGuard);
    expect(guards).not.toContain(SessionGuard);
    expect(guards).not.toContain(CsrfGuard);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(10);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(HttpStatus.OK);
  });
});
