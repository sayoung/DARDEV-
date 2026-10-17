import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  KioskSchema,
  type Kiosk,
  type KioskDeviceType,
  type KioskStatus,
  type Principal,
} from '@xplor/shared';

import { canAccessHotel, scopeHotelIds } from '../auth/access-policy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeConnectionState } from './kiosk-state.js';

export interface KioskRow {
  id: string;
  label: string;
  hotelId: string;
  deviceType: KioskDeviceType;
  status: KioskStatus;
  enrollmentCode: string | null;
  enrollmentExpiresAt: Date | null;
  tokenHash: string | null;
  lastHeartbeatAt: Date | null;
  lastIp: string | null;
  appVersion: string | null;
  syncedManifestVersion: string | null;
  storageFreeMb: number | null;
  idleTimeoutSeconds: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KioskPrismaClient {
  kiosk: {
    findMany(args: {
      where: {
        deletedAt: null;
        hotelId?: { in: string[] };
      };
      orderBy: { label: 'asc' };
    }): Promise<KioskRow[]>;
    findFirst(args: {
      where: { id: string; deletedAt: null };
    }): Promise<KioskRow | null>;
  };
  selection: {
    findUnique(args: {
      where: { hotelId: string };
      select?: { version: true };
    }): Promise<{ version: number } | null>;
  };
}

@Injectable()
export class KioskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: KioskPrismaClient,
  ) {}

  async get(principal: Principal, id: string): Promise<Kiosk> {
    const row = await this.prisma.kiosk.findFirst({
      where: { id, deletedAt: null },
    });
    if (row === null || !canAccessHotel(principal, row.hotelId)) {
      throw new NotFoundException();
    }

    const selection = await this.prisma.selection.findUnique({
      where: { hotelId: row.hotelId },
      select: { version: true },
    });
    const expectedManifestVersion =
      selection === null ? null : String(selection.version);

    return toKioskResponse(row, expectedManifestVersion, new Date());
  }

  async list(principal: Principal): Promise<Kiosk[]> {
    const scope = scopeHotelIds(principal);
    const rows = await this.prisma.kiosk.findMany({
      where: {
        deletedAt: null,
        ...(scope === 'ALL' ? {} : { hotelId: { in: scope } }),
      },
      orderBy: { label: 'asc' },
    });

    const hotelIds = [...new Set(rows.map((row) => row.hotelId))];
    const selections = await Promise.all(
      hotelIds.map(async (hotelId) => {
        const selection = await this.prisma.selection.findUnique({
          where: { hotelId },
          select: { version: true },
        });
        return [hotelId, selection === null ? null : String(selection.version)] as const;
      }),
    );
    const expectedVersions = new Map(selections);
    const now = new Date();

    return rows.map((row) =>
      toKioskResponse(row, expectedVersions.get(row.hotelId) ?? null, now),
    );
  }
}

export function toKioskResponse(
  row: KioskRow,
  expectedManifestVersion: string | null,
  now: Date,
): Kiosk {
  return KioskSchema.parse({
    id: row.id,
    label: row.label,
    hotelId: row.hotelId,
    deviceType: row.deviceType,
    status: row.status,
    connectionState: computeConnectionState(row, expectedManifestVersion, now),
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    appVersion: row.appVersion,
    syncedManifestVersion: row.syncedManifestVersion,
    storageFreeMb: row.storageFreeMb,
    idleTimeoutSeconds: row.idleTimeoutSeconds,
    createdAt: row.createdAt.toISOString(),
  });
}
