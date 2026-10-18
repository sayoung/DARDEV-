import 'reflect-metadata';

import { BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type {
  KioskEnrollRequest,
  KioskEnrollResponse,
  KioskHeartbeatRequest,
  KioskHeartbeatResponse,
  KioskManifest,
} from '@xplor/shared';
import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionGuard } from '../auth/session.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { KIOSK_ENROLLMENT_INVALID } from './kiosks.errors.js';
import { KioskDeviceController } from './kiosk-device.controller.js';
import { KioskTokenGuard, type KioskDevice, type KioskDeviceRequest } from './kiosk-token.guard.js';
import { KioskService } from './kiosks.service.js';

const validRequest: KioskEnrollRequest = {
  code: 'AB12CD34',
  deviceInfo: { userAgent: 'Xplor Kiosk' },
};

const response: KioskEnrollResponse = {
  kioskId: '01990000-0000-7000-8000-000000000101',
  token: 'device-token',
};

const device: KioskDevice = {
  kioskId: '01990000-0000-7000-8000-000000000101',
  hotelId: '01990000-0000-7000-8000-000000000102',
};

const manifest: KioskManifest = {
  manifestVersion: 's1-tabc123',
  kiosk: {
    id: device.kioskId,
    label: 'Hall principal',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_AND_HEADSET',
  },
  hotel: {
    id: device.hotelId,
    name: 'Hôtel Exemple',
    logoUrl: null,
    brandColor: '#8A5A2B',
    languages: ['fr'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: { featuredTourId: null, attractTourIds: [], tours: [] },
  categories: [],
};

const heartbeatRequest: KioskHeartbeatRequest = {
  appVersion: '1.2.3',
  syncedManifestVersion: 's1-tabc123',
  storageFreeMb: 1024,
  recentErrors: [],
};

const heartbeatResponse: KioskHeartbeatResponse = {
  forceSync: false,
  serverTime: '2026-10-17T12:00:00.000Z',
};

function enrollHandler(): object {
  const handler: unknown = Object.getOwnPropertyDescriptor(KioskDeviceController.prototype, 'enroll')?.value;
  if (typeof handler !== 'function') throw new Error('Méthode absente : enroll');
  return handler;
}

describe('KioskDeviceController', () => {
  const enrollMock = vi.fn<KioskService['enroll']>();
  const getManifestMock = vi.fn<KioskService['getManifest']>();
  const heartbeatMock = vi.fn<KioskService['heartbeat']>();
  const verifyMaintenancePinMock = vi.fn<KioskService['verifyMaintenancePin']>();
  let controller: KioskDeviceController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new KioskDeviceController({
      enroll: enrollMock,
      getManifest: getManifestMock,
      heartbeat: heartbeatMock,
      verifyMaintenancePin: verifyMaintenancePinMock,
    } as unknown as KioskService);
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

  it('protège le manifeste par jeton et transmet l’appareil authentifié au service', async () => {
    getManifestMock.mockResolvedValue(manifest);
    const request = { kioskDevice: device } as KioskDeviceRequest;
    const handler: unknown = Object.getOwnPropertyDescriptor(KioskDeviceController.prototype, 'manifest')?.value;
    if (typeof handler !== 'function') throw new Error('Méthode absente : manifest');
    const rawGuards: unknown = Reflect.getMetadata('__guards__', handler);

    await expect(controller.manifest(request)).resolves.toEqual(manifest);
    expect(getManifestMock).toHaveBeenCalledWith(device);
    expect(rawGuards).toContain(KioskTokenGuard);
  });

  it('refuse le manifeste si le guard n’a pas attaché l’appareil', () => {
    expect(() => controller.manifest({} as KioskDeviceRequest)).toThrow(UnauthorizedException);
    expect(getManifestMock).not.toHaveBeenCalled();
  });

  it('valide le heartbeat puis transmet l’appareil, le corps et l’adresse IP au service', async () => {
    heartbeatMock.mockResolvedValue(heartbeatResponse);
    const request = { kioskDevice: device, ip: '203.0.113.9' } as KioskDeviceRequest;

    await expect(controller.heartbeat(heartbeatRequest, request)).resolves.toEqual(heartbeatResponse);
    expect(heartbeatMock).toHaveBeenCalledWith(device, heartbeatRequest, '203.0.113.9');
  });

  it('rejette un corps heartbeat invalide avec 400 sans appeler le service', () => {
    expect(() => controller.heartbeat({ ...heartbeatRequest, storageFreeMb: -1 }, {
      kioskDevice: device,
      ip: '192.0.2.1',
    } as KioskDeviceRequest)).toThrow(BadRequestException);
    expect(heartbeatMock).not.toHaveBeenCalled();
  });

  it('refuse le heartbeat si le guard n’a pas attaché l’appareil', () => {
    expect(() => controller.heartbeat(heartbeatRequest, { ip: '192.0.2.1' } as KioskDeviceRequest))
      .toThrow(UnauthorizedException);
    expect(heartbeatMock).not.toHaveBeenCalled();
  });

  it('protège le heartbeat par jeton et le limite à 30 requêtes par minute', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(KioskDeviceController.prototype, 'heartbeat')?.value;
    if (typeof handler !== 'function') throw new Error('Méthode absente : heartbeat');
    const rawGuards: unknown = Reflect.getMetadata('__guards__', handler);
    const guards = Array.isArray(rawGuards) ? rawGuards : [];

    expect(guards).toContain(KioskTokenGuard);
    expect(guards).toContain(ThrottlerGuard);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(HttpStatus.OK);
  });

  it('appelle KioskService.verifyMaintenancePin et renvoie { valid: true } en cas de code PIN correct', async () => {
    verifyMaintenancePinMock.mockResolvedValue(true);
    const request = { kioskDevice: device } as KioskDeviceRequest;

    const result = await controller.verifyMaintenancePin({ pin: '1234' }, request);

    expect(result).toEqual({ valid: true });
    expect(verifyMaintenancePinMock).toHaveBeenCalledWith(device, '1234');
  });

  it('appelle KioskService.verifyMaintenancePin et renvoie { valid: false } en cas de code PIN erroné', async () => {
    verifyMaintenancePinMock.mockResolvedValue(false);
    const request = { kioskDevice: device } as KioskDeviceRequest;

    const result = await controller.verifyMaintenancePin({ pin: '9999' }, request);

    expect(result).toEqual({ valid: false });
    expect(verifyMaintenancePinMock).toHaveBeenCalledWith(device, '9999');
  });

  it.each([
    ['PIN non numérique', { pin: 'abcd' }],
    ['PIN trop court (3 chiffres)', { pin: '123' }],
    ['PIN trop long (13 chiffres)', { pin: '1234567890123' }],
    ['PIN vide', { pin: '' }],
    ['propriété pin manquante', {}],
    ['type non chaîne', { pin: 1234 }],
  ])('rejette un corps invalide (%s) avec 400 sans appeler le service', async (_label, invalidBody) => {
    const request = { kioskDevice: device } as KioskDeviceRequest;

    await expect(controller.verifyMaintenancePin(invalidBody, request)).rejects.toThrow(BadRequestException);
    expect(verifyMaintenancePinMock).not.toHaveBeenCalled();
  });

  it('refuse la vérification avec 401 si le guard n’a pas attaché l’appareil (sans jeton)', async () => {
    const request = {} as KioskDeviceRequest;

    await expect(controller.verifyMaintenancePin({ pin: '1234' }, request)).rejects.toThrow(UnauthorizedException);
    expect(verifyMaintenancePinMock).not.toHaveBeenCalled();
  });

  it('protège verifyMaintenancePin par jeton et le limite à 5 requêtes par minute', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      KioskDeviceController.prototype,
      'verifyMaintenancePin',
    )?.value;
    if (typeof handler !== 'function') throw new Error('Méthode absente : verifyMaintenancePin');
    const rawGuards: unknown = Reflect.getMetadata('__guards__', handler);
    const guards = Array.isArray(rawGuards) ? rawGuards : [];

    expect(guards).toContain(KioskTokenGuard);
    expect(guards).toContain(ThrottlerGuard);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(HttpStatus.OK);
  });
});
