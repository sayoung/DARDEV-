import { KioskStatusSchema, Role } from '@xplor/shared';
import type {
  KioskOfflineCandidate,
  KioskOfflineCheckDeps,
} from './kiosk-offline-check.js';

/**
 * Interface du magasin hors-ligne conforme aux dépendances de runKioskOfflineCheck (sans sendMail).
 */
export type KioskOfflineStore = Omit<KioskOfflineCheckDeps, 'sendMail'>;

/**
 * Ligne brute retournée par Prisma pour un kiosque non supprimé.
 */
export interface KioskOfflineKioskRow {
  id: string;
  label: string;
  status: string;
  lastHeartbeatAt: Date | null;
  lastOfflineAlertAt: Date | null;
  hotel: {
    name: string;
  };
}

/**
 * Ligne brute retournée par Prisma pour un administrateur actif.
 */
export interface KioskOfflineAdminUserRow {
  email: string;
}

/**
 * Sous-ensemble des méthodes de PrismaClient requises pour le contrôle hors-ligne (F-54).
 * PrismaClient implémente structurellement cette interface.
 */
export interface KioskOfflinePrismaClient {
  kiosk: {
    findMany(args: {
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
    }): Promise<KioskOfflineKioskRow[]>;
    update(args: {
      where: { id: string };
      data: { lastOfflineAlertAt: Date };
    }): Promise<unknown>;
  };
  user: {
    findMany(args: {
      where: {
        role: Role;
        active: boolean;
      };
      select: {
        email: true;
      };
    }): Promise<KioskOfflineAdminUserRow[]>;
  };
}

/**
 * Crée l'adaptateur Prisma pour le contrôle des kiosques hors-ligne (F-54).
 * Accepte une instance de PrismaClient ou un client simulant KioskOfflinePrismaClient.
 */
export function createPrismaKioskOfflineStore(
  prisma: KioskOfflinePrismaClient,
): KioskOfflineStore {
  return {
    async listKiosks(): Promise<KioskOfflineCandidate[]> {
      const rows = await prisma.kiosk.findMany({
        where: { deletedAt: null },
        select: {
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
        },
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.label,
        hotelName: row.hotel.name,
        status: KioskStatusSchema.parse(row.status),
        lastHeartbeatAt: row.lastHeartbeatAt,
        lastOfflineAlertAt: row.lastOfflineAlertAt,
      }));
    },

    async listAdminEmails(): Promise<string[]> {
      const rows = await prisma.user.findMany({
        where: {
          role: Role.ADMIN,
          active: true,
        },
        select: {
          email: true,
        },
      });

      return rows.map((row) => row.email);
    },

    async markAlerted(kioskId: string, at: Date): Promise<void> {
      await prisma.kiosk.update({
        where: { id: kioskId },
        data: {
          lastOfflineAlertAt: at,
        },
      });
    },
  };
}
