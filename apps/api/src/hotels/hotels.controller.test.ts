import 'reflect-metadata';

import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ContractType,
  HotelStars,
  Role,
  type HotelCreate,
  type HotelManager,
  type HotelResponse,
  type HotelUpdate,
  type Principal,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  HotelManagersService,
  type HotelManagersPrismaClient,
} from './hotel-managers.service.js';
import { HotelsController } from './hotels.controller.js';
import {
  HotelsService,
  type HotelPrismaClient,
} from './hotels.service.js';

const HOTEL_ID = '01990000-0000-7000-8000-000000000101';
const CITY_ID = '01990000-0000-7000-8000-000000000001';
const INVALID_UUID = 'not-a-valid-uuidv7';

const sampleHotelResponse: HotelResponse = {
  id: HOTEL_ID,
  name: 'Hôtel Oudayas Rabat',
  stars: HotelStars.FIVE,
  cityId: CITY_ID,
  address: '1 avenue des Oudayas, Rabat',
  phone: '+212537000001',
  email: 'oudayas@xplor.local',
  logoAssetId: null,
  brandColor: '#6958A5',
  languages: ['fr'],
  contractType: ContractType.RENTAL,
  contractStart: '2026-01-01T00:00:00.000Z',
  contractEnd: '2027-01-01T00:00:00.000Z',
  active: true,
  hasMaintenancePin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const stubPrismaClient: HotelPrismaClient = {
  hotel: {
    findMany: () => Promise.resolve([]),
    findFirst: () => Promise.resolve(null),
    create: () => Promise.reject(new Error('unused in controller test')),
    update: () => Promise.reject(new Error('unused in controller test')),
  },
  city: {
    findUnique: () => Promise.resolve(null),
  },
  asset: {
    findUnique: () => Promise.resolve(null),
  },
};

class RecordingHotelsService extends HotelsService {
  public listCalls: Principal[] = [];
  public getCalls: { principal: Principal; id: string }[] = [];
  public createCalls: HotelCreate[] = [];
  public updateCalls: { id: string; input: HotelUpdate }[] = [];
  public removeCalls: string[] = [];

  constructor() {
    super(stubPrismaClient);
  }

  override list(principal: Principal): Promise<HotelResponse[]> {
    this.listCalls.push(principal);
    return Promise.resolve([sampleHotelResponse]);
  }

  override get(principal: Principal, id: string): Promise<HotelResponse> {
    this.getCalls.push({ principal, id });
    return Promise.resolve(sampleHotelResponse);
  }

  override create(input: HotelCreate): Promise<HotelResponse> {
    this.createCalls.push(input);
    return Promise.resolve(sampleHotelResponse);
  }

  override update(id: string, input: HotelUpdate): Promise<HotelResponse> {
    this.updateCalls.push({ id, input });
    return Promise.resolve(sampleHotelResponse);
  }

  override remove(id: string): Promise<void> {
    this.removeCalls.push(id);
    return Promise.resolve();
  }
}

const sampleManager: HotelManager = {
  id: '01990000-0000-7000-8000-000000000301',
  email: 'karim@xplor.local',
  name: 'Bennani Karim',
};

const stubManagersPrismaClient: HotelManagersPrismaClient = {
  hotel: {
    findFirst: () => Promise.resolve(null),
  },
  user: {
    findMany: () => Promise.resolve([]),
  },
  userHotel: {
    findMany: () => Promise.resolve([]),
    deleteMany: () => Promise.resolve({ count: 0 }),
    createMany: () => Promise.resolve({ count: 0 }),
  },
  $transaction: () => Promise.reject(new Error('unused in controller test')),
};

class RecordingHotelManagersService extends HotelManagersService {
  public listCalls: { principal: Principal; hotelId: string }[] = [];
  public replaceCalls: { hotelId: string; userIds: string[] }[] = [];

  constructor() {
    super(stubManagersPrismaClient);
  }

  override list(principal: Principal, hotelId: string): Promise<HotelManager[]> {
    this.listCalls.push({ principal, hotelId });
    return Promise.resolve([sampleManager]);
  }

  override replace(hotelId: string, userIds: string[]): Promise<HotelManager[]> {
    this.replaceCalls.push({ hotelId, userIds });
    return Promise.resolve([sampleManager]);
  }
}

const adminPrincipal: Principal = {
  userId: '01990000-0000-7000-8000-000000000201',
  role: Role.ADMIN,
  hotelIds: [],
};

const managerPrincipal: Principal = {
  userId: '01990000-0000-7000-8000-000000000202',
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_ID],
};

