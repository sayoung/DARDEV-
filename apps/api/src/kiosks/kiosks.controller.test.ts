import 'reflect-metadata';

import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Role, type EnrollmentCodeResponse, type Kiosk, type KioskCreate, type KioskUpdate, type Principal } from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { KiosksController } from './kiosks.controller.js';
import { KioskService, type KioskPrismaClient } from './kiosks.service.js';

const KIOSK_ID = '01990000-0000-7000-8000-000000000101';
const HOTEL_ID = '01990000-0000-7000-8000-000000000102';
const INVALID_ID = 'not-a-valid-uuidv7';

const principal: Principal = {
  userId: '01990000-0000-7000-8000-000000000201',
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_ID],
};

const sampleKiosk: Kiosk = {
  id: KIOSK_ID,
  label: 'Hall principal',
  hotelId: HOTEL_ID,
  deviceType: 'TOUCH_SCREEN',
  status: 'PENDING',
  connectionState: 'PENDING',
  lastHeartbeatAt: null,
  appVersion: null,
  syncedManifestVersion: null,
  storageFreeMb: null,
  idleTimeoutSeconds: 90,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const enrollmentCode: EnrollmentCodeResponse = {
  code: 'ABCD1234',
  expiresAt: '2026-01-01T01:00:00.000Z',
};

class RecordingKioskService extends KioskService {
  public listCalls: Principal[] = [];
  public getCalls: { principal: Principal; id: string }[] = [];
  public createCalls: { principal: Principal; input: KioskCreate }[] = [];
  public updateCalls: { principal: Principal; id: string; input: KioskUpdate }[] = [];
  public removeCalls: { principal: Principal; id: string }[] = [];
  public enrollmentCalls: { principal: Principal; id: string }[] = [];
  public disableCalls: { principal: Principal; id: string }[] = [];

  constructor() {
    super({} as KioskPrismaClient);
  }

  override list(who: Principal): Promise<Kiosk[]> {
    this.listCalls.push(who);
    return Promise.resolve([sampleKiosk]);
  }

  override get(who: Principal, id: string): Promise<Kiosk> {
    this.getCalls.push({ principal: who, id });
    return Promise.resolve(sampleKiosk);
  }

  override create(who: Principal, input: KioskCreate): Promise<Kiosk> {
    this.createCalls.push({ principal: who, input });
    return Promise.resolve(sampleKiosk);
  }

  override update(who: Principal, id: string, input: KioskUpdate): Promise<Kiosk> {
    this.updateCalls.push({ principal: who, id, input });
    return Promise.resolve(sampleKiosk);
  }

  override remove(who: Principal, id: string): Promise<void> {
    this.removeCalls.push({ principal: who, id });
    return Promise.resolve();
  }

  override issueEnrollmentCode(who: Principal, id: string): Promise<EnrollmentCodeResponse> {
    this.enrollmentCalls.push({ principal: who, id });
    return Promise.resolve(enrollmentCode);
  }

  override disable(who: Principal, id: string): Promise<Kiosk> {
    this.disableCalls.push({ principal: who, id });
    return Promise.resolve({ ...sampleKiosk, status: 'DISABLED', connectionState: 'DISABLED' });
  }
}

function makeRequest(who: Principal = principal): SessionRequest {
  return { method: 'GET', headers: {}, principal: who };
}

function methodHandler(name: string): object {
  const value: unknown = Object.getOwnPropertyDescriptor(KiosksController.prototype, name)?.value;
  if (typeof value !== 'function') throw new Error(`Méthode absente : ${name}`);
  return value;
}

describe('KiosksController', () => {
  let service: RecordingKioskService;
  let controller: KiosksController;

  beforeEach(() => {
    service = new RecordingKioskService();
    controller = new KiosksController(service);
  });

  it('applique SessionGuard et CsrfGuard à toutes les routes', () => {
    const guards: unknown = Reflect.getMetadata('__guards__', KiosksController);
    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(CsrfGuard);
  });

  it('fixe les statuts HTTP de création, suppression et opérations POST', () => {
    expect(Reflect.getMetadata('__httpCode__', methodHandler('create'))).toBe(HttpStatus.CREATED);
    expect(Reflect.getMetadata('__httpCode__', methodHandler('remove'))).toBe(HttpStatus.NO_CONTENT);
    expect(Reflect.getMetadata('__httpCode__', methodHandler('issueEnrollmentCode'))).toBe(HttpStatus.OK);
    expect(Reflect.getMetadata('__httpCode__', methodHandler('disable'))).toBe(HttpStatus.OK);
  });

  it('transmet le principal à toutes les opérations et les entrées validées', async () => {
    const req = makeRequest();
    const createInput = { label: 'Hall principal', hotelId: HOTEL_ID, deviceType: 'TOUCH_SCREEN' };
    const updateInput = { label: 'Hall rénové' };

    await expect(controller.list(req)).resolves.toEqual([sampleKiosk]);
    await expect(controller.create(req, createInput)).resolves.toEqual(sampleKiosk);
    await expect(controller.get(req, KIOSK_ID)).resolves.toEqual(sampleKiosk);
    await expect(controller.update(req, KIOSK_ID, updateInput)).resolves.toEqual(sampleKiosk);
    await expect(controller.remove(req, KIOSK_ID)).resolves.toBeUndefined();
    await expect(controller.issueEnrollmentCode(req, KIOSK_ID)).resolves.toEqual(enrollmentCode);
    await expect(controller.disable(req, KIOSK_ID)).resolves.toMatchObject({ status: 'DISABLED' });

    expect(service.listCalls).toEqual([principal]);
    expect(service.createCalls).toEqual([{ principal, input: createInput }]);
    expect(service.getCalls).toEqual([{ principal, id: KIOSK_ID }]);
    expect(service.updateCalls).toEqual([{ principal, id: KIOSK_ID, input: updateInput }]);
    expect(service.removeCalls).toEqual([{ principal, id: KIOSK_ID }]);
    expect(service.enrollmentCalls).toEqual([{ principal, id: KIOSK_ID }]);
    expect(service.disableCalls).toEqual([{ principal, id: KIOSK_ID }]);
  });

  it('refuse les corps invalides avec 400 et sans appeler le service', () => {
    expect(() => controller.create(makeRequest(), { label: '', hotelId: 'bad', deviceType: 'OTHER' }))
      .toThrow(BadRequestException);
    expect(() => controller.update(makeRequest(), KIOSK_ID, { idleTimeoutSeconds: 1 }))
      .toThrow(BadRequestException);
    expect(service.createCalls).toHaveLength(0);
    expect(service.updateCalls).toHaveLength(0);
  });

  it('valide les IDs de ressource avant d’appeler le service', async () => {
    expect(() => controller.get(makeRequest(), INVALID_ID)).toThrow(BadRequestException);
    expect(() => controller.update(makeRequest(), INVALID_ID, {})).toThrow(BadRequestException);
    await expect(controller.remove(makeRequest(), INVALID_ID)).rejects.toThrow(BadRequestException);
    expect(() => controller.issueEnrollmentCode(makeRequest(), INVALID_ID)).toThrow(BadRequestException);
    expect(() => controller.disable(makeRequest(), INVALID_ID)).toThrow(BadRequestException);
    expect(service.getCalls).toHaveLength(0);
    expect(service.updateCalls).toHaveLength(0);
    expect(service.removeCalls).toHaveLength(0);
    expect(service.enrollmentCalls).toHaveLength(0);
    expect(service.disableCalls).toHaveLength(0);
  });
});
