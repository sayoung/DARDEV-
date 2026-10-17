import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  KioskCreateSchema,
  KioskSchema,
  Role,
  type Kiosk,
  type KioskCreate,
  type KioskDeviceType,
  type KioskStatus,
  type Principal,
} from '@xplor/shared';

import { canAccessHotel, scopeHotelIds } from '../auth/access-policy.js';
import { referenceException } from '../catalog/catalog.errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeConnectionState } from './kiosk-state.js';
import {
  KIOSK_HOTEL_INVALID,
  KIOSK_HOTEL_INVALID_MESSAGE,
} from './kiosks.errors.js';

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
  hotel: {
    findFirst(args: {
      where: { id: string; deletedAt: null };
    }): Promise<{ id: string } | null>;
  };
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
    create(args: {
      data: {
        label: string;
        hotelId: string;
        deviceType: KioskDeviceType;
        status: 'PENDING';
        idleTimeoutSeconds: number;
      };
    }): Promise<KioskRow>;
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

  async create(principal: Principal, input: KioskCreate): Promise<Kiosk> {
    if (principal.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    const valid = KioskCreateSchema.parse(input);
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: valid.hotelId, deletedAt: null },
    });
    if (hotel === null) {
      throw referenceException(KIOSK_HOTEL_INVALID, KIOSK_HOTEL_INVALID_MESSAGE);
    }
    const row = await this.prisma.kiosk.create({
      data: {
        label: valid.label,
        hotelId: valid.hotelId,
        deviceType: valid.deviceType,
        status: 'PENDING',
        idleTimeoutSeconds: valid.idleTimeoutSeconds ?? 90,
      },
    });
    return toKioskResponse(row, await this.expectedManifestVersion(row.hotelId), new Date());
  }

  async get(principal: Principal, id: string): Promise<Kiosk> {
    const row = await this.prisma.kiosk.findFirst({
      where: { id, deletedAt: null },
    });
    if (row === null || !canAccessHotel(principal, row.hotelId)) {
      throw new NotFoundException();
    }

    return toKioskResponse(
      row,
      await this.expectedManifestVersion(row.hotelId),
      new Date(),
    );
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
      hotelIds.map(async (hotelId) =>
        [hotelId, await this.expectedManifestVersion(hotelId)] as const,
      ),
    );
    const expectedVersions = new Map(selections);
    const now = new Date();

    return rows.map((row) =>
      toKioskResponse(row, expectedVersions.get(row.hotelId) ?? null, now),
    );
  }

  private async expectedManifestVersion(hotelId: string): Promise<string | null> {
    const selection = await this.prisma.selection.findUnique({
      where: { hotelId },
      select: { version: true },
    });
    return selection === null ? null : String(selection.version);
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
