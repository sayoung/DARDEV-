import 'reflect-metadata';

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogEntrySchema,
  AuditLogQuerySchema,
  type AuditAction,
  type AuditLogQuery,
} from '@xplor/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  AuditQueryService,
  buildAuditWhereInput,
  toAuditLogEntry,
  type AuditCountArgs,
  type AuditFindManyArgs,
  type AuditLogRecord,
  type AuditQueryPrismaClient,
} from './audit-query.service.js';

const ENTRY_ID_1 = '01990000-0000-7000-8000-000000000001';
const ENTRY_ID_2 = '01990000-0000-7000-8000-000000000002';
const ENTRY_ID_3 = '01990000-0000-7000-8000-000000000003';
const ENTRY_ID_4 = '01990000-0000-7000-8000-000000000004';

const USER_ID_1 = '01990000-0000-7000-8000-000000000101';
const USER_ID_2 = '01990000-0000-7000-8000-000000000102';

const sampleRecords: AuditLogRecord[] = [
  {
    id: ENTRY_ID_4,
    userId: USER_ID_1,
    kioskId: null,
    action: 'tour.publish',
    entityType: 'Tour',
    entityId: '01990000-0000-7000-8000-000000000201',
    diff: { status: 'PUBLISHED' },
    ip: '10.0.0.4',
    createdAt: new Date('2026-11-05T12:00:00.000Z'),
  },
  {
    id: ENTRY_ID_3,
    userId: USER_ID_2,
    kioskId: null,
    action: 'selection.update',
    entityType: 'Selection',
    entityId: '01990000-0000-7000-8000-000000000202',
    diff: { count: 3 },
    ip: '10.0.0.3',
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
  },
  {
    id: ENTRY_ID_2,
    userId: USER_ID_1,
    kioskId: null,
    action: 'auth.login',
    entityType: 'User',
    entityId: USER_ID_1,
    diff: null,
    ip: '10.0.0.2',
    createdAt: new Date('2026-10-15T12:00:00.000Z'),
  },
  {
    id: ENTRY_ID_1,
    userId: null,
    kioskId: '01990000-0000-7000-8000-000000000301',
    action: 'kiosk.create',
    entityType: 'Kiosk',
    entityId: '01990000-0000-7000-8000-000000000301',
    diff: null,
    ip: '10.0.0.1',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
  },
];

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

      let filtered = [...this.records];
      const where = callArgs.where;
      if (where !== undefined) {
        filtered = filtered.filter((item) => this.matchesWhere(item, where));
      }

      filtered.sort((a, b) => {
        const timeA =
          a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const timeB =
          b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      const skip = callArgs.skip ?? 0;
      const take = callArgs.take ?? filtered.length;
      return Promise.resolve(filtered.slice(skip, skip + take));
    },

    count: (args?: AuditCountArgs): Promise<number> => {
      const callArgs: AuditCountArgs = args ?? {};
      this.countCalls.push(callArgs);

      const where = callArgs.where;
      if (where === undefined) {
        return Promise.resolve(this.records.length);
      }
      const filtered = this.records.filter((item) => this.matchesWhere(item, where));
      return Promise.resolve(filtered.length);
    },
  };

  private matchesWhere(item: AuditLogRecord, where: Prisma.AuditLogWhereInput): boolean {
    if (where.action !== undefined && item.action !== where.action) {
      return false;
    }
    if (where.entityType !== undefined && item.entityType !== where.entityType) {
      return false;
    }
    if (where.userId !== undefined && item.userId !== where.userId) {
      return false;
    }
    if (where.createdAt !== undefined) {
      const itemTime =
        item.createdAt instanceof Date ? item.createdAt.getTime() : new Date(item.createdAt).getTime();
      const filter = where.createdAt;
      if (filter instanceof Date) {
        if (itemTime !== filter.getTime()) {
          return false;
        }
      } else if (typeof filter === 'string') {
        if (itemTime !== new Date(filter).getTime()) {
          return false;
        }
      } else {
        if (filter.gte !== undefined) {
          const gteVal = filter.gte;
          const gteTime =
            gteVal instanceof Date
              ? gteVal.getTime()
              : typeof gteVal === 'string'
                ? new Date(gteVal).getTime()
                : 0;
          if (itemTime < gteTime) {
            return false;
          }
        }
        if (filter.lte !== undefined) {
          const lteVal = filter.lte;
          const lteTime =
            lteVal instanceof Date
              ? lteVal.getTime()
              : typeof lteVal === 'string'
                ? new Date(lteVal).getTime()
                : Infinity;
          if (itemTime > lteTime) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

describe('AuditQueryService', () => {
  let fakePrisma: FakeAuditQueryPrismaClient;
  let service: AuditQueryService;

  beforeEach(() => {
    fakePrisma = new FakeAuditQueryPrismaClient(sampleRecords);
    service = new AuditQueryService(fakePrisma);
  });

  describe('buildAuditWhereInput', () => {
    it('construit un where vide pour une query sans filtres', () => {
      const where = buildAuditWhereInput({ page: 1, pageSize: 50 });
      expect(where).toEqual({});
    });

    it('ajoute le filtre action lorsqu il est defini', () => {
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, action: 'tour.publish' });
      expect(where).toEqual({ action: 'tour.publish' });
    });

    it('ajoute le filtre entityType lorsqu il est defini', () => {
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, entityType: 'Tour' });
      expect(where).toEqual({ entityType: 'Tour' });
    });

    it('ajoute le filtre userId lorsqu il est defini', () => {
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, userId: USER_ID_1 });
      expect(where).toEqual({ userId: USER_ID_1 });
    });

    it('ajoute les bornes temporelles from et to lorsqu elles sont definies', () => {
      const fromStr = '2026-10-01T00:00:00.000Z';
      const toStr = '2026-10-31T23:59:59.999Z';
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, from: fromStr, to: toStr });
      expect(where.createdAt).toEqual({
        gte: new Date(fromStr),
        lte: new Date(toStr),
      });
    });

    it('ajoute seulement from lorsqu il est le seul renseigne', () => {
      const fromStr = '2026-10-01T00:00:00.000Z';
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, from: fromStr });
      expect(where.createdAt).toEqual({
        gte: new Date(fromStr),
      });
    });

    it('ajoute seulement to lorsqu il est le seul renseigne', () => {
      const toStr = '2026-10-31T23:59:59.999Z';
      const where = buildAuditWhereInput({ page: 1, pageSize: 50, to: toStr });
      expect(where.createdAt).toEqual({
        lte: new Date(toStr),
      });
    });
  });

  describe('toAuditLogEntry', () => {
    it('convertit un enregistrement avec Date en AuditLogEntry valide', () => {
      const record = sampleRecords[0];
      expect(record).toBeDefined();
      if (record !== undefined) {
        const entry = toAuditLogEntry(record);
        expect(AuditLogEntrySchema.safeParse(entry).success).toBe(true);
        expect(entry.id).toBe(ENTRY_ID_4);
        expect(entry.action).toBe('tour.publish');
        expect(entry.createdAt).toBe('2026-11-05T12:00:00.000Z');
      }
    });

    it('convertit un enregistrement avec createdAt en string', () => {
      const record: AuditLogRecord = {
        id: ENTRY_ID_1,
        userId: null,
        kioskId: null,
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: null,
        diff: null,
        ip: null,
        createdAt: '2026-10-01T08:00:00.000Z',
      };
      const entry = toAuditLogEntry(record);
      expect(entry.createdAt).toBe('2026-10-01T08:00:00.000Z');
    });
  });

  describe('Filtrage', () => {
    it('filtre par action', async () => {
      const result = await service.list({ page: 1, pageSize: 50, action: 'tour.publish' });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.action).toBe('tour.publish');

      expect(fakePrisma.findManyCalls).toHaveLength(1);
      expect(fakePrisma.findManyCalls[0]?.where).toEqual({ action: 'tour.publish' });
    });

    it('filtre par entityType', async () => {
      const result = await service.list({ page: 1, pageSize: 50, entityType: 'Selection' });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.entityType).toBe('Selection');

      expect(fakePrisma.findManyCalls[0]?.where).toEqual({ entityType: 'Selection' });
    });

    it('filtre par userId', async () => {
      const result = await service.list({ page: 1, pageSize: 50, userId: USER_ID_1 });
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      for (const item of result.items) {
        expect(item.userId).toBe(USER_ID_1);
      }

      expect(fakePrisma.findManyCalls[0]?.where).toEqual({ userId: USER_ID_1 });
    });

    it('filtre par intervalle temporel from et to', async () => {
      const from = '2026-10-10T00:00:00.000Z';
      const to = '2026-10-20T23:59:59.999Z';
      const result = await service.list({ page: 1, pageSize: 50, from, to });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(ENTRY_ID_2);

      expect(fakePrisma.findManyCalls[0]?.where?.createdAt).toEqual({
        gte: new Date(from),
        lte: new Date(to),
      });
    });

    it('combine plusieurs filtres (action, entityType, userId, from, to)', async () => {
      const action: AuditAction = 'tour.publish';
      const query: AuditLogQuery = {
        action,
        entityType: 'Tour',
        userId: USER_ID_1,
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-10T23:59:59.999Z',
        page: 1,
        pageSize: 10,
      };
      const result = await service.list(query);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe(ENTRY_ID_4);

      expect(fakePrisma.findManyCalls[0]?.where?.action).toBe('tour.publish');
      expect(fakePrisma.findManyCalls[0]?.where?.entityType).toBe('Tour');
      expect(fakePrisma.findManyCalls[0]?.where?.userId).toBe(USER_ID_1);
      expect(fakePrisma.findManyCalls[0]?.where?.createdAt).toEqual({
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lte: new Date('2026-11-10T23:59:59.999Z'),
      });
    });
  });

  describe('Pagination et tri', () => {
    it('applique les valeurs par defaut de pagination (page 1, pageSize 50)', async () => {
      const result = await service.list({ page: 1, pageSize: 50 });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(4);

      expect(fakePrisma.findManyCalls[0]?.skip).toBe(0);
      expect(fakePrisma.findManyCalls[0]?.take).toBe(50);
    });

    it('calcule correctement skip et take pour la page 2 avec pageSize 2', async () => {
      const result = await service.list({ page: 2, pageSize: 2 });
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(2);

      expect(fakePrisma.findManyCalls[0]?.skip).toBe(2);
      expect(fakePrisma.findManyCalls[0]?.take).toBe(2);
    });

    it('trie par createdAt decroissant', async () => {
      const result = await service.list({ page: 1, pageSize: 50 });

      expect(fakePrisma.findManyCalls[0]?.orderBy).toEqual({ createdAt: 'desc' });

      const dates = result.items.map((item) => new Date(item.createdAt).getTime());
      expect(dates).toEqual([
        new Date('2026-11-05T12:00:00.000Z').getTime(),
        new Date('2026-11-01T12:00:00.000Z').getTime(),
        new Date('2026-10-15T12:00:00.000Z').getTime(),
        new Date('2026-10-01T12:00:00.000Z').getTime(),
      ]);
    });
  });

  describe('Requetes invalides (400 BadRequestException)', () => {
    it('refuse page < 1 avec 400 BadRequestException', async () => {
      const invalidQuery = { page: 0, pageSize: 50 };
      expect(AuditLogQuerySchema.safeParse(invalidQuery).success).toBe(false);
      await expect(service.list(invalidQuery)).rejects.toThrow(BadRequestException);
    });

    it('refuse pageSize > 100 avec 400 BadRequestException', async () => {
      const invalidQuery = { page: 1, pageSize: 150 };
      expect(AuditLogQuerySchema.safeParse(invalidQuery).success).toBe(false);
      await expect(service.list(invalidQuery)).rejects.toThrow(BadRequestException);
    });

    it('refuse from > to avec 400 BadRequestException', async () => {
      const invalidQuery = {
        page: 1,
        pageSize: 50,
        from: '2026-11-10T00:00:00.000Z',
        to: '2026-11-01T00:00:00.000Z',
      };
      expect(AuditLogQuerySchema.safeParse(invalidQuery).success).toBe(false);
      await expect(service.list(invalidQuery)).rejects.toThrow(BadRequestException);
    });

    it('refuse une action invalide avec 400 BadRequestException', async () => {
      const invalidQuery = {
        page: 1,
        pageSize: 50,
        action: 'invalid.action',
      };
      expect(AuditLogQuerySchema.safeParse(invalidQuery).success).toBe(false);
      await expect(service.list(invalidQuery)).rejects.toThrow(BadRequestException);
    });

    it('refuse un userId invalide avec 400 BadRequestException', async () => {
      const invalidQuery = {
        page: 1,
        pageSize: 50,
        userId: 'not-a-valid-uuid',
      };
      expect(AuditLogQuerySchema.safeParse(invalidQuery).success).toBe(false);
      await expect(service.list(invalidQuery)).rejects.toThrow(BadRequestException);
    });
  });
});
