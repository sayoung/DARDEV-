import type { Principal } from '@xplor/shared';

import type { SessionRecord } from './session-store.js';

/** Requête HTTP vue par les guards. `principal` est posé par `SessionGuard`. */
export type SessionRequest = {
  method: string;
  cookies?: Partial<Record<string, string | undefined>>;
  headers: Partial<Record<string, string | string[] | undefined>>;
  principal?: Principal;
  session?: SessionRecord;
  sessionId?: string;
};
