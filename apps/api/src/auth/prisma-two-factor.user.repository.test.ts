import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  PrismaTwoFactorUserRepository,
  type TwoFactorPrismaClient,
} from './prisma-two-factor.user.repository.js';

describe('PrismaTwoFactorUserRepository', () => {
  describe('findById', () => {
    it('renvoie les détails 2FA de l utilisateur avec le rôle partagé mappé', async () => {
      let inspectedWhere: { id: string } | undefined;
      let inspectedSelect: unknown;

      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: (args) => {
            inspectedWhere = args.where;
            inspectedSelect = args.select;
            return Promise.resolve({
              id: 'user-admin-1',
              role: PrismaRole.ADMIN,
              totpSecret: 'encrypted-secret-hex',
              totpEnabled: true,
            });
          },
          update: () => Promise.resolve({}),
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      const user = await repository.findById('user-admin-1');

      expect(inspectedWhere).toEqual({ id: 'user-admin-1' });
      expect(inspectedSelect).toEqual({
        id: true,
        role: true,
        totpSecret: true,
        totpEnabled: true,
      });
      expect(user).toEqual({
        id: 'user-admin-1',
        role: Role.ADMIN,
        totpSecret: 'encrypted-secret-hex',
        totpEnabled: true,
      });
    });

    it('mappe correctement un rôle non-ADMIN et des champs 2FA non configurés', async () => {
      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () =>
            Promise.resolve({
              id: 'user-manager-2',
              role: PrismaRole.HOTEL_MANAGER,
              totpSecret: null,
              totpEnabled: false,
            }),
          update: () => Promise.resolve({}),
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      const user = await repository.findById('user-manager-2');

      expect(user).toEqual({
        id: 'user-manager-2',
        role: Role.HOTEL_MANAGER,
        totpSecret: null,
        totpEnabled: false,
      });
    });

    it('renvoie null si l utilisateur est introuvable', async () => {
      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: () => Promise.resolve({}),
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      const user = await repository.findById('inconnu');

      expect(user).toBeNull();
    });
  });

  describe('updateTotp', () => {
    it('met à jour totpSecret et totpEnabled ensemble', async () => {
      let capturedWhere: { id: string } | undefined;
      let capturedData: unknown;

      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: (args) => {
            capturedWhere = args.where;
            capturedData = args.data;
            return Promise.resolve({});
          },
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      await repository.updateTotp('user-1', {
        totpSecret: 'enc-new-secret',
        totpEnabled: true,
      });

      expect(capturedWhere).toEqual({ id: 'user-1' });
      expect(capturedData).toEqual({
        totpSecret: 'enc-new-secret',
        totpEnabled: true,
      });
    });

    it('met à jour uniquement totpSecret', async () => {
      let capturedData: unknown;

      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: (args) => {
            capturedData = args.data;
            return Promise.resolve({});
          },
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      await repository.updateTotp('user-1', {
        totpSecret: 'enc-secret-only',
      });

      expect(capturedData).toEqual({
        totpSecret: 'enc-secret-only',
      });
    });

    it('met à jour uniquement totpEnabled', async () => {
      let capturedData: unknown;

      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: (args) => {
            capturedData = args.data;
            return Promise.resolve({});
          },
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      await repository.updateTotp('user-1', {
        totpEnabled: false,
      });

      expect(capturedData).toEqual({
        totpEnabled: false,
      });
    });

    it('autorise la réinitialisation de totpSecret à null', async () => {
      let capturedData: unknown;

      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: (args) => {
            capturedData = args.data;
            return Promise.resolve({});
          },
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      await repository.updateTotp('user-1', {
        totpSecret: null,
        totpEnabled: false,
      });

      expect(capturedData).toEqual({
        totpSecret: null,
        totpEnabled: false,
      });
    });

    it('propage les erreurs de mise à jour', async () => {
      const mockClient: TwoFactorPrismaClient = {
        user: {
          findUnique: () => Promise.resolve(null),
          update: () => Promise.reject(new Error('Database connection failed')),
        },
      };

      const repository = new PrismaTwoFactorUserRepository(mockClient);
      await expect(
        repository.updateTotp('user-1', { totpEnabled: true }),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
