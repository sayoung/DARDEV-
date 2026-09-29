import { describe, expect, it } from 'vitest';

import { isLocked, registerFailure, registerSuccess, type LockoutState } from './lockout.js';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const NOW = new Date('2026-09-29T12:00:00.000Z');

function fresh(): LockoutState {
  return { failedLoginCount: 0, lockedUntil: null };
}

function failTimes(count: number, now: Date): LockoutState {
  let user = fresh();
  for (let i = 0; i < count; i += 1) {
    user = registerFailure(user, now);
  }
  return user;
}

describe('registerFailure', () => {
  it('ne verrouille pas après 9 échecs', () => {
    const user = failTimes(9, NOW);

    expect(user.failedLoginCount).toBe(9);
    expect(user.lockedUntil).toBeNull();
    expect(isLocked(user, NOW)).toBe(false);
  });

  it('verrouille 15 min au 10e échec', () => {
    const user = failTimes(10, NOW);
    const deadline = new Date(NOW.getTime() + FIFTEEN_MIN_MS);

    expect(user.failedLoginCount).toBe(10);
    expect(user.lockedUntil).toEqual(deadline);
    expect(isLocked(user, NOW)).toBe(true);
    expect(isLocked(user, deadline)).toBe(true);
  });

  it('considère le verrou expiré à now + 15 min + 1 ms', () => {
    const user = failTimes(10, NOW);
    const expiredAt = new Date(NOW.getTime() + FIFTEEN_MIN_MS + 1);

    expect(isLocked(user, expiredAt)).toBe(false);
  });
});

describe('registerSuccess', () => {
  it('remet le compteur à 0 et lockedUntil à null', () => {
    const reset = registerSuccess();

    expect(reset).toEqual({ failedLoginCount: 0, lockedUntil: null });
    expect(isLocked(reset, NOW)).toBe(false);
  });
});
