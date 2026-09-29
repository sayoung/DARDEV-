import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { z, type ZodType } from 'zod';

import { canManageCatalog } from '../auth/access-policy.js';
import type { SessionRequest } from '../auth/session-request.js';

/** Écriture API-25 : ADMIN et EDITOR. La lecture ne passe pas par ici. */
export function requireCatalogWriter(request: SessionRequest): void {
  const principal = request.principal;
  if (principal === undefined || !canManageCatalog(principal)) {
    throw new ForbiddenException();
  }
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
