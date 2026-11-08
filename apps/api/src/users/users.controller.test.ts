import 'reflect-metadata';

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminUserListQuerySchema,
  Role,
  type AdminUser,
  type AdminUserListQuery,
  type PaginatedAdminUsersResponse,
  type Principal,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  UsersController,
  type UsersAdminOperations,
  type UsersOperations,
} from './users.controller.js';

const VALID_USER_ID = '01990000-0000-7000-8000-000000000001';
const ADMIN_USER_ID = '01990000-0000-7000-8000-000000000002';
const HOTEL_MANAGER_USER_ID = '01990000-0000-7000-8000-000000000003';
const EDITOR_USER_ID = '01990000-0000-7000-8000-000000000004';
const PARTNER_USER_ID = '01990000-0000-7000-8000-000000000005';

const HOTEL_ID_1 = '01990000-0000-7000-8000-000000000010';
const HOTEL_ID_2 = '01990000-0000-7000-8000-000000000011';

const INVALID_NOT_UUID = 'not-a-uuid';
const INVALID_UUID_V1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const adminPrincipal: Principal = {
  userId: ADMIN_USER_ID,
  role: Role.ADMIN,
  hotelIds: [],
};

const hotelManagerPrincipal: Principal = {
  userId: HOTEL_MANAGER_USER_ID,
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_ID_1],
};

const editorPrincipal: Principal = {
  userId: EDITOR_USER_ID,
  role: Role.EDITOR,
  hotelIds: [],
};

const partnerPrincipal: Principal = {
  userId: PARTNER_USER_ID,
  role: Role.PARTNER,
  hotelIds: [HOTEL_ID_1],
};

const sampleAdminUser: AdminUser = {
  id: VALID_USER_ID,
  email: 'user@xplor.test',
  name: 'Karim Bennani',
  role: Role.HOTEL_MANAGER,
  active: true,
  totpEnabled: false,
  lastLoginAt: '2026-11-01T10:00:00.000Z',
  uiLang: 'fr',
  hotelIds: [HOTEL_ID_1],
};

const samplePaginatedResponse: PaginatedAdminUsersResponse = {
  items: [sampleAdminUser],
  total: 1,
  page: 1,
  pageSize: 20,
};

function makeSessionRequest(params?: {
  principal?: Principal;
  headers?: Record<string, string>;
}): SessionRequest {
  return {
    method: 'GET',
    headers: params?.headers ?? {},
    principal: params?.principal,
  };
}

function getGuardsForMethod(target: object, propertyKey: string): unknown[] {
  const method: unknown = Object.getOwnPropertyDescriptor(target, propertyKey)?.value;
  if (typeof method !== 'function') {
    return [];
  }
  const guards: unknown = Reflect.getMetadata('__guards__', method);
  if (Array.isArray(guards)) {
    return guards;
  }
  return [];
}

class RecordingUsersAdminService implements UsersAdminOperations {
  public listCalls: AdminUserListQuery[] = [];
  public getCalls: string[] = [];
  public updateCalls: { actorId: string; id: string; input: unknown }[] = [];
  public setHotelsCalls: { id: string; hotelIds: string[] }[] = [];

  public listResponse: PaginatedAdminUsersResponse = samplePaginatedResponse;
  public userResponse: AdminUser = sampleAdminUser;

  list(query?: unknown): Promise<PaginatedAdminUsersResponse> {
    const parsed = AdminUserListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      return Promise.reject(new BadRequestException());
    }
    this.listCalls.push(parsed.data);
    return Promise.resolve(this.listResponse);
  }

  get(id: string): Promise<AdminUser> {
    this.getCalls.push(id);
    return Promise.resolve(this.userResponse);
  }

  update(actorId: string, id: string, input: unknown): Promise<AdminUser> {
    this.updateCalls.push({ actorId, id, input });
    return Promise.resolve(this.userResponse);
  }

  setHotels(id: string, hotelIds: string[]): Promise<AdminUser> {
    this.setHotelsCalls.push({ id, hotelIds });
    return Promise.resolve(this.userResponse);
  }
}

