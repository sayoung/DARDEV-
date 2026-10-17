import {
  KioskSchema,
  type Kiosk,
  type KioskDeviceType,
  type KioskStatus,
} from '@xplor/shared';

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
