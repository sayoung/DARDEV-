import { describe, expect, it } from 'vitest';
import { Role } from '@xplor/shared';

import { decryptTotpSecret } from './totp-secret-cipher.js';
import { totpCode } from './totp.js';
import {
  TWO_FACTOR_INVALID_CODE,
  TWO_FACTOR_NOT_ENABLED,
  TWO_FACTOR_NOT_INITIALIZED,
  TWO_FACTOR_ROLE_NOT_ALLOWED,
  TWO_FACTOR_USER_NOT_FOUND,
  TwoFactorInvalidCodeError,
  TwoFactorNotEnabledError,
  TwoFactorNotInitializedError,
  TwoFactorRoleNotAllowedError,
  TwoFactorService,
  TwoFactorUserNotFoundError,
  type TwoFactorTotpUpdate,
  type TwoFactorUser,
  type TwoFactorUserRepository,
} from './two-factor.service.js';

const VALID_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

class FakeTwoFactorUserRepository implements TwoFactorUserRepository {
  private readonly users = new Map<string, TwoFactorUser>();

  addUser(user: TwoFactorUser): void {
    this.users.set(user.id, { ...user });
  }

  findById(id: string): Promise<TwoFactorUser | null> {
    const user = this.users.get(id);
    if (user === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ ...user });
  }

  updateTotp(id: string, update: TwoFactorTotpUpdate): Promise<void> {
    const user = this.users.get(id);
    if (user === undefined) {
      return Promise.reject(new Error(`User not found: ${id}`));
    }

    const nextTotpSecret = update.totpSecret !== undefined ? update.totpSecret : user.totpSecret;
    const nextTotpEnabled = update.totpEnabled !== undefined ? update.totpEnabled : user.totpEnabled;

    this.users.set(id, {
      ...user,
      totpSecret: nextTotpSecret,
      totpEnabled: nextTotpEnabled,
    });

    return Promise.resolve();
  }

  getStoredUser(id: string): TwoFactorUser | undefined {
    return this.users.get(id);
  }
}

