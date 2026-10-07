import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AssetListQuerySchema,
  TourListQuerySchema,
  type AssetListQuery,
  type Principal,
  type TourListQuery,
} from '@xplor/shared';
import { z, type ZodType } from 'zod';

import { canManageCatalog, canManageContent } from '../auth/access-policy.js';
import type { SessionRequest } from '../auth/session-request.js';

/** Écriture API-25 : ADMIN et EDITOR. La lecture ne passe pas par ici. */
export function requireCatalogWriter(request: SessionRequest): void {
  const principal = request.principal;
  if (principal === undefined || !canManageCatalog(principal)) {
    throw new ForbiddenException();
  }
}

/**
 * Lecture et écriture des visites, scènes, hotspots et médias (F-05).
 * ADMIN et EDITOR seulement (API-21, API-22, API-23).
 */
export function requireContentManager(request: SessionRequest): Principal {
  const principal = request.principal;
  if (principal === undefined || !canManageContent(principal)) {
    throw new ForbiddenException();
  }
  return principal;
}

/**
 * Query string de `GET /admin/tours`.
 * `page` et `pageSize` arrivent en chaînes : `PaginationQuery` attend des nombres (D-67).
 */
export function parseTourListQuery(query: Record<string, unknown>): TourListQuery {
  const raw: Record<string, unknown> = {};
  const page = queryNumber(query.page);
  if (page !== undefined) {
    raw.page = page;
  }
  const pageSize = queryNumber(query.pageSize);
  if (pageSize !== undefined) {
    raw.pageSize = pageSize;
  }
  assignString(raw, 'status', query.status);
  assignString(raw, 'cityId', query.cityId);
  assignString(raw, 'categoryId', query.categoryId);
  assignString(raw, 'q', query.q);
  return parseBody(TourListQuerySchema, raw);
}

/**
 * Query string de `GET /admin/assets`.
 * `page` et `pageSize` arrivent en chaînes : `PaginationQuery` attend des nombres (D-67).
 */
export function parseAssetListQuery(query: Record<string, unknown>): AssetListQuery {
  const raw: Record<string, unknown> = {};
  const page = queryNumber(query.page);
  if (page !== undefined) {
    raw.page = page;
  }
  const pageSize = queryNumber(query.pageSize);
  if (pageSize !== undefined) {
    raw.pageSize = pageSize;
  }
  assignString(raw, 'kind', query.kind);
  assignString(raw, 'tourId', query.tourId);
  assignString(raw, 'unused', query.unused);
  return parseBody(AssetListQuerySchema, raw);
}

/** Même mécanisme que l'auth : `safeParse`, puis 400 sans détail de champ. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException();
  }
  return parsed.data;
}

const resourceId = z.uuidv7();

export function parseResourceId(raw: string): string {
  const parsed = resourceId.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestException();
  }
  return parsed.data;
}

function queryNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value;
  }
  const text = firstString(value);
  if (text === undefined) {
    return undefined;
  }
  return Number(text);
}

function assignString(raw: Record<string, unknown>, key: string, value: unknown): void {
  const text = firstString(value);
  if (text !== undefined) {
    raw[key] = text;
  }
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}
