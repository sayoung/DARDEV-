/** Compteur et échéance de verrouillage d'un compte (F-90). */
export interface LockoutState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

const FAILURES_BEFORE_LOCK = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/** Vrai tant que `now` n'a pas dépassé `lockedUntil` (inclus). */
export function isLocked(user: LockoutState, now: Date): boolean {
  if (user.lockedUntil === null) {
    return false;
  }
  return now.getTime() <= user.lockedUntil.getTime();
}

/**
 * Incrémente le compteur d'échecs.
 * Au 10e échec consécutif, et à chaque échec suivant, `lockedUntil` vaut `now` + 15 min.
 */
export function registerFailure(user: LockoutState, now: Date): LockoutState {
  const failedLoginCount = user.failedLoginCount + 1;
  if (failedLoginCount < FAILURES_BEFORE_LOCK) {
    return { failedLoginCount, lockedUntil: null };
  }
  return {
    failedLoginCount,
    lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
  };
}

/** Connexion réussie : compteur à 0, verrou levé. */
export function registerSuccess(): LockoutState {
  return { failedLoginCount: 0, lockedUntil: null };
}