const editorPrincipal: Principal = {
  userId: '01990000-0000-7000-8000-000000000203',
  role: Role.EDITOR,
  hotelIds: [],
};

const partnerPrincipal: Principal = {
  userId: '01990000-0000-7000-8000-000000000204',
  role: Role.PARTNER,
  hotelIds: [HOTEL_ID],
};

function makeRequest(principal?: Principal): SessionRequest {
  return {
    method: 'GET',
    headers: {},
    principal,
  };
}

const validCreatePayload = {
  name: 'Hôtel Oudayas Rabat',
  stars: HotelStars.FIVE,
  cityId: CITY_ID,
  address: '1 avenue des Oudayas, Rabat',
  phone: '+212537000001',
  email: 'oudayas@xplor.local',
  brandColor: '#6958A5',
  languages: ['fr'],
  contractType: ContractType.RENTAL,
  contractStart: '2026-01-01T00:00:00.000Z',
  contractEnd: '2027-01-01T00:00:00.000Z',
  active: true,
};

const validUpdatePayload = {
  name: 'Hôtel Oudayas Rabat Rénové',
};

function methodHandler(name: 'create' | 'remove'): object {
  const value: unknown = Object.getOwnPropertyDescriptor(HotelsController.prototype, name)?.value;
  if (typeof value !== 'function') {
    throw new Error(`Méthode absente : ${name}`);
  }
  return value;
}

