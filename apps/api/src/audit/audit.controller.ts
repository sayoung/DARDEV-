import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  AuditLogQuerySchema,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
} from '@xplor/shared';
import { z } from 'zod';

import { canViewAuditLogs } from '../auth/access-policy.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AuditQueryService } from './audit-query.service.js';

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function parseQueryNumber(value: unknown): unknown {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : Number.NaN;
  }
  if (isUnknownArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') {
      const trimmed = first.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : Number.NaN;
    }
  }
  return value;
}

function parseQueryString(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (isUnknownArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') {
      const trimmed = first.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
  }
  return value;
}

export function parseAuditLogQuery(query: unknown): AuditLogQuery {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    throw new BadRequestException('Paramètres de requête d’audit invalides');
  }
  const recordResult = z.record(z.string(), z.unknown()).safeParse(query);
  if (!recordResult.success) {
    throw new BadRequestException('Paramètres de requête d’audit invalides');
  }
  const raw = recordResult.data;
  const normalized: Record<string, unknown> = {};

  const page = parseQueryNumber(raw.page);
  if (page !== undefined) {
    normalized.page = page;
  }

  const pageSize = parseQueryNumber(raw.pageSize);
  if (pageSize !== undefined) {
    normalized.pageSize = pageSize;
  }

  const action = parseQueryString(raw.action);
  if (action !== undefined) {
    normalized.action = action;
  }

  const entityType = parseQueryString(raw.entityType);
  if (entityType !== undefined) {
    normalized.entityType = entityType;
  }

  const userId = parseQueryString(raw.userId);
  if (userId !== undefined) {
    normalized.userId = userId;
  }

  if (raw.from instanceof Date) {
    normalized.from = raw.from;
  } else {
    const from = parseQueryString(raw.from);
    if (from !== undefined) {
      normalized.from = from;
    }
  }

  if (raw.to instanceof Date) {
    normalized.to = raw.to;
  } else {
    const to = parseQueryString(raw.to);
    if (to !== undefined) {
      normalized.to = to;
    }
  }

  const validated = AuditLogQuerySchema.safeParse(normalized);
  if (!validated.success) {
    throw new BadRequestException('Paramètres de requête d’audit invalides');
  }
  return validated.data;
}

@Controller('admin/audit')
@UseGuards(SessionGuard, CsrfGuard)
export class AuditController {
  constructor(
    @Inject(AuditQueryService)
    private readonly auditQueryService: AuditQueryService,
  ) {}

  @Get()
  async list(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<PaginatedAuditLogResponse> {
    const principal = request.principal;
    if (principal === undefined) {
      throw new UnauthorizedException();
    }
    if (!canViewAuditLogs(principal)) {
      throw new ForbiddenException();
    }

    const validatedQuery = parseAuditLogQuery(query);
    return this.auditQueryService.list(validatedQuery);
  }
}
