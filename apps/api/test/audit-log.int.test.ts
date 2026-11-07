import {
  ContractType,
  HotelStars,
  KioskDeviceType,
  PrismaClient,
  Role,
} from '@prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { readDatabaseUrlTest } from './global-setup.js';

const DiffSchema = z.object({
  before: z.object({
    status: z.string(),
    title: z.string(),
  }),
  after: z.object({
    status: z.string(),
    title: z.string(),
  }),
});

const prisma = new PrismaClient({
  datasourceUrl: readDatabaseUrlTest(),
  errorFormat: 'minimal',
});

const createdAuditLogIds: string[] = [];
const createdKioskIds: string[] = [];
const createdHotelIds: string[] = [];
const createdCityIds: string[] = [];
const createdUserIds: string[] = [];

async function cleanupTestData(): Promise<void> {
  if (createdAuditLogIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: createdAuditLogIds } },
    });
    createdAuditLogIds.length = 0;
  }
  if (createdKioskIds.length > 0) {
    await prisma.kiosk.deleteMany({
      where: { id: { in: createdKioskIds } },
    });
    createdKioskIds.length = 0;
  }
  if (createdHotelIds.length > 0) {
    await prisma.hotel.deleteMany({
      where: { id: { in: createdHotelIds } },
    });
    createdHotelIds.length = 0;
  }
  if (createdCityIds.length > 0) {
    await prisma.city.deleteMany({
      where: { id: { in: createdCityIds } },
    });
    createdCityIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    createdUserIds.length = 0;
  }
}

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  try {
    await cleanupTestData();
  } finally {
    await prisma.$disconnect();
  }
});