describe('TwoFactorService', () => {
  const fixedTimeMs = 1_700_000_000_000;
  const clock = (): Date => new Date(fixedTimeMs);

  function createService(repo: TwoFactorUserRepository, key = VALID_KEY_HEX): TwoFactorService {
    return new TwoFactorService(repo, key, clock);
  }

  describe('cycle complet', () => {
    it('déroule avec succès beginSetup -> confirmSetup -> verifyLoginCode -> disable', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-1',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);

      // 1. beginSetup
      const setupResult = await service.beginSetup(admin.id, 'admin@xplor.ma');
      expect(setupResult.secret).toBeDefined();
      expect(setupResult.secret.length).toBeGreaterThan(0);
      expect(setupResult.otpauthUri).toContain('otpauth://totp/Xplor:admin%40xplor.ma');
      expect(setupResult.otpauthUri).toContain(`secret=${setupResult.secret}`);

      const userAfterBegin = repo.getStoredUser(admin.id);
      if (userAfterBegin === undefined) {
        throw new Error('User should exist');
      }
      expect(userAfterBegin.totpEnabled).toBe(false);
      expect(userAfterBegin.totpSecret).not.toBeNull();

      // Avant confirmation, verifyLoginCode doit renvoyer false
      const currentCode = totpCode(setupResult.secret, fixedTimeMs);
      const preConfirmLogin = await service.verifyLoginCode(admin.id, currentCode);
      expect(preConfirmLogin).toBe(false);

      // 2. confirmSetup avec le code valide
      await service.confirmSetup(admin.id, currentCode);

      const userAfterConfirm = repo.getStoredUser(admin.id);
      if (userAfterConfirm === undefined) {
        throw new Error('User should exist');
      }
      expect(userAfterConfirm.totpEnabled).toBe(true);

      // 3. verifyLoginCode avec code valide
      const loginValid = await service.verifyLoginCode(admin.id, currentCode);
      expect(loginValid).toBe(true);

      // 4. disable avec code valide
      await service.disable(admin.id, currentCode);

      const userAfterDisable = repo.getStoredUser(admin.id);
      if (userAfterDisable === undefined) {
        throw new Error('User should exist');
      }
      expect(userAfterDisable.totpEnabled).toBe(false);
      expect(userAfterDisable.totpSecret).toBeNull();

      // 5. verifyLoginCode après désactivation renvoie false
      const postDisableLogin = await service.verifyLoginCode(admin.id, currentCode);
      expect(postDisableLogin).toBe(false);
    });
  });

  describe('code erroné refusé', () => {
    it('refuse un mauvais code à la confirmation et laisse totpEnabled à false', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-2',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      await service.beginSetup(admin.id, 'admin@xplor.ma');

      await expect(service.confirmSetup(admin.id, '000000')).rejects.toThrow(TwoFactorInvalidCodeError);

      try {
        await service.confirmSetup(admin.id, '000000');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TwoFactorInvalidCodeError);
        if (error instanceof TwoFactorInvalidCodeError) {
          expect(error.code).toBe(TWO_FACTOR_INVALID_CODE);
          expect(error.statusCode).toBe(400);
        }
      }

      const storedUser = repo.getStoredUser(admin.id);
      if (storedUser === undefined) {
        throw new Error('User should exist');
      }
      expect(storedUser.totpEnabled).toBe(false);
    });

    it('refuse des codes malformés à la confirmation', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-malformed',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      await service.beginSetup(admin.id, 'admin@xplor.ma');

      await expect(service.confirmSetup(admin.id, '')).rejects.toThrow(TwoFactorInvalidCodeError);
      await expect(service.confirmSetup(admin.id, '12345')).rejects.toThrow(TwoFactorInvalidCodeError);
      await expect(service.confirmSetup(admin.id, '1234567')).rejects.toThrow(TwoFactorInvalidCodeError);
      await expect(service.confirmSetup(admin.id, 'abcdef')).rejects.toThrow(TwoFactorInvalidCodeError);
    });

    it('refuse un mauvais code à la désactivation et laisse le 2FA actif', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-3',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      const setup = await service.beginSetup(admin.id, 'admin@xplor.ma');
      const validCode = totpCode(setup.secret, fixedTimeMs);
      await service.confirmSetup(admin.id, validCode);

      await expect(service.disable(admin.id, '999999')).rejects.toThrow(TwoFactorInvalidCodeError);

      try {
        await service.disable(admin.id, '999999');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TwoFactorInvalidCodeError);
        if (error instanceof TwoFactorInvalidCodeError) {
          expect(error.code).toBe(TWO_FACTOR_INVALID_CODE);
          expect(error.statusCode).toBe(400);
        }
      }

      const storedUser = repo.getStoredUser(admin.id);
      if (storedUser === undefined) {
        throw new Error('User should exist');
      }
      expect(storedUser.totpEnabled).toBe(true);
      expect(storedUser.totpSecret).not.toBeNull();
    });

    it('renvoie false à verifyLoginCode lors d’un code erroné ou malformé', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-4',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      const setup = await service.beginSetup(admin.id, 'admin@xplor.ma');
      const validCode = totpCode(setup.secret, fixedTimeMs);
      await service.confirmSetup(admin.id, validCode);

      expect(await service.verifyLoginCode(admin.id, '000000')).toBe(false);
      expect(await service.verifyLoginCode(admin.id, '12345')).toBe(false);
      expect(await service.verifyLoginCode(admin.id, 'abcdef')).toBe(false);
      expect(await service.verifyLoginCode(admin.id, '')).toBe(false);
    });
  });

  describe('rôle non ADMIN refusé', () => {
    const nonAdminRoles: Role[] = [Role.EDITOR, Role.HOTEL_MANAGER, Role.PARTNER];

    for (const nonAdminRole of nonAdminRoles) {
      it(`refuse beginSetup pour le rôle ${nonAdminRole}`, async () => {
        const repo = new FakeTwoFactorUserRepository();
        const user: TwoFactorUser = {
          id: `user-${nonAdminRole}`,
          role: nonAdminRole,
          totpSecret: null,
          totpEnabled: false,
        };
        repo.addUser(user);

        const service = createService(repo);

        await expect(service.beginSetup(user.id, 'test@xplor.ma')).rejects.toThrow(
          TwoFactorRoleNotAllowedError,
        );

        try {
          await service.beginSetup(user.id, 'test@xplor.ma');
          expect.unreachable('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(TwoFactorRoleNotAllowedError);
          if (error instanceof TwoFactorRoleNotAllowedError) {
            expect(error.code).toBe(TWO_FACTOR_ROLE_NOT_ALLOWED);
            expect(error.statusCode).toBe(403);
          }
        }
      });

      it(`refuse confirmSetup pour le rôle ${nonAdminRole}`, async () => {
        const repo = new FakeTwoFactorUserRepository();
        const user: TwoFactorUser = {
          id: `user-${nonAdminRole}-confirm`,
          role: nonAdminRole,
          totpSecret: 'dummy-secret',
          totpEnabled: false,
        };
        repo.addUser(user);

        const service = createService(repo);

        await expect(service.confirmSetup(user.id, '123456')).rejects.toThrow(
          TwoFactorRoleNotAllowedError,
        );
      });

      it(`refuse disable pour le rôle ${nonAdminRole}`, async () => {
        const repo = new FakeTwoFactorUserRepository();
        const user: TwoFactorUser = {
          id: `user-${nonAdminRole}-disable`,
          role: nonAdminRole,
          totpSecret: 'dummy-secret',
          totpEnabled: true,
        };
        repo.addUser(user);

        const service = createService(repo);

        await expect(service.disable(user.id, '123456')).rejects.toThrow(
          TwoFactorRoleNotAllowedError,
        );
      });

      it(`refuse verifyLoginCode pour le rôle ${nonAdminRole}`, async () => {
        const repo = new FakeTwoFactorUserRepository();
        const user: TwoFactorUser = {
          id: `user-${nonAdminRole}-login`,
          role: nonAdminRole,
          totpSecret: 'dummy-secret',
          totpEnabled: true,
        };
        repo.addUser(user);

        const service = createService(repo);

        await expect(service.verifyLoginCode(user.id, '123456')).rejects.toThrow(
          TwoFactorRoleNotAllowedError,
        );
      });
    }
  });

  describe('secret jamais stocké en clair', () => {
    it('persiste une charge chiffrée AES-256-GCM et jamais le secret Base32 en clair', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-cipher',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      const setup = await service.beginSetup(admin.id, 'admin@xplor.ma');

      const storedUser = repo.getStoredUser(admin.id);
      if (storedUser === undefined) {
        throw new Error('User should exist');
      }
      if (storedUser.totpSecret === null) {
        throw new Error('totpSecret should not be null');
      }

      // Le secret stocké ne doit jamais être identique au secret Base32 en clair
      expect(storedUser.totpSecret).not.toBe(setup.secret);
      // Il ne doit pas non plus contenir le secret en sous-chaîne
      expect(storedUser.totpSecret.includes(setup.secret)).toBe(false);

      // Le format doit être iv:tag:cipher
      const parts = storedUser.totpSecret.split(':');
      expect(parts.length).toBe(3);

      // On doit pouvoir déchiffrer avec la clé valide et retrouver exactement le secret d'origine
      const decrypted = decryptTotpSecret(storedUser.totpSecret, VALID_KEY_HEX);
      expect(decrypted).toBe(setup.secret);
    });
  });

  describe('cas limites et erreurs métier', () => {
    it('lève TwoFactorUserNotFoundError si l’utilisateur est introuvable', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const service = createService(repo);

      await expect(service.beginSetup('unknown-id', 'test@xplor.ma')).rejects.toThrow(
        TwoFactorUserNotFoundError,
      );
      await expect(service.confirmSetup('unknown-id', '123456')).rejects.toThrow(
        TwoFactorUserNotFoundError,
      );
      await expect(service.disable('unknown-id', '123456')).rejects.toThrow(
        TwoFactorUserNotFoundError,
      );
      await expect(service.verifyLoginCode('unknown-id', '123456')).rejects.toThrow(
        TwoFactorUserNotFoundError,
      );

      try {
        await service.beginSetup('unknown-id', 'test@xplor.ma');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TwoFactorUserNotFoundError);
        if (error instanceof TwoFactorUserNotFoundError) {
          expect(error.code).toBe(TWO_FACTOR_USER_NOT_FOUND);
          expect(error.statusCode).toBe(404);
        }
      }
    });

    it('lève TwoFactorNotInitializedError si confirmSetup est appelé sans secret préalable', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-uninit',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);

      await expect(service.confirmSetup(admin.id, '123456')).rejects.toThrow(
        TwoFactorNotInitializedError,
      );

      try {
        await service.confirmSetup(admin.id, '123456');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TwoFactorNotInitializedError);
        if (error instanceof TwoFactorNotInitializedError) {
          expect(error.code).toBe(TWO_FACTOR_NOT_INITIALIZED);
          expect(error.statusCode).toBe(400);
        }
      }
    });

    it('lève TwoFactorNotEnabledError si disable est appelé alors que 2FA n’est pas actif', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-not-enabled',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);

      await expect(service.disable(admin.id, '123456')).rejects.toThrow(TwoFactorNotEnabledError);

      try {
        await service.disable(admin.id, '123456');
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TwoFactorNotEnabledError);
        if (error instanceof TwoFactorNotEnabledError) {
          expect(error.code).toBe(TWO_FACTOR_NOT_ENABLED);
          expect(error.statusCode).toBe(400);
        }
      }
    });

    it('renvoie false à verifyLoginCode si totpEnabled est false ou secret corrompu', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const adminWithCorruptSecret: TwoFactorUser = {
        id: 'admin-corrupt',
        role: Role.ADMIN,
        totpSecret: 'invalid:payload:format',
        totpEnabled: true,
      };
      repo.addUser(adminWithCorruptSecret);

      const service = createService(repo);
      const result = await service.verifyLoginCode(adminWithCorruptSecret.id, '123456');
      expect(result).toBe(false);
    });

    it('rejette une clé de chiffrement invalide à l’instanciation', () => {
      const repo = new FakeTwoFactorUserRepository();

      expect(() => new TwoFactorService(repo, 'short-key')).toThrow(/Invalid TOTP encryption key/);
      expect(() => new TwoFactorService(repo, 'z'.repeat(64))).toThrow(/Invalid TOTP encryption key/);
    });

    it('gère la fenêtre de tolérance temporelle (+/- 1 pas de 30 secondes)', async () => {
      const repo = new FakeTwoFactorUserRepository();
      const admin: TwoFactorUser = {
        id: 'admin-window',
        role: Role.ADMIN,
        totpSecret: null,
        totpEnabled: false,
      };
      repo.addUser(admin);

      const service = createService(repo);
      const setup = await service.beginSetup(admin.id, 'admin@xplor.ma');
      const stepMs = 30_000;

      const codeStepMinus1 = totpCode(setup.secret, fixedTimeMs - stepMs);
      const codeStepPlus1 = totpCode(setup.secret, fixedTimeMs + stepMs);
      const codeStepMinus2 = totpCode(setup.secret, fixedTimeMs - 2 * stepMs);
      const codeStepPlus2 = totpCode(setup.secret, fixedTimeMs + 2 * stepMs);

      // Confirmation avec le code du pas précédent (-1 step)
      await service.confirmSetup(admin.id, codeStepMinus1);

      // Vérification à +1 step acceptée
      expect(await service.verifyLoginCode(admin.id, codeStepPlus1)).toBe(true);

      // Vérification à -2 et +2 steps refusée
      expect(await service.verifyLoginCode(admin.id, codeStepMinus2)).toBe(false);
      expect(await service.verifyLoginCode(admin.id, codeStepPlus2)).toBe(false);
    });
  });
});
