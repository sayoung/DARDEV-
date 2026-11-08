import 'reflect-metadata';

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Role,
  type AuditLogEntry,
  type PaginatedAuditLogResponse,
  type Principal,
} from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  AuditQueryService,
  type AuditQueryPrismaClient,
} from './audit-query.service.js';
import { AuditController, parseAuditLogQuery } from './audit.controller.js';

const ENTRY_ID = '01990000-0000-7000-8000-000000000001';
const ADMIN_USER_ID = '01990000-0000-7000-8000-000000000101';
const MANAGER_USER_ID = '01990000-0000-7000-8000-000000000102';
const EDITOR_USER_ID = '01990000-0000-7000-8000-000000000103';
const PARTNER_USER_ID = '01990000-0000-7000-8000-000000000104';
const HOTEL_ID = '01990000-0000-7000-8000-000000000201';

const adminPrincipal: Principal = {
  userId: ADMIN_USER_ID,
  role: Role.ADMIN,
  hotelIds: [],
};

const hotelManagerPrincipal: Principal = {
  userId: MANAGER_USER_ID,
  role: Role.HOTEL_MANAGER,
  hotelIds: [HOTEL_ID],
};

const editorPrincipal: Principal = {
  userId: EDITOR_USER_ID,
  role: Role.EDITOR,
  hotelIds: [],
};

const partnerPrincipal: Principal = {
  userId: PARTNER_USER_ID,
  role: Role.PARTNER,
  hotelIds: [HOTEL_ID],
};

const sampleAuditEntry: AuditLogEntry = {
  id: ENTRY_ID,
  userId: ADMIN_USER_ID,
  kioskId: null,
  action: 'tour.publish',
  entityType: 'Tour',
  entityId: '01990000-0000-7000-8000-000000000301',
  diff: { status: 'PUBLISHED' },
  ip: '192.168.1.1',
  createdAt: '2026-11-05T12:00:00.000Z',
};

const sampleResponse: PaginatedAuditLogResponse = {
  items: [sampleAuditEntry],
  total: 1,
  page: 1,
  pageSize: 50,
};

const dummyPrisma: AuditQueryPrismaClient = {
  auditLog: {
    findMany: () => Promise.resolve([]),
    count: () => Promise.resolve(0),
  },
};

class FakeAuditQueryService extends AuditQueryService {
  public override readonly list = vi.fn<(query: unknown) => Promise<PaginatedAuditLogResponse>>();

  constructor() {
    super(dummyPrisma);
  }
}

function makeSessionRequest(params?: {
  principal?: Principal;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): SessionRequest {
  return {
    method: 'GET',
    headers: params?.headers ?? {},
    cookies: params?.cookies,
    principal: params?.principal,
  };
}

describe('AuditController', () => {
  let fakeService: FakeAuditQueryService;
  let controller: AuditController;

  beforeEach(() => {
    fakeService = new FakeAuditQueryService();
    fakeService.list.mockResolvedValue(sampleResponse);
    controller = new AuditController(fakeService);
  });

  describe('Métadonnées et gardes', () => {
    it('applique SessionGuard et CsrfGuard sur le contrôleur', () => {
      const guards: unknown = Reflect.getMetadata('__guards__', AuditController);
      expect(Array.isArray(guards)).toBe(true);
      if (Array.isArray(guards)) {
        expect(guards).toContain(SessionGuard);
        expect(guards).toContain(CsrfGuard);
      }
    });
  });

  describe('(1) ADMIN → appelle list(query) avec la query validée et renvoie son résultat', () => {
    it('autorise le rôle ADMIN avec une query vide, applique les valeurs par défaut et renvoie la réponse', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.list(req, {});

      expect(result).toEqual(sampleResponse);
      expect(fakeService.list).toHaveBeenCalledTimes(1);
      expect(fakeService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
      });
    });

    it('transmet les paramètres de pagination et de filtres validés et normalisés au service', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const customResponse: PaginatedAuditLogResponse = {
        items: [sampleAuditEntry],
        total: 42,
        page: 2,
        pageSize: 25,
      };
      fakeService.list.mockResolvedValue(customResponse);

      const result = await controller.list(req, {
        page: '2',
        pageSize: '25',
        action: 'tour.publish',
        entityType: 'Tour',
        userId: ADMIN_USER_ID,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-10T23:59:59.999Z',
      });

      expect(result).toEqual(customResponse);
      expect(fakeService.list).toHaveBeenCalledTimes(1);
      expect(fakeService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 25,
        action: 'tour.publish',
        entityType: 'Tour',
        userId: ADMIN_USER_ID,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-10T23:59:59.999Z',
      });
    });
  });

  describe('(2) non-ADMIN (gestionnaire d’hôtel) → 403 et list non appelé', () => {
    it('refuse avec 403 ForbiddenException pour le gestionnaire d’hôtel (HOTEL_MANAGER) et n’appelle pas list', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });

      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('refuse avec 403 ForbiddenException pour les rôles EDITOR et PARTNER sans appeler list', async () => {
      const editorReq = makeSessionRequest({ principal: editorPrincipal });
      await expect(controller.list(editorReq, {})).rejects.toThrow(ForbiddenException);

      const partnerReq = makeSessionRequest({ principal: partnerPrincipal });
      await expect(controller.list(partnerReq, {})).rejects.toThrow(ForbiddenException);

      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('refuse avec 401 UnauthorizedException si la requête n’a pas de session (principal absent) sans appeler list', async () => {
      const unauthReq = makeSessionRequest();

      await expect(controller.list(unauthReq, {})).rejects.toThrow(UnauthorizedException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });
  });

  describe('(3) query invalide → 400', () => {
    it('rejette avec 400 BadRequestException si page est négatif ou égal à zéro', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      await expect(controller.list(req, { page: '0' })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { page: '-2' })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { page: 'abc' })).rejects.toThrow(BadRequestException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('rejette avec 400 BadRequestException si pageSize dépasse 100 ou est inférieur à 1', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      await expect(controller.list(req, { pageSize: '0' })).rejects.toThrow(BadRequestException);
      await expect(controller.list(req, { pageSize: '101' })).rejects.toThrow(BadRequestException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('rejette avec 400 BadRequestException si action n’est pas reconnue', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      await expect(controller.list(req, { action: 'action.inconnue' })).rejects.toThrow(BadRequestException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('rejette avec 400 BadRequestException si userId n’est pas un UUID valide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      await expect(controller.list(req, { userId: 'not-a-valid-uuid' })).rejects.toThrow(BadRequestException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('rejette avec 400 BadRequestException si la plage temporelle from > to est incohérente', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });

      await expect(
        controller.list(req, {
          from: '2026-11-10T00:00:00.000Z',
          to: '2026-11-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(fakeService.list).not.toHaveBeenCalled();
    });

    it('rejette avec 400 BadRequestException si query est null ou non-objet', () => {
      expect(() => parseAuditLogQuery('chaine-invalide')).toThrow(BadRequestException);
      expect(() => parseAuditLogQuery(null)).toThrow(BadRequestException);
    });
  });
});