describe('AuditLog — test d’intégration ciblé (M8 F-91)', () => {
  it('crée un AuditLog avec userId et kioskId nuls et un diff JSON', async () => {
    const diffData = {
      before: { status: 'DRAFT', title: 'Visite ancienne' },
      after: { status: 'PUBLISHED', title: 'Visite validée' },
    };

    const created = await prisma.auditLog.create({
      data: {
        userId: null,
        kioskId: null,
        action: 'TOUR_PUBLISH',
        entityType: 'Tour',
        entityId: 'tour-test-uuid',
        diff: diffData,
        ip: '10.0.0.1',
      },
    });
    createdAuditLogIds.push(created.id);

    expect(created.id).toBeDefined();
    expect(typeof created.id).toBe('string');
    expect(created.userId).toBeNull();
    expect(created.kioskId).toBeNull();
    expect(created.action).toBe('TOUR_PUBLISH');
    expect(created.entityType).toBe('Tour');
    expect(created.entityId).toBe('tour-test-uuid');
    expect(created.ip).toBe('10.0.0.1');

    const fetched = await prisma.auditLog.findUnique({
      where: { id: created.id },
    });

    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error('AuditLog introuvable en base');
    }

    expect(fetched.userId).toBeNull();
    expect(fetched.kioskId).toBeNull();

    const parsedDiff = DiffSchema.safeParse(fetched.diff);
    expect(parsedDiff.success).toBe(true);
    if (parsedDiff.success) {
      expect(parsedDiff.data).toEqual(diffData);
    }
  });

  describe('comportement onDelete SetNull pour User et Kiosk liés', () => {
    it('met userId à NULL sans supprimer l’AuditLog lors de la suppression d’un User lié', async () => {
      const user = await prisma.user.create({
        data: {
          email: `audit-user-${Date.now().toString()}@xplor.local`,
          name: 'Utilisateur Audit Test',
          passwordHash: 'dummyhash',
          role: Role.EDITOR,
        },
      });
      createdUserIds.push(user.id);

      const log = await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          entityType: 'User',
          entityId: user.id,
          diff: {
            before: { status: 'OFFLINE', title: 'User' },
            after: { status: 'ONLINE', title: 'User' },
          },
        },
      });
      createdAuditLogIds.push(log.id);

      expect(log.userId).toBe(user.id);

      // Vérifie la relation inverse
      const userWithLogs = await prisma.user.findUnique({
        where: { id: user.id },
        include: { auditLogs: true },
      });
      expect(userWithLogs).not.toBeNull();
      if (userWithLogs) {
        expect(userWithLogs.auditLogs.some((entry) => entry.id === log.id)).toBe(true);
      }

      // Supprime l'utilisateur lié
      await prisma.user.delete({
        where: { id: user.id },
      });

      // L'audit log doit toujours exister avec userId mis à NULL
      const logAfterDelete = await prisma.auditLog.findUnique({
        where: { id: log.id },
      });

      expect(logAfterDelete).not.toBeNull();
      if (!logAfterDelete) {
        throw new Error('AuditLog supprimé à tort lors de la suppression de User');
      }
      expect(logAfterDelete.id).toBe(log.id);
      expect(logAfterDelete.userId).toBeNull();
      expect(logAfterDelete.action).toBe('USER_LOGIN');
    });

    it('met kioskId à NULL sans supprimer l’AuditLog lors de la suppression d’un Kiosk lié', async () => {
      const city = await prisma.city.create({
        data: {
          name: { fr: 'Ville Kiosk Test' },
          region: 'Rabat-Salé-Kénitra',
          lat: 34.020882,
          lng: -6.84165,
        },
      });
      createdCityIds.push(city.id);

      const hotel = await prisma.hotel.create({
        data: {
          name: `Hôtel Kiosk Audit ${Date.now().toString()}`,
          stars: HotelStars.FOUR,
          cityId: city.id,
          address: 'Avenue Mohammed V',
          phone: '+212537000000',
          email: `audit-kiosk-${Date.now().toString()}@hotel.ma`,
          brandColor: '#6958A5',
          contractType: ContractType.RENTAL,
          contractStart: new Date(),
          contractEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });
      createdHotelIds.push(hotel.id);

      const kiosk = await prisma.kiosk.create({
        data: {
          label: `Kiosque Test Audit ${Date.now().toString()}`,
          hotelId: hotel.id,
          deviceType: KioskDeviceType.TOUCH_SCREEN,
        },
      });
      createdKioskIds.push(kiosk.id);

      const log = await prisma.auditLog.create({
        data: {
          kioskId: kiosk.id,
          action: 'KIOSK_STATUS_CHANGE',
          entityType: 'Kiosk',
          entityId: kiosk.id,
          diff: {
            before: { status: 'PENDING', title: 'Kiosk' },
            after: { status: 'ACTIVE', title: 'Kiosk' },
          },
        },
      });
      createdAuditLogIds.push(log.id);

      expect(log.kioskId).toBe(kiosk.id);

      // Vérifie la relation inverse
      const kioskWithLogs = await prisma.kiosk.findUnique({
        where: { id: kiosk.id },
        include: { auditLogs: true },
      });
      expect(kioskWithLogs).not.toBeNull();
      if (kioskWithLogs) {
        expect(kioskWithLogs.auditLogs.some((entry) => entry.id === log.id)).toBe(true);
      }

      // Supprime le kiosque lié
      await prisma.kiosk.delete({
        where: { id: kiosk.id },
      });

      // L'audit log doit toujours exister avec kioskId mis à NULL
      const logAfterDelete = await prisma.auditLog.findUnique({
        where: { id: log.id },
      });

      expect(logAfterDelete).not.toBeNull();
      if (!logAfterDelete) {
        throw new Error('AuditLog supprimé à tort lors de la suppression de Kiosk');
      }
      expect(logAfterDelete.id).toBe(log.id);
      expect(logAfterDelete.kioskId).toBeNull();
      expect(logAfterDelete.action).toBe('KIOSK_STATUS_CHANGE');
    });

    it('gère un AuditLog lié à la fois à un User et un Kiosk lors de suppressions successives', async () => {
      const city = await prisma.city.create({
        data: {
          name: { fr: 'Ville Double Test' },
          region: 'Rabat-Salé-Kénitra',
          lat: 34.020882,
          lng: -6.84165,
        },
      });
      createdCityIds.push(city.id);

      const hotel = await prisma.hotel.create({
        data: {
          name: `Hôtel Double Audit ${Date.now().toString()}`,
          stars: HotelStars.FIVE,
          cityId: city.id,
          address: 'Avenue Hassan II',
          phone: '+212537000001',
          email: `audit-double-${Date.now().toString()}@hotel.ma`,
          brandColor: '#6958A5',
          contractType: ContractType.SALE,
          contractStart: new Date(),
          contractEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        },
      });
      createdHotelIds.push(hotel.id);

      const user = await prisma.user.create({
        data: {
          email: `audit-user-both-${Date.now().toString()}@xplor.local`,
          name: 'Admin Double Audit',
          passwordHash: 'dummyhash',
          role: Role.ADMIN,
        },
      });
      createdUserIds.push(user.id);

      const kiosk = await prisma.kiosk.create({
        data: {
          label: `Kiosque Double Audit ${Date.now().toString()}`,
          hotelId: hotel.id,
          deviceType: KioskDeviceType.TOUCH_SCREEN,
        },
      });
      createdKioskIds.push(kiosk.id);

      const log = await prisma.auditLog.create({
        data: {
          userId: user.id,
          kioskId: kiosk.id,
          action: 'KIOSK_CONFIG_UPDATE',
          entityType: 'Kiosk',
          entityId: kiosk.id,
        },
      });
      createdAuditLogIds.push(log.id);

      expect(log.userId).toBe(user.id);
      expect(log.kioskId).toBe(kiosk.id);

      // Suppression de l'utilisateur d'abord
      await prisma.user.delete({ where: { id: user.id } });

      const logAfterUser = await prisma.auditLog.findUnique({ where: { id: log.id } });
      expect(logAfterUser).not.toBeNull();
      if (!logAfterUser) {
        throw new Error('AuditLog disparu après suppression utilisateur');
      }
      expect(logAfterUser.userId).toBeNull();
      expect(logAfterUser.kioskId).toBe(kiosk.id);

      // Suppression du kiosque ensuite
      await prisma.kiosk.delete({ where: { id: kiosk.id } });

      const logAfterBoth = await prisma.auditLog.findUnique({ where: { id: log.id } });
      expect(logAfterBoth).not.toBeNull();
      if (!logAfterBoth) {
        throw new Error('AuditLog disparu après suppression kiosque');
      }
      expect(logAfterBoth.userId).toBeNull();
      expect(logAfterBoth.kioskId).toBeNull();
    });

    it('rejette la création d’un AuditLog avec un userId ou kioskId invalide (clé étrangère)', async () => {
      const invalidUuid = '00000000-0000-0000-0000-000000000000';

      await expect(
        prisma.auditLog.create({
          data: {
            userId: invalidUuid,
            action: 'INVALID_USER_ACTION',
            entityType: 'User',
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.auditLog.create({
          data: {
            kioskId: invalidUuid,
            action: 'INVALID_KIOSK_ACTION',
            entityType: 'Kiosk',
          },
        }),
      ).rejects.toThrow();
    });
  });

  it('renseigne createdAt automatiquement lors de la création', async () => {
    const beforeTimestamp = Date.now();

    const created = await prisma.auditLog.create({
      data: {
        action: 'HOTSPOT_CREATE',
        entityType: 'Hotspot',
        entityId: 'hotspot-test-uuid',
      },
    });
    createdAuditLogIds.push(created.id);

    const afterTimestamp = Date.now();

    expect(created.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(created.createdAt.getTime())).toBe(false);
    expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTimestamp - 1000);
    expect(created.createdAt.getTime()).toBeLessThanOrEqual(afterTimestamp + 1000);

    const fetched = await prisma.auditLog.findUnique({
      where: { id: created.id },
    });

    expect(fetched).not.toBeNull();
    if (!fetched) {
      throw new Error('AuditLog non trouvé');
    }

    expect(fetched.createdAt).toBeInstanceOf(Date);
    expect(fetched.createdAt.getTime()).toBe(created.createdAt.getTime());
  });
});
