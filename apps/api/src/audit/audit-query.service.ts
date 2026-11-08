import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditLogEntrySchema,
  AuditLogQuerySchema,
  PaginatedAuditLogResponseSchema,
  type AuditLogEntry,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  kioskId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  createdAt: Date | string;
}

export interface AuditFindManyArgs {
  where?: Prisma.AuditLogWhereInput;
  orderBy?: Prisma.AuditLogOrderByWithRelationInput | Prisma.AuditLogOrderByWithRelationInput[];
  skip?: number;
  take?: number;
}

export interface AuditCountArgs {
  where?: Prisma.AuditLogWhereInput;
}

export interface AuditQueryPrismaClient {
  auditLog: {
    findMany(args?: AuditFindManyArgs): Promise<AuditLogRecord[]>;
    count(args?: AuditCountArgs): Promise<number>;
  };
}

export function toAuditLogEntry(record: AuditLogRecord): AuditLogEntry {
  const createdAtIso =
    record.createdAt instanceof Date
      ? record.createdAt.toISOString()
      : record.createdAt;

  return AuditLogEntrySchema.parse({
    id: record.id,
    userId: record.userId ?? null,
    kioskId: record.kioskId ?? null,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId ?? null,
    diff: record.diff ?? null,
    ip: record.ip ?? null,
    createdAt: createdAtIso,
  });
}

export function buildAuditWhereInput(query: AuditLogQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.action !== undefined) {
    where.action = query.action;
  }
  if (query.entityType !== undefined) {
    where.entityType = query.entityType;
  }
  if (query.userId !== undefined) {
    where.userId = query.userId;
  }
  if (query.from !== undefined || query.to !== undefined) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.from !== undefined) {
      createdAtFilter.gte = typeof query.from === 'string' ? new Date(query.from) : query.from;
    }
    if (query.to !== undefined) {
      createdAtFilter.lte = typeof query.to === 'string' ? new Date(query.to) : query.to;
    }
    where.createdAt = createdAtFilter;
  }

  return where;
}

@Injectable()
export class AuditQueryService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: AuditQueryPrismaClient,
  ) {}

  async list(query: unknown): Promise<PaginatedAuditLogResponse> {
    const validated = AuditLogQuerySchema.safeParse(query);
    if (!validated.success) {
      throw new BadRequestException('Paramètres de requête d’audit invalides');
    }
    const validQuery = validated.data;
    const where = buildAuditWhereInput(validQuery);

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (validQuery.page - 1) * validQuery.pageSize,
        take: validQuery.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items: AuditLogEntry[] = records.map((record) => toAuditLogEntry(record));

    return PaginatedAuditLogResponseSchema.parse({
      items,
      total,
      page: validQuery.page,
      pageSize: validQuery.pageSize,
    });
  }
}
