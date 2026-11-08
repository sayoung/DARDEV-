import 'reflect-metadata';

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditLogQuerySchema,
  Role,
  type AuditLogEntry,
  type PaginatedAuditLogResponse,
  type Principal,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import {
  AuditQueryService,
  type AuditCountArgs,
  type AuditFindManyArgs,
  type AuditLogRecord,
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

class RecordingAuditQueryService extends AuditQueryService {
  public listCalls: unknown[] = [];
  public returnValue: PaginatedAuditLogResponse = sampleResponse;

  constructor() {
    super({
      auditLog: {
        findMany: () => Promise.resolve([]),
        count: () => Promise.resolve(0),
      },
    });
  }

  override list(query: unknown): Promise<PaginatedAuditLogResponse> {
    this.listCalls.push(query);
    return Promise.resolve(this.returnValue);
  }
}

class FakeAuditQueryPrismaClient implements AuditQueryPrismaClient {
  public findManyCalls: AuditFindManyArgs[] = [];
  public countCalls: AuditCountArgs[] = [];
  public records: AuditLogRecord[] = [];

  constructor(records: AuditLogRecord[] = []) {
    this.records = records;
  }

  public readonly auditLog = {
    findMany: (args?: AuditFindManyArgs): Promise<AuditLogRecord[]> => {
      const callArgs: AuditFindManyArgs = args ?? {};
      this.findManyCalls.push(callArgs);
      return Promise.resolve(this.records);
    },
    count: (args?: AuditCountArgs): Promise<number> => {
      const callArgs: AuditCountArgs = args ?? {};
      this.countCalls.push(callArgs);
      return Promise.resolve(this.records.length);
    },
  };
}

describe('AuditController', () => {
  let recordingService: RecordingAuditQueryService;
  let controller: AuditController;

  beforeEach(() => {
    recordingService = new RecordingAuditQueryService();
    controller = new AuditController(recordingService);
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

  describe('Contrôle d’accès (401 sans session, 403 pour non-ADMIN)', () => {
    it('refuse avec 401 UnauthorizedException si la requête n’a pas de session (principal absent)', async () => {
      const req = makeSessionRequest();
      await expect(controller.list(req, {})).rejects.toThrow(UnauthorizedException);
      expect(recordingService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException pour le rôle HOTEL_MANAGER', async () => {
      const req = makeSessionRequest({ principal: hotelManagerPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(recordingService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException pour le rôle EDITOR', async () => {
      const req = makeSessionRequest({ principal: editorPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(recordingService.listCalls).toHaveLength(0);
    });

    it('refuse avec 403 ForbiddenException pour le rôle PARTNER', async () => {
      const req = makeSessionRequest({ principal: partnerPrincipal });
      await expect(controller.list(req, {})).rejects.toThrow(ForbiddenException);
      expect(recordingService.listCalls).toHaveLength(0);
    });

    it('autorise le rôle ADMIN et renvoie la réponse paginée', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await controller.list(req, {});

      expect(result).toEqual(sampleResponse);
      expect(recordingService.listCalls).toHaveLength(1);
    });
  });

  describe('Validation des requêtes (parseAuditLogQuery / 400 sur requête invalide)', () => {
    it('applique les valeurs par défaut sur query vide', () => {
      const query = parseAuditLogQuery({});
      expect(query.page).toBe(1);
      expect(query.pageSize).toBe(50);
      expect(query.action).toBeUndefined();
      expect(query.entityType).toBeUndefined();
      expect(query.userId).toBeUndefined();
      expect(query.from).toBeUndefined();
      expect(query.to).toBeUndefined();
    });

    it('convertit les chaînes numériques pour page et pageSize', () => {
      const query = parseAuditLogQuery({ page: '3', pageSize: '25' });
      expect(query.page).toBe(3);
      expect(query.pageSize).toBe(25);
    });

    it('refuse page = 0 avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ page: '0' })).toThrow(BadRequestException);
    });

    it('refuse page négatif avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ page: '-5' })).toThrow(BadRequestException);
    });

    it('refuse page non-numérique avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ page: 'invalide' })).toThrow(BadRequestException);
    });

    it('refuse pageSize > 100 avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ pageSize: '101' })).toThrow(BadRequestException);
    });

    it('refuse pageSize < 1 avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ pageSize: '0' })).toThrow(BadRequestException);
    });

    it('refuse from > to avec 400 BadRequestException', () => {
      expect(() =>
        parseAuditLogQuery({
          from: '2026-11-10T00:00:00.000Z',
          to: '2026-11-01T00:00:00.000Z',
        }),
      ).toThrow(BadRequestException);
    });

    it('refuse une action inconnue avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ action: 'unknown_action' })).toThrow(BadRequestException);
    });

    it('refuse un userId invalide avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery({ userId: 'pas-un-uuid' })).toThrow(BadRequestException);
    });

    it('refuse un corps non-objet avec 400 BadRequestException', () => {
      expect(() => parseAuditLogQuery('chaine-invalide')).toThrow(BadRequestException);
      expect(() => parseAuditLogQuery(null)).toThrow(BadRequestException);
    });

    it('transmet les paramètres valides au service', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await controller.list(req, {
        page: '2',
        pageSize: '10',
        action: 'tour.publish',
        entityType: 'Tour',
        userId: ADMIN_USER_ID,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-10T23:59:59.999Z',
      });

      expect(recordingService.listCalls).toHaveLength(1);
      const call = recordingService.listCalls[0];
      const parsedCall = AuditLogQuerySchema.safeParse(call);
      expect(parsedCall.success).toBe(true);
      if (parsedCall.success) {
        expect(parsedCall.data.page).toBe(2);
        expect(parsedCall.data.pageSize).toBe(10);
        expect(parsedCall.data.action).toBe('tour.publish');
        expect(parsedCall.data.entityType).toBe('Tour');
        expect(parsedCall.data.userId).toBe(ADMIN_USER_ID);
        expect(parsedCall.data.from).toBe('2026-11-01T00:00:00.000Z');
        expect(parsedCall.data.to).toBe('2026-11-10T23:59:59.999Z');
      }
    });

    it('rejette l’appel controller.list avec 400 BadRequestException si la query est invalide', async () => {
      const req = makeSessionRequest({ principal: adminPrincipal });
      await expect(controller.list(req, { page: '-1' })).rejects.toThrow(BadRequestException);
      expect(recordingService.listCalls).toHaveLength(0);
    });
  });

  describe('Délégation sans appel Prisma direct dans le contrôleur', () => {
    it('interroge le service avec le faux Prisma sans appel Prisma direct', async () => {
      const record: AuditLogRecord = {
        id: ENTRY_ID,
        userId: ADMIN_USER_ID,
        kioskId: null,
        action: 'tour.publish',
        entityType: 'Tour',
        entityId: '01990000-0000-7000-8000-000000000301',
        diff: null,
        ip: null,
        createdAt: new Date('2026-11-05T12:00:00.000Z'),
      };
      const fakePrisma = new FakeAuditQueryPrismaClient([record]);
      const realService = new AuditQueryService(fakePrisma);
      const testController = new AuditController(realService);

      const req = makeSessionRequest({ principal: adminPrincipal });
      const result = await testController.list(req, {
        action: 'tour.publish',
        page: '1',
        pageSize: '10',
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      const first = result.items[0];
      expect(first?.id).toBe(ENTRY_ID);
      expect(first?.action).toBe('tour.publish');

      expect(fakePrisma.findManyCalls).toHaveLength(1);
      const call = fakePrisma.findManyCalls[0];
      expect(call?.where).toEqual({ action: 'tour.publish' });
      expect(call?.skip).toBe(0);
      expect(call?.take).toBe(10);
    });
  });
});
