import {
  PaginatedAuditLogResponseSchema,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
} from '@xplor/shared';
import { requestJson } from './client.js';

function formatTimestamp(value: string | Date): string | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value.toISOString();
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildAuditLogsQueryString(query: Partial<AuditLogQuery>): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) {
    params.set('page', query.page.toString());
  }
  if (query.pageSize !== undefined) {
    params.set('pageSize', query.pageSize.toString());
  }
  if (query.action !== undefined) {
    params.set('action', query.action);
  }
  if (query.entityType !== undefined && query.entityType.trim().length > 0) {
    params.set('entityType', query.entityType.trim());
  }
  if (query.userId !== undefined && query.userId.trim().length > 0) {
    params.set('userId', query.userId.trim());
  }
  if (query.from !== undefined) {
    const formattedFrom = formatTimestamp(query.from);
    if (formattedFrom !== undefined) {
      params.set('from', formattedFrom);
    }
  }
  if (query.to !== undefined) {
    const formattedTo = formatTimestamp(query.to);
    if (formattedTo !== undefined) {
      params.set('to', formattedTo);
    }
  }
  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : '';
}

export async function listAuditLogs(
  query: Partial<AuditLogQuery> = {},
): Promise<PaginatedAuditLogResponse> {
  const search = buildAuditLogsQueryString(query);
  return requestJson(`/api/v1/admin/audit${search}`, PaginatedAuditLogResponseSchema);
}
