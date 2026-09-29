import { randomBytes } from 'node:crypto';

/** Durée d'inactivité d'une session (F-90) : 8 heures, renouvelée par `touch`. */
export const SESSION_IDLE_SECONDS = 8 * 60 * 60;

export const SESSION_IDLE_MS = SESSION_IDLE_SECONDS * 1000;

/** Contenu stocké d'une session. `createdAt` est une date ISO 8601, inchangée par `touch`. */
export type SessionRecord = {
  userId: string;
  csrfToken: string;
  createdAt: string;
};

export interface SessionStore {
  /** Enregistre `data` et retourne l'identifiant de session. */
  create(data: SessionRecord): Promise<string>;
  get(id: string): Promise<SessionRecord | null>;
  /** Repousse l'échéance d'inactivité. Sans effet si la session est absente ou déjà expirée. */
  touch(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  destroyAllForUser(userId: string): Promise<void>;
}

export const SESSION_STORE = Symbol('SESSION_STORE');

/** 32 octets aléatoires, encodés en base64url (sans remplissage). */
export function createSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionKey(id: string): string {
  return `sess:${id}`;
}

/** Set Redis des identifiants de session d'un utilisateur. */
export function userSessionsKey(userId: string): string {
  return `user-sess:${userId}`;
}

export function parseSession(raw: string): SessionRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  return isSessionRecord(value) ? value : null;
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('userId' in value) || !('csrfToken' in value) || !('createdAt' in value)) {
    return false;
  }
  return (
    typeof value.userId === 'string' &&
    typeof value.csrfToken === 'string' &&
    typeof value.createdAt === 'string'
  );
}

/** Sous-ensemble d'ioredis utilisé par `RedisSessionStore`. */
export type SessionRedis = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: 'EX', seconds: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<number>;
  del(...keys: string[]): Promise<number>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
};
