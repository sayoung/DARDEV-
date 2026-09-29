import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { DUMMY_PASSWORD_HASH } from './dummy-password.js';
import {
  isCommonPassword,
  PasswordService,
  PasswordTooCommonError,
  validateNewPassword,
} from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hache en argon2id puis vérifie', async () => {
    const plain = 'phrase-secrete-xplor';
    const hashed = await service.hash(plain);

    expect(hashed.startsWith('$argon2id$')).toBe(true);
    expect(hashed).not.toBe(plain);
    expect(await service.verify(hashed, plain)).toBe(true);
  });

  it('refuse un mauvais mot de passe', async () => {
    const hashed = await service.hash('phrase-secrete-xplor');

    expect(await service.verify(hashed, 'autre-phrase-secrete')).toBe(false);
  });

  it('vérifie le hash factice précalculé pour un email inconnu', async () => {
    expect(DUMMY_PASSWORD_HASH.startsWith('$argon2id$')).toBe(true);
    expect(await service.verify(DUMMY_PASSWORD_HASH, 'xplor-dummy-unknown-email')).toBe(true);
    expect(await service.verify(DUMMY_PASSWORD_HASH, 'autre-phrase-secrete')).toBe(false);
  });
});

describe('validateNewPassword', () => {
  it("refuse 'password1234' comme courant", () => {
    expect(isCommonPassword('password1234')).toBe(true);
    expect(isCommonPassword('Password1234')).toBe(true);

    expect(() => {
      validateNewPassword('password1234');
    }).toThrow(PasswordTooCommonError);

    try {
      validateNewPassword('password1234');
    } catch (error) {
      expect(error).toBeInstanceOf(PasswordTooCommonError);
      if (error instanceof PasswordTooCommonError) {
        expect(error.code).toBe('PASSWORD_TOO_COMMON');
      }
    }
  });

  it('applique PasswordSchema avant la liste des mots courants', () => {
    expect(() => {
      validateNewPassword('a'.repeat(11));
    }).toThrow();
    try {
      validateNewPassword('a'.repeat(11));
    } catch (error) {
      expect(error).not.toBeInstanceOf(PasswordTooCommonError);
    }
  });

  it("accepte un mot de passe long qui n'est pas courant", () => {
    expect(isCommonPassword('xplor-kiosque-rabat-2026')).toBe(false);
    expect(() => {
      validateNewPassword('xplor-kiosque-rabat-2026');
    }).not.toThrow();
  });
});
