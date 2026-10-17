import { ForbiddenException, HttpException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  KioskCreateSchema,
  KioskSchema,
  KioskUpdateSchema,
  Role,
  type Kiosk,
  type KioskCreate,
  type KioskUpdate,
  type KioskDeviceType,
  type KioskStatus,
  type EnrollmentCodeResponse,
  type KioskEnrollRequest,
  type KioskEnrollResponse,
  type KioskManifest,
  type KioskHeartbeatRequest,
  type KioskHeartbeatResponse,
  type Principal,
  LocalizedTextSchema,
} from '@xplor/shared';

import { canAccessHotel, scopeHotelIds } from '../auth/access-policy.js';
import {
  isRecordMissing,
  missingException,
  referenceException,
} from '../catalog/catalog.errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeConnectionState } from './kiosk-state.js';
import { buildManifest } from './manifest-builder.js';
import type { KioskDevice } from './kiosk-token.guard.js';
import {
  KIOSK_HOTEL_INVALID,
  KIOSK_HOTEL_INVALID_MESSAGE,
  KIOSK_ENROLLMENT_INVALID,
  KIOSK_ENROLLMENT_INVALID_MESSAGE,
  KIOSK_NOT_FOUND,
  KIOSK_NOT_FOUND_MESSAGE,
} from './kiosks.errors.js';
import {
  computeEnrollmentExpiry,
  generateDeviceToken,
  generateEnrollmentCode,
  hashDeviceToken,
} from './kiosk-secrets.js';

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
  forceSyncRequestedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ManifestHotelRow {
  id: string;
  name: string;
  brandColor: string;
  languages: string[];
  active: boolean;
  logoAssetId: string | null;
  maintenancePinHash: string | null;
  logoAsset: { id: string } | null;
}

interface ManifestSelectionRow {
  version: number;
  featuredTourId: string | null;
  attractTourIds: string[];
  items: {
    tourId: string;
    position: number;
    tour: { contentVersion: number; status: 'DRAFT' | 'PUBLISHED'; deletedAt: Date | null };
  }[];
}

interface ManifestCategoryRow {
  id: string;
  name: unknown;
  icon: string;
  color: string;
}

export interface KioskPrismaClient {
  hotel: {
    findFirst(args: {
      where: { id: string; deletedAt: null };
      include?: { logoAsset: true };
    }): Promise<ManifestHotelRow | null>;
  };
  kiosk: {
    findUnique(args: {
      where: { id: string; deletedAt: null };
  }): Promise<Pick<KioskRow,
    | 'id'
    | 'label'
    | 'hotelId'
    | 'deviceType'
    | 'idleTimeoutSeconds'
    | 'forceSyncRequestedAt'
    | 'lastHeartbeatAt'
    | 'appVersion'
    | 'syncedManifestVersion'
    | 'storageFreeMb'
  > | null>;
    findMany(args: {
      where: {
        deletedAt: null;
        hotelId?: { in: string[] };
      };
      orderBy: { label: 'asc' };
    }): Promise<KioskRow[]>;
    findFirst(args: {
      where: {
        id?: string;
        tokenHash?: string;
        deletedAt: null;
        status?: 'PENDING';
        enrollmentCode?: string;
        enrollmentExpiresAt?: { gt: Date };
      };
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
    update(args: {
      where: { id: string };
      data: Partial<Pick<KioskRow,
        | 'label'
        | 'deviceType'
        | 'idleTimeoutSeconds'
        | 'deletedAt'
        | 'status'
        | 'tokenHash'
        | 'enrollmentCode'
        | 'enrollmentExpiresAt'
        | 'lastIp'
        | 'lastHeartbeatAt'
        | 'appVersion'
        | 'syncedManifestVersion'
        | 'storageFreeMb'
        | 'forceSyncRequestedAt'
      >>;
    }): Promise<KioskRow>;
    updateMany(args: {
      where: {
        id: string;
        deletedAt: null;
        status: 'PENDING';
        enrollmentCode: string;
        enrollmentExpiresAt: { gt: Date };
      };
      data: {
        status: 'ACTIVE';
        tokenHash: string;
        enrollmentCode: null;
        enrollmentExpiresAt: null;
        lastIp: string | null;
      };
    }): Promise<{ count: number }>;
  };
  selection: {
    findUnique(args: {
      where: { hotelId: string };
      select?: { version: true };
      include?: {
        items: {
          include: { tour: { select: { contentVersion: true; status: true; deletedAt: true } } };
        };
      };
    }): Promise<{
      version: number;
      featuredTourId?: string | null;
      attractTourIds?: string[];
      items?: ManifestSelectionRow['items'];
    } | null>;
  };
  category: {
    findMany(args: { orderBy: { weight: 'asc' } }): Promise<ManifestCategoryRow[]>;
  };
}

@Injectable()
export class KioskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: KioskPrismaClient,
  ) {}