describe('HotelsController', () => {
  let service: RecordingHotelsService;
  let managersService: RecordingHotelManagersService;
  let controller: HotelsController;

  beforeEach(() => {
    service = new RecordingHotelsService();
    managersService = new RecordingHotelManagersService();
    controller = new HotelsController(service, managersService);
  });

  describe('Métadonnées et gardes', () => {
    it('applique SessionGuard et CsrfGuard sur le contrôleur', () => {
      const guards: unknown = Reflect.getMetadata('__guards__', HotelsController);
      expect(Array.isArray(guards)).toBe(true);
      if (Array.isArray(guards)) {
        expect(guards).toContain(SessionGuard);
        expect(guards).toContain(CsrfGuard);
      }
    });

    it('définit le code HTTP 201 Created pour create', () => {
      const httpCode: unknown = Reflect.getMetadata(
        '__httpCode__',
        methodHandler('create'),
      );
      expect(httpCode).toBe(HttpStatus.CREATED);
    });

    it('définit le code HTTP 204 No Content pour remove', () => {
      const httpCode: unknown = Reflect.getMetadata(
        '__httpCode__',
        methodHandler('remove'),
      );
      expect(httpCode).toBe(HttpStatus.NO_CONTENT);
    });
  });

  describe('Rôle ADMIN : toutes les opérations sont autorisées', () => {
    it('GET list : appelle le service avec le principal ADMIN et renvoie la liste', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.list(req);

      expect(result).toEqual([sampleHotelResponse]);
      expect(service.listCalls).toEqual([adminPrincipal]);
    });

    it('GET :id : appelle le service avec le principal ADMIN et l’ID parsé', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.get(req, HOTEL_ID);

      expect(result).toEqual(sampleHotelResponse);
      expect(service.getCalls).toEqual([{ principal: adminPrincipal, id: HOTEL_ID }]);
    });

    it('POST : appelle le service create avec le corps validé', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.create(req, validCreatePayload);

      expect(result).toEqual(sampleHotelResponse);
      expect(service.createCalls).toHaveLength(1);
      const called = service.createCalls[0];
      expect(called?.name).toBe('Hôtel Oudayas Rabat');
      expect(called?.cityId).toBe(CITY_ID);
    });

    it('PATCH :id : appelle le service update avec l’ID et le corps validés', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.update(req, HOTEL_ID, validUpdatePayload);

      expect(result).toEqual(sampleHotelResponse);
      expect(service.updateCalls).toHaveLength(1);
      const called = service.updateCalls[0];
      expect(called?.id).toBe(HOTEL_ID);
      expect(called?.input.name).toBe('Hôtel Oudayas Rabat Rénové');
    });

    it('DELETE :id : appelle le service remove avec l’ID parsé', async () => {
      const req = makeRequest(adminPrincipal);
      await controller.remove(req, HOTEL_ID);

      expect(service.removeCalls).toEqual([HOTEL_ID]);
    });

    it('GET :id/managers : appelle le service avec le principal ADMIN et l’ID parsé', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.listManagers(req, HOTEL_ID);

      expect(result).toEqual({ managers: [sampleManager] });
      expect(managersService.listCalls).toEqual([{ principal: adminPrincipal, hotelId: HOTEL_ID }]);
    });

    it('PUT :id/managers : appelle le service replace avec l’ID et le corps validés', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.replaceManagers(req, HOTEL_ID, {
        userIds: [sampleManager.id],
      });

      expect(result).toEqual({ managers: [sampleManager] });
      expect(managersService.replaceCalls).toHaveLength(1);
      const called = managersService.replaceCalls[0];
      expect(called?.hotelId).toBe(HOTEL_ID);
      expect(called?.userIds).toEqual([sampleManager.id]);
    });

    it('PUT :id/managers : accepte un tableau vide de gestionnaires', async () => {
      const req = makeRequest(adminPrincipal);
      const result = await controller.replaceManagers(req, HOTEL_ID, {
        userIds: [],
      });

      expect(result).toEqual({ managers: [sampleManager] });
      expect(managersService.replaceCalls).toHaveLength(1);
      const called = managersService.replaceCalls[0];
      expect(called?.hotelId).toBe(HOTEL_ID);
      expect(called?.userIds).toEqual([]);
    });
  });

  describe('Rôle GESTIONNAIRE : lecture autorisée, écriture interdite (403)', () => {
    it('GET list : autorisé, appelle le service avec le principal gestionnaire', async () => {
      const req = makeRequest(managerPrincipal);
      const result = await controller.list(req);

      expect(result).toEqual([sampleHotelResponse]);
      expect(service.listCalls).toEqual([managerPrincipal]);
    });

    it('GET :id : autorisé, appelle le service avec le principal gestionnaire', async () => {
      const req = makeRequest(managerPrincipal);
      const result = await controller.get(req, HOTEL_ID);

      expect(result).toEqual(sampleHotelResponse);
      expect(service.getCalls).toEqual([{ principal: managerPrincipal, id: HOTEL_ID }]);
    });

    it('POST : refuse avec 403 ForbiddenException et n’appelle pas le service', () => {
      const req = makeRequest(managerPrincipal);

      expect(() => controller.create(req, validCreatePayload)).toThrow(ForbiddenException);
      expect(service.createCalls).toHaveLength(0);
    });

    it('PATCH :id : refuse avec 403 ForbiddenException et n’appelle pas le service', () => {
      const req = makeRequest(managerPrincipal);

      expect(() => controller.update(req, HOTEL_ID, validUpdatePayload)).toThrow(ForbiddenException);
      expect(service.updateCalls).toHaveLength(0);
    });

    it('DELETE :id : refuse avec 403 ForbiddenException et n’appelle pas le service', async () => {
      const req = makeRequest(managerPrincipal);

      await expect(controller.remove(req, HOTEL_ID)).rejects.toThrow(ForbiddenException);
      expect(service.removeCalls).toHaveLength(0);
    });

    it('GET :id/managers : autorisé, appelle le service avec le principal gestionnaire', async () => {
      const req = makeRequest(managerPrincipal);
      const result = await controller.listManagers(req, HOTEL_ID);

      expect(result).toEqual({ managers: [sampleManager] });
      expect(managersService.listCalls).toEqual([{ principal: managerPrincipal, hotelId: HOTEL_ID }]);
    });

    it('PUT :id/managers : refuse avec 403 ForbiddenException et n’appelle pas le service', async () => {
      const req = makeRequest(managerPrincipal);

      await expect(
        controller.replaceManagers(req, HOTEL_ID, { userIds: [sampleManager.id] }),
      ).rejects.toThrow(ForbiddenException);
      expect(managersService.replaceCalls).toHaveLength(0);
    });
  });

  describe('Autres rôles : écriture refusée (403)', () => {
    it('EDITOR : 403 sur POST, PATCH, DELETE et PUT managers', async () => {
      const req = makeRequest(editorPrincipal);

      expect(() => controller.create(req, validCreatePayload)).toThrow(ForbiddenException);
      expect(() => controller.update(req, HOTEL_ID, validUpdatePayload)).toThrow(ForbiddenException);
      await expect(controller.remove(req, HOTEL_ID)).rejects.toThrow(ForbiddenException);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, { userIds: [sampleManager.id] }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.createCalls).toHaveLength(0);
      expect(service.updateCalls).toHaveLength(0);
      expect(service.removeCalls).toHaveLength(0);
      expect(managersService.replaceCalls).toHaveLength(0);
    });

    it('PARTNER : 403 sur POST, PATCH, DELETE et PUT managers', async () => {
      const req = makeRequest(partnerPrincipal);

      expect(() => controller.create(req, validCreatePayload)).toThrow(ForbiddenException);
      expect(() => controller.update(req, HOTEL_ID, validUpdatePayload)).toThrow(ForbiddenException);
      await expect(controller.remove(req, HOTEL_ID)).rejects.toThrow(ForbiddenException);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, { userIds: [sampleManager.id] }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.createCalls).toHaveLength(0);
      expect(service.updateCalls).toHaveLength(0);
      expect(service.removeCalls).toHaveLength(0);
      expect(managersService.replaceCalls).toHaveLength(0);
    });

    it('Requête sans principal : 403 sur toutes les opérations', async () => {
      const req = makeRequest();

      expect(() => controller.list(req)).toThrow(ForbiddenException);
      expect(() => controller.get(req, HOTEL_ID)).toThrow(ForbiddenException);
      expect(() => controller.create(req, validCreatePayload)).toThrow(ForbiddenException);
      expect(() => controller.update(req, HOTEL_ID, validUpdatePayload)).toThrow(ForbiddenException);
      await expect(controller.remove(req, HOTEL_ID)).rejects.toThrow(ForbiddenException);
      await expect(controller.listManagers(req, HOTEL_ID)).rejects.toThrow(ForbiddenException);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, { userIds: [sampleManager.id] }),
      ).rejects.toThrow(ForbiddenException);
      expect(managersService.listCalls).toHaveLength(0);
      expect(managersService.replaceCalls).toHaveLength(0);
    });
  });

  describe('Validation des entrées (parseResourceId et parseBody)', () => {
    it('GET :id refuse un ID non-UUIDv7 avec 400 BadRequestException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() => controller.get(req, INVALID_UUID)).toThrow(BadRequestException);
    });

    it('PATCH :id refuse un ID non-UUIDv7 avec 400 BadRequestException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() => controller.update(req, INVALID_UUID, validUpdatePayload)).toThrow(BadRequestException);
    });

    it('DELETE :id refuse un ID non-UUIDv7 avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(controller.remove(req, INVALID_UUID)).rejects.toThrow(BadRequestException);
    });

    it('POST refuse un corps invalide avec 400 BadRequestException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() => controller.create(req, { invalidField: 123 })).toThrow(BadRequestException);
      expect(service.createCalls).toHaveLength(0);
    });

    it('POST refuse une brandColor invalide avec 422 UnprocessableEntityException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() =>
        controller.create(req, { ...validCreatePayload, brandColor: 'invalid-hex' }),
      ).toThrow(UnprocessableEntityException);
      expect(service.createCalls).toHaveLength(0);
    });

    it('PATCH refuse un corps invalide avec 400 BadRequestException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() => controller.update(req, HOTEL_ID, { email: 'invalid-email' })).toThrow(BadRequestException);
      expect(service.updateCalls).toHaveLength(0);
    });

    it('PATCH refuse une brandColor invalide avec 422 UnprocessableEntityException', () => {
      const req = makeRequest(adminPrincipal);
      expect(() =>
        controller.update(req, HOTEL_ID, { brandColor: 'not-a-color' }),
      ).toThrow(UnprocessableEntityException);
      expect(service.updateCalls).toHaveLength(0);
    });

    it('GET :id/managers refuse un ID non-UUIDv7 avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(controller.listManagers(req, INVALID_UUID)).rejects.toThrow(BadRequestException);
      expect(managersService.listCalls).toHaveLength(0);
    });

    it('PUT :id/managers refuse un ID non-UUIDv7 avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(
        controller.replaceManagers(req, INVALID_UUID, { userIds: [] }),
      ).rejects.toThrow(BadRequestException);
      expect(managersService.replaceCalls).toHaveLength(0);
    });

    it('PUT :id/managers refuse un corps sans userIds avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, { invalid: true }),
      ).rejects.toThrow(BadRequestException);
      expect(managersService.replaceCalls).toHaveLength(0);
    });

    it('PUT :id/managers refuse un userId non-UUID avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, { userIds: ['not-a-uuid'] }),
      ).rejects.toThrow(BadRequestException);
      expect(managersService.replaceCalls).toHaveLength(0);
    });

    it('PUT :id/managers refuse des doublons dans userIds avec 400 BadRequestException', async () => {
      const req = makeRequest(adminPrincipal);
      await expect(
        controller.replaceManagers(req, HOTEL_ID, {
          userIds: [sampleManager.id, sampleManager.id],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(managersService.replaceCalls).toHaveLength(0);
    });
  });
});
