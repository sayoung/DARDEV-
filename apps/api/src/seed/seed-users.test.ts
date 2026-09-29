import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { buildSeedUsers, SeedPasswordRejectedError } from './seed-users.js';

const PASSWORD = 'xplor-seed-dev-2026';
const HASH = '$argon2id$v=19$m=19456,t=2,p=1$seed';

describe('buildSeedUsers', () => {
  it('produit quatre rôles distincts, comptes actifs en français', () => {
    const users = buildSeedUsers(PASSWORD, HASH);
    const roles = users.map((user) => user.role);

    expect(roles).toEqual([Role.ADMIN, Role.EDITOR, Role.HOTEL_MANAGER, Role.PARTNER]);
    expect(new Set(roles).size).toBe(4);
    for (const user of users) {
      expect(user.active).toBe(true);
      expect(user.uiLang).toBe('fr');
      expect(user.passwordHash).toBe(HASH);
    }
  });

  it('utilise des emails uniques', () => {
    const emails = buildSeedUsers(PASSWORD, HASH).map((user) => user.email);

    expect(emails).toEqual([
      'admin@xplor.local',
      'editor@xplor.local',
      'manager@xplor.local',
      'partner@xplor.local',
    ]);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('refuse un mot de passe courant', () => {
    expect(() => {
      buildSeedUsers('password1234', HASH);
    }).toThrow(SeedPasswordRejectedError);
    expect(() => {
      buildSeedUsers('password1234', HASH);
    }).toThrow(/mots de passe courants/);
  });

  it('refuse un mot de passe trop court', () => {
    const tooShort = 'a'.repeat(11);

    expect(() => {
      buildSeedUsers(tooShort, HASH);
    }).toThrow(SeedPasswordRejectedError);

    try {
      buildSeedUsers(tooShort, HASH);
    } catch (error) {
      expect(error).toBeInstanceOf(SeedPasswordRejectedError);
      if (error instanceof SeedPasswordRejectedError) {
        expect(error.message).toContain('SEED_DEFAULT_PASSWORD');
        expect(error.message).toContain('12');
      }
    }
  });
});
