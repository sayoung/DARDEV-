import type { PrismaClient } from '@prisma/client';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  createPrismaKioskOfflineStore,
  type KioskOfflineAdminUserRow,
  type KioskOfflineKioskRow,
  type KioskOfflinePrismaClient,
} from './kiosk-offline-repository.js';
import {
  runKioskOfflineCheck,
  type KioskOfflineMailMessage,
} from './kiosk-offline-check.js';

interface RecordedKioskFindManyArgs {
  where: { deletedAt: null };
  select: {
    id: true;
    label: true;
    status: true;
    lastHeartbeatAt: true;
    lastOfflineAlertAt: true;
    hotel: {
      select: {
        name: true;
      };
    };
  };
}

interface RecordedUserFindManyArgs {
  where: {
    role: Role;
    active: boolean;
  };
  select: {
    email: true;
  };
}

interface RecordedKioskUpdateArgs {
  where: { id: string };
  data: { lastOfflineAlertAt: Date };
}

interface FakePrismaHarness {
  fakePrisma: KioskOfflinePrismaClient;
  kioskFindManyCalls: RecordedKioskFindManyArgs[];
  userFindManyCalls: RecordedUserFindManyArgs[];
  kioskUpdateCalls: RecordedKioskUpdateArgs[];
}

interface FakePrismaOptions {
  kiosks?: KioskOfflineKioskRow[];
  admins?: KioskOfflineAdminUserRow[];
  findManyKiosksError?: Error;
  findManyUsersError?: Error;
  updateKioskError?: Error;
}

function createFakePrismaHarness(options: FakePrismaOptions = {}): FakePrismaHarness {
  const kioskFindManyCalls: RecordedKioskFindManyArgs[] = [];
  const userFindManyCalls: RecordedUserFindManyArgs[] = [];
  const kioskUpdateCalls: RecordedKioskUpdateArgs[] = [];

  const fakePrisma: KioskOfflinePrismaClient = {
    kiosk: {
      findMany: (args) => {
        kioskFindManyCalls.push(args);
        if (options.findManyKiosksError !== undefined) {
          return Promise.reject(options.findManyKiosksError);
        }
        return Promise.resolve(options.kiosks ?? []);
      },
      update: (args) => {
        kioskUpdateCalls.push(args);
        if (options.updateKioskError !== undefined) {
          return Promise.reject(options.updateKioskError);
        }
        return Promise.resolve({
          id: args.where.id,
          lastOfflineAlertAt: args.data.lastOfflineAlertAt,
        });
      },
    },
    user: {
      findMany: (args) => {
        userFindManyCalls.push(args);
        if (options.findManyUsersError !== undefined) {
          return Promise.reject(options.findManyUsersError);
        }
        return Promise.resolve(options.admins ?? []);
      },
    },
  };

  return {
    fakePrisma,
    kioskFindManyCalls,
    userFindManyCalls,
    kioskUpdateCalls,
  };
}