  async authenticateDevice(token: string): Promise<Pick<KioskRow, 'id' | 'hotelId' | 'status'> | null> {
    const kiosk = await this.prisma.kiosk.findFirst({
      where: { tokenHash: hashDeviceToken(token), deletedAt: null },
    });
    if (kiosk === null) {
      return null;
    }
    return { id: kiosk.id, hotelId: kiosk.hotelId, status: kiosk.status };
  }

  async getManifest(device: KioskDevice): Promise<KioskManifest> {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { id: device.kioskId, deletedAt: null },
    });
    if (kiosk === null || kiosk.hotelId !== device.hotelId) {
      throw this.notFound();
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: device.hotelId, deletedAt: null },
      include: { logoAsset: true },
    });
    if (hotel === null) {
      throw this.notFound();
    }

    const [selection, categories] = await Promise.all([
      this.prisma.selection.findUnique({
        where: { hotelId: device.hotelId },
        include: {
          items: {
            include: { tour: { select: { contentVersion: true, status: true, deletedAt: true } } },
          },
        },
      }),
      this.prisma.category.findMany({ orderBy: { weight: 'asc' } }),
    ]);

    const manifest = buildManifest({
      kiosk,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        logoUrl: null,
        brandColor: hotel.brandColor,
        languages: hotel.languages,
        active: hotel.active,
        logoAssetId: hotel.logoAssetId,
        maintenancePinHash: hotel.maintenancePinHash,
      },
      selection: {
        version: selection?.version ?? 1,
        featuredTourId: selection?.featuredTourId ?? null,
        attractTourIds: selection?.attractTourIds ?? [],
        items: selection?.items?.map((item) => ({
          tourId: item.tourId,
          position: item.position,
          contentVersion: item.tour.contentVersion,
          sizeBytes: 0,
          status: item.tour.status,
          deletedAt: item.tour.deletedAt,
        })) ?? [],
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: LocalizedTextSchema.parse(category.name),
        icon: category.icon,
        color: category.color,
      })),
    });

    if (kiosk.forceSyncRequestedAt !== null) {
      await this.prisma.kiosk.update({
        where: { id: kiosk.id },
        data: { forceSyncRequestedAt: null },
      });
    }
    return manifest;
  }

  async heartbeat(
    device: KioskDevice,
    body: KioskHeartbeatRequest,
    ip: string | null,
  ): Promise<KioskHeartbeatResponse> {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { id: device.kioskId, deletedAt: null },
    });
    if (kiosk === null || kiosk.hotelId !== device.hotelId) {
      throw this.notFound();
    }

    const now = new Date();
    let updated: KioskRow;
    try {
      updated = await this.prisma.kiosk.update({
        where: { id: kiosk.id },
        data: {
          lastHeartbeatAt: now,
          appVersion: body.appVersion,
          syncedManifestVersion: body.syncedManifestVersion,
          storageFreeMb: body.storageFreeMb,
          lastIp: ip,
        },
      });
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }

    return {
      forceSync: updated.forceSyncRequestedAt !== null,
      serverTime: now.toISOString(),
    };
  }

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

  async update(principal: Principal, id: string, input: KioskUpdate): Promise<Kiosk> {
    this.assertAdmin(principal);
    const valid = KioskUpdateSchema.parse(input);
    const existing = await this.findActive(id);
    try {
      const row = await this.prisma.kiosk.update({
        where: { id },
        data: kioskUpdateData(valid),
      });
      return toKioskResponse(row, await this.expectedManifestVersion(existing.hotelId), new Date());
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }
  }

  async remove(principal: Principal, id: string): Promise<void> {
    this.assertAdmin(principal);
    await this.findActive(id);
    try {
      await this.prisma.kiosk.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }
  }

  async issueEnrollmentCode(principal: Principal, id: string): Promise<EnrollmentCodeResponse> {
    this.assertAdmin(principal);
    await this.findActive(id);
    const now = new Date();
    const code = generateEnrollmentCode();
    const expiresAt = computeEnrollmentExpiry(now);
    try {
      await this.prisma.kiosk.update({
        where: { id },
        data: {
          status: 'PENDING',
          tokenHash: null,
          enrollmentCode: code,
          enrollmentExpiresAt: expiresAt,
        },
      });
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async enroll(request: KioskEnrollRequest, ip: string | null): Promise<KioskEnrollResponse> {
    const now = new Date();
    const kiosk = await this.prisma.kiosk.findFirst({
      where: {
        deletedAt: null,
        status: 'PENDING',
        enrollmentCode: request.code,
        enrollmentExpiresAt: { gt: now },
      },
    });
    if (kiosk === null) {
      throw this.enrollmentInvalid();
    }

    const token = generateDeviceToken();
    const result = await this.prisma.kiosk.updateMany({
      where: {
        id: kiosk.id,
        deletedAt: null,
        status: 'PENDING',
        enrollmentCode: request.code,
        enrollmentExpiresAt: { gt: now },
      },
      data: {
        status: 'ACTIVE',
        tokenHash: hashDeviceToken(token),
        enrollmentCode: null,
        enrollmentExpiresAt: null,
        lastIp: ip,
      },
    });
    if (result.count === 0) {
      throw this.enrollmentInvalid();
    }
    return { kioskId: kiosk.id, token };
  }

  async disable(principal: Principal, id: string): Promise<Kiosk> {
    this.assertAdmin(principal);
    const existing = await this.findActive(id);
    try {
      const row = await this.prisma.kiosk.update({
        where: { id },
        data: {
          status: 'DISABLED',
          tokenHash: null,
          enrollmentCode: null,
          enrollmentExpiresAt: null,
        },
      });
      return toKioskResponse(row, await this.expectedManifestVersion(existing.hotelId), new Date());
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }
  }

  async forceSync(principal: Principal, id: string): Promise<Kiosk> {
    this.assertAdmin(principal);
    const existing = await this.findActive(id);
    try {
      const row = await this.prisma.kiosk.update({
        where: { id },
        data: { forceSyncRequestedAt: new Date() },
      });
      return toKioskResponse(row, await this.expectedManifestVersion(existing.hotelId), new Date());
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw this.notFound();
      }
      throw error;
    }
  }

  private assertAdmin(principal: Principal): void {
    if (principal.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
  }

  private async findActive(id: string): Promise<KioskRow> {
    const row = await this.prisma.kiosk.findFirst({ where: { id, deletedAt: null } });
    if (row === null) {
      throw this.notFound();
    }
    return row;
  }

  private notFound(): HttpException {
    return missingException(KIOSK_NOT_FOUND, KIOSK_NOT_FOUND_MESSAGE);
  }

  private enrollmentInvalid(): UnauthorizedException {
    return new UnauthorizedException({
      error: { code: KIOSK_ENROLLMENT_INVALID, message: KIOSK_ENROLLMENT_INVALID_MESSAGE },
    });
  }

  private async expectedManifestVersion(hotelId: string): Promise<string | null> {
    const selection = await this.prisma.selection.findUnique({
      where: { hotelId },
      select: { version: true },
    });
    return selection === null ? null : String(selection.version);
  }
}

function kioskUpdateData(input: KioskUpdate): Partial<Pick<KioskRow,
  'label' | 'deviceType' | 'idleTimeoutSeconds'
>> {
  const data: Partial<Pick<KioskRow, 'label' | 'deviceType' | 'idleTimeoutSeconds'>> = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.deviceType !== undefined) data.deviceType = input.deviceType;
  if (input.idleTimeoutSeconds !== undefined) data.idleTimeoutSeconds = input.idleTimeoutSeconds;
  return data;
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