const dummyUsersService: UsersOperations = {
  invite: () => Promise.reject(new Error('unused in controller tests')),
};

describe('UsersController', () => {
  let fakeAdminService: RecordingUsersAdminService;
  let controller: UsersController;

  beforeEach(() => {
    fakeAdminService = new RecordingUsersAdminService();
    controller = new UsersController(dummyUsersService, fakeAdminService);
  });

  describe('Métadonnées et gardes', () => {
    it('applique SessionGuard sur GET /admin/users', () => {
      const guards = getGuardsForMethod(UsersController.prototype, 'list');
      expect(guards).toContain(SessionGuard);
    });

    it('applique SessionGuard sur GET /admin/users/:id', () => {
      const guards = getGuardsForMethod(UsersController.prototype, 'get');
      expect(guards).toContain(SessionGuard);
    });

    it('applique SessionGuard et CsrfGuard sur PATCH /admin/users/:id', () => {
      const guards = getGuardsForMethod(UsersController.prototype, 'update');
      expect(guards).toContain(SessionGuard);
      expect(guards).toContain(CsrfGuard);
    });

    it('applique SessionGuard et CsrfGuard sur PUT /admin/users/:id/hotels', () => {
      const guards = getGuardsForMethod(UsersController.prototype, 'setHotels');
      expect(guards).toContain(SessionGuard);
      expect(guards).toContain(CsrfGuard);
    });
  });

  describe('GET /admin/users (liste filtrée)', () => {
    it('refuse avec 401 si la requête n’a pas de session (principal absent)', async () => {
      const req = makeSessionRequest();
      await expect(controller.list(req, {})).rejects.toThrow(UnauthorizedException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle HOTEL_MANAGER', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle EDITOR', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle PARTNER', async () => {
      const req = makeSessionRequest({ principal: partnerPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un paramètre page invalide (< 1 ou non entier)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.list(req, { page: 0 })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { page: -1 })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { page: '0' })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { page: 'abc' })).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un paramètre pageSize invalide (< 1 ou > 100)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.list(req, { pageSize: 101 })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { pageSize: 0 })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { pageSize: '101' })).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un rôle inconnu dans la query', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.list(req, { role: 'SUPERUSER' })).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('refuse avec 400 si query n’est pas un objet (primitive ou tableau)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.list(req, 'string-query')).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, [1, 2, 3])).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.listCalls).toHaveLength(0);
    });

    it('autorise ADMIN avec query vide et applique les valeurs par défaut (page: 1, pageSize: 20)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.list(req, {});

      expect(result).toEqual(samplePaginatedResponse);
      expect(fakeAdminService.listCalls).toHaveLength(1);
      const call = fakeAdminService.listCalls[0];
      expect(call).toBeDefined();
      expect(call?.page).toBe(1);
      expect(call?.pageSize).toBe(20);
    });

    it('autorise ADMIN avec paramètres complets et convertit les chaînes numériques', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.list(req, {
        page: '3',
        pageSize: '50',
        role: Role.EDITOR,
        active: 'true',
        q: 'bennani',
      });

      expect(result).toEqual(samplePaginatedResponse);
      expect(fakeAdminService.listCalls).toHaveLength(1);
      const call = fakeAdminService.listCalls[0];
      expect(call).toBeDefined();
      expect(call?.page).toBe(3);
      expect(call?.pageSize).toBe(50);
      expect(call?.role).toBe(Role.EDITOR);
      expect(call?.active).toBe(true);
      expect(call?.q).toBe('bennani');
    });
  });

  describe('GET /admin/users/:id', () => {
    it('refuse avec 401 si la requête n’a pas de session (principal absent)', async () => {
      const req = makeSessionRequest();
      await expect(controller.get(req, VALID_USER_ID)).rejects.toThrow(UnauthorizedException);
      expect(fakeAdminService.getCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle HOTEL_MANAGER', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(controller.get(req, VALID_USER_ID)).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.getCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle EDITOR', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await expect(controller.get(req, VALID_USER_ID)).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.getCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle PARTNER', async () => {
      const req = makeSessionRequest({ principal: partnerPrincipal });
      await expect(controller.get(req, VALID_USER_ID)).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.getCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un identifiant non valide (non-UUID ou non-UUIDv7)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.get(req, INVALID_NOT_UUID)).rejects.toThrow(BadRequestException);
      await expect(controller.get(req, INVALID_UUID_V1)).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.getCalls).toHaveLength(0);
    });

    it('autorise ADMIN avec un identifiant valide et transmet l’id au service', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.get(req, VALID_USER_ID);

      expect(result).toEqual(sampleAdminUser);
      expect(fakeAdminService.getCalls).toEqual([VALID_USER_ID]);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('refuse avec 401 si la requête n’a pas de session (principal absent)', async () => {
      const req = makeSessionRequest();
      await expect(
        controller.update(req, VALID_USER_ID, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle HOTEL_MANAGER', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle EDITOR', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle PARTNER', async () => {
      const req = makeSessionRequest({ principal: partnerPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un identifiant non valide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.update(req, INVALID_NOT_UUID, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.update(req, INVALID_UUID_V1, { name: 'Nouveau Nom' }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un corps vide (aucun champ fourni)', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.update(req, VALID_USER_ID, {})).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un nom vide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un rôle inconnu', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { role: 'SUPERUSER' }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur une langue d’interface invalide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.update(req, VALID_USER_ID, { uiLang: 'de' }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.updateCalls).toHaveLength(0);
    });

    it('autorise ADMIN avec transmission correcte de actorId, id et des données validées', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const updatePayload = {
        name: 'Karim Bennani Modifié',
        role: Role.ADMIN,
        active: false,
        uiLang: 'ar',
      };

      const result = await controller.update(req, VALID_USER_ID, updatePayload);

      expect(result).toEqual(sampleAdminUser);
      expect(fakeAdminService.updateCalls).toHaveLength(1);
      const call = fakeAdminService.updateCalls[0];
      expect(call).toBeDefined();
      expect(call?.actorId).toBe(adminPrincipal.userId);
      expect(call?.id).toBe(VALID_USER_ID);
      expect(call?.input).toEqual(updatePayload);
    });
  });

  describe('PUT /admin/users/:id/hotels', () => {
    it('refuse avec 401 si la requête n’a pas de session (principal absent)', async () => {
      const req = makeSessionRequest();
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(UnauthorizedException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle HOTEL_MANAGER', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle EDITOR', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 403 pour le rôle PARTNER', async () => {
      const req = makeSessionRequest({ principal: partnerPrincipal });
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(ForbiddenException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un identifiant non valide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.setHotels(req, INVALID_NOT_UUID, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.setHotels(req, INVALID_UUID_V1, { hotelIds: [HOTEL_ID_1] }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un corps manquant ou hotelIds non tableau', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.setHotels(req, VALID_USER_ID, {})).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: HOTEL_ID_1 }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('refuse avec 400 sur un identifiant hôtel non-uuid dans le tableau', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(
        controller.setHotels(req, VALID_USER_ID, { hotelIds: [INVALID_NOT_UUID] }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(0);
    });

    it('autorise ADMIN avec un tableau d’hôtels valide et transmet les identifiants', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const hotelIds = [HOTEL_ID_1, HOTEL_ID_2];

      const result = await controller.setHotels(req, VALID_USER_ID, { hotelIds });

      expect(result).toEqual(sampleAdminUser);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(1);
      const call = fakeAdminService.setHotelsCalls[0];
      expect(call).toBeDefined();
      expect(call?.id).toBe(VALID_USER_ID);
      expect(call?.hotelIds).toEqual(hotelIds);
    });

    it('autorise ADMIN avec un tableau vide pour détacher tous les hôtels', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      const result = await controller.setHotels(req, VALID_USER_ID, { hotelIds: [] });

      expect(result).toEqual(sampleAdminUser);
      expect(fakeAdminService.setHotelsCalls).toHaveLength(1);
      const call = fakeAdminService.setHotelsCalls[0];
      expect(call).toBeDefined();
      expect(call?.id).toBe(VALID_USER_ID);
      expect(call?.hotelIds).toEqual([]);
    });
  });
});
