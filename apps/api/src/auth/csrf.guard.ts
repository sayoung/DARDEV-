import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { readSessionId } from './session-cookie.js';
import type { SessionRequest } from './session-request.js';
import { SESSION_STORE, type SessionRecord, type SessionStore } from './session-store.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(SESSION_STORE) private readonly sessions: SessionStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const session = request.session ?? (await this.loadSession(request));
    const provided = readCsrfHeader(request.headers);
    if (!session || provided === null || !csrfTokensMatch(session.csrfToken, provided)) {
      throw new ForbiddenException();
    }
    return true;
  }

  private async loadSession(request: SessionRequest): Promise<SessionRecord | null> {
    const sessionId = readSessionId(request);
    if (sessionId === null) {
      return null;
    }
    return this.sessions.get(sessionId);
  }
}

function readCsrfHeader(
  headers: Partial<Record<string, string | string[] | undefined>>,
): string | null {
  const value = headers['x-csrf-token'];
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}

/** Comparaison en temps constant. Les longueurs différentes sont refusées sans lever d'exception. */
export function csrfTokensMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
}