describe('createPrismaKioskOfflineStore (M5 F-54)', () => {
  describe('listKiosks', () => {
    it('filtre les kiosques non supprimés et applique la sélection attendue', async () => {
      const harness = createFakePrismaHarness({ kiosks: [] });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const kiosks = await store.listKiosks();

      expect(kiosks).toEqual([]);
      expect(harness.kioskFindManyCalls).toHaveLength(1);
      const call = harness.kioskFindManyCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.where).toEqual({ deletedAt: null });
        expect(call.select).toEqual({
          id: true,
          label: true,
          status: true,
          lastHeartbeatAt: true,
          lastOfflineAlertAt: true,
          hotel: {
            select: {
              name: true,
            },
          },
        });
      }
    });

    it('mappe correctement les champs Prisma vers KioskOfflineCandidate', async () => {
      const heartbeatDate = new Date('2026-10-18T00:00:00.000Z');
      const alertDate = new Date('2026-10-17T12:00:00.000Z');

      const rawRows: KioskOfflineKioskRow[] = [
        {
          id: '01990000-0000-7000-8000-000000000001',
          label: 'Kiosque Hall A',
          status: 'ACTIVE',
          lastHeartbeatAt: heartbeatDate,
          lastOfflineAlertAt: alertDate,
          hotel: {
            name: 'Hôtel Rabat Palace',
          },
        },
        {
          id: '01990000-0000-7000-8000-000000000002',
          label: 'Kiosque Salon VIP',
          status: 'PENDING',
          lastHeartbeatAt: null,
          lastOfflineAlertAt: null,
          hotel: {
            name: 'Hôtel Marina Bouregreg',
          },
        },
      ];

      const harness = createFakePrismaHarness({ kiosks: rawRows });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const result = await store.listKiosks();

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          id: '01990000-0000-7000-8000-000000000001',
          label: 'Kiosque Hall A',
          hotelName: 'Hôtel Rabat Palace',
          status: 'ACTIVE',
          lastHeartbeatAt: heartbeatDate,
          lastOfflineAlertAt: alertDate,
        },
        {
          id: '01990000-0000-7000-8000-000000000002',
          label: 'Kiosque Salon VIP',
          hotelName: 'Hôtel Marina Bouregreg',
          status: 'PENDING',
          lastHeartbeatAt: null,
          lastOfflineAlertAt: null,
        },
      ]);
    });

    it('propage une erreur lorsque prisma.kiosk.findMany échoue', async () => {
      const dbError = new Error('Database connection lost');
      const harness = createFakePrismaHarness({ findManyKiosksError: dbError });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      await expect(store.listKiosks()).rejects.toThrow('Database connection lost');
    });

    it('rejette si le statut retourné par Prisma est invalide selon Zod', async () => {
      const invalidStatusRow: KioskOfflineKioskRow = {
        id: '01990000-0000-7000-8000-000000000003',
        label: 'Kiosque Erroné',
        status: 'UNKNOWN_STATUS',
        lastHeartbeatAt: null,
        lastOfflineAlertAt: null,
        hotel: {
          name: 'Hôtel Test',
        },
      };

      const harness = createFakePrismaHarness({ kiosks: [invalidStatusRow] });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      await expect(store.listKiosks()).rejects.toThrow();
    });
  });

  describe('listAdminEmails', () => {
    it('filtre les utilisateurs de rôle ADMIN et actifs avec sélection email', async () => {
      const adminRows: KioskOfflineAdminUserRow[] = [
        { email: 'admin1@xplor.ma' },
        { email: 'admin2@xplor.ma' },
      ];

      const harness = createFakePrismaHarness({ admins: adminRows });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const emails = await store.listAdminEmails();

      expect(emails).toEqual(['admin1@xplor.ma', 'admin2@xplor.ma']);
      expect(harness.userFindManyCalls).toHaveLength(1);
      const call = harness.userFindManyCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.where).toEqual({
          role: Role.ADMIN,
          active: true,
        });
        expect(call.select).toEqual({
          email: true,
        });
      }
    });

    it('retourne un tableau vide lorsqu’aucun administrateur n’est présent', async () => {
      const harness = createFakePrismaHarness({ admins: [] });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const emails = await store.listAdminEmails();

      expect(emails).toEqual([]);
    });

    it('propage une erreur lorsque prisma.user.findMany échoue', async () => {
      const dbError = new Error('User table inaccessible');
      const harness = createFakePrismaHarness({ findManyUsersError: dbError });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      await expect(store.listAdminEmails()).rejects.toThrow('User table inaccessible');
    });
  });

  describe('markAlerted', () => {
    it('met à jour lastOfflineAlertAt pour le kiosque spécifié', async () => {
      const harness = createFakePrismaHarness();
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const alertTimestamp = new Date('2026-10-18T10:15:30.000Z');
      const targetKioskId = '01990000-0000-7000-8000-000000000099';

      await store.markAlerted(targetKioskId, alertTimestamp);

      expect(harness.kioskUpdateCalls).toHaveLength(1);
      const call = harness.kioskUpdateCalls[0];
      expect(call).toBeDefined();
      if (call !== undefined) {
        expect(call.where).toEqual({ id: targetKioskId });
        expect(call.data).toEqual({ lastOfflineAlertAt: alertTimestamp });
      }
    });

    it('supporte plusieurs appels successifs avec des identifiants et dates distincts', async () => {
      const harness = createFakePrismaHarness();
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      const date1 = new Date('2026-10-18T10:00:00.000Z');
      const date2 = new Date('2026-10-18T11:00:00.000Z');

      await store.markAlerted('kiosk-01', date1);
      await store.markAlerted('kiosk-02', date2);

      expect(harness.kioskUpdateCalls).toHaveLength(2);
      expect(harness.kioskUpdateCalls[0]).toEqual({
        where: { id: 'kiosk-01' },
        data: { lastOfflineAlertAt: date1 },
      });
      expect(harness.kioskUpdateCalls[1]).toEqual({
        where: { id: 'kiosk-02' },
        data: { lastOfflineAlertAt: date2 },
      });
    });

    it('propage une erreur si prisma.kiosk.update échoue', async () => {
      const updateError = new Error('Record to update not found');
      const harness = createFakePrismaHarness({ updateKioskError: updateError });
      const store = createPrismaKioskOfflineStore(harness.fakePrisma);

      await expect(
        store.markAlerted('kiosk-non-existent', new Date()),
      ).rejects.toThrow('Record to update not found');
    });
  });

  describe('intégration avec runKioskOfflineCheck', () => {
    it('permet à runKioskOfflineCheck d’exécuter le cycle complet avec le magasin', async () => {
      // 12:00:00Z à Casablanca
      const now = new Date('2026-10-17T12:00:00.000Z');
      // Heartbeat vieux de 2h30 (> 2h requis)
      const heartbeatOld = new Date(now.getTime() - 2.5 * 60 * 60 * 1000);

      const rawKiosks: KioskOfflineKioskRow[] = [
        {
          id: 'kiosk-offline-01',
          label: 'Kiosque Hall',
          status: 'ACTIVE',
          lastHeartbeatAt: heartbeatOld,
          lastOfflineAlertAt: null,
          hotel: {
            name: 'Hôtel Rabat',
          },
        },
      ];

      const rawAdmins: KioskOfflineAdminUserRow[] = [
        { email: 'admin@xplor.ma' },
      ];

      const harness = createFakePrismaHarness({
        kiosks: rawKiosks,
        admins: rawAdmins,
      });

      const store = createPrismaKioskOfflineStore(harness.fakePrisma);
      const sentMails: KioskOfflineMailMessage[] = [];

      const result = await runKioskOfflineCheck(
        {
          ...store,
          sendMail: (mail) => {
            sentMails.push(mail);
            return Promise.resolve();
          },
        },
        now,
      );

      expect(result.alerted).toEqual(['kiosk-offline-01']);
      expect(sentMails).toHaveLength(1);
      expect(sentMails[0]?.to).toBe('admin@xplor.ma');
      expect(sentMails[0]?.subject).toBe('[Xplor] Alerte : 1 kiosque hors ligne');

      // Vérifie que markAlerted a bien été appelé sur le faux Prisma
      expect(harness.kioskUpdateCalls).toHaveLength(1);
      expect(harness.kioskUpdateCalls[0]).toEqual({
        where: { id: 'kiosk-offline-01' },
        data: { lastOfflineAlertAt: now },
      });
    });

    it('accepte le type PrismaClient en paramètre', () => {
      const typeCheckFn = (prisma: PrismaClient) => createPrismaKioskOfflineStore(prisma);
      expect(typeof typeCheckFn).toBe('function');
    });
  });
});

