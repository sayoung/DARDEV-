import {
  createSessionId,
  SESSION_IDLE_MS,
  type SessionRecord,
  type SessionStore,
} from './session-store.js';

type StoredSession = {
  data: SessionRecord;
  expiresAt: number;
};

/**
 * Réservé aux tests. Même contrat que Redis : clé opaque, inactivité de 8 h,
 * index par utilisateur.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();
  private readonly byUser = new Map<string, Set<string>>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  create(data: SessionRecord): Promise<string> {
    const id = this.allocateId();
    this.sessions.set(id, { data, expiresAt: this.now() + SESSION_IDLE_MS });
    const ids = this.byUser.get(data.userId) ?? new Set<string>();
    ids.add(id);
    this.byUser.set(data.userId, ids);
    return Promise.resolve(id);
  }

  get(id: string): Promise<SessionRecord | null> {
    const stored = this.live(id);
    return Promise.resolve(stored?.data ?? null);
  }

  touch(id: string): Promise<void> {
    const stored = this.live(id);
    if (stored) {
      stored.expiresAt = this.now() + SESSION_IDLE_MS;
    }
    return Promise.resolve();
  }

  destroy(id: string): Promise<void> {
    const stored = this.sessions.get(id);
    if (stored) {
      this.forget(id, stored.data.userId);
    }
    return Promise.resolve();
  }

  destroyAllForUser(userId: string): Promise<void> {
    const ids = this.byUser.get(userId);
    if (ids) {
      for (const id of ids) {
        this.sessions.delete(id);
      }
      this.byUser.delete(userId);
    }
    return Promise.resolve();
  }

  private allocateId(): string {
    let id = createSessionId();
    while (this.sessions.has(id)) {
      id = createSessionId();
    }
    return id;
  }

  /** Retire une session déjà expirée et retourne null. */
  private live(id: string): StoredSession | null {
    const stored = this.sessions.get(id);
    if (!stored) {
      return null;
    }
    if (stored.expiresAt <= this.now()) {
      this.forget(id, stored.data.userId);
      return null;
    }
    return stored;
  }

  private forget(id: string, userId: string): void {
    this.sessions.delete(id);
    const ids = this.byUser.get(userId);
    if (!ids) {
      return;
    }
    ids.delete(id);
    if (ids.size === 0) {
      this.byUser.delete(userId);
    }
  }
}
