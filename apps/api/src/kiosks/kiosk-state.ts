import type { KioskConnectionState, KioskStatus } from '@xplor/shared';

export const OFFLINE_AFTER_MINUTES = 15;

export interface KioskStateInput {
  status: KioskStatus;
  lastHeartbeatAt: Date | null;
  syncedManifestVersion: string | null;
}

export function computeConnectionState(
  kiosk: KioskStateInput,
  expectedManifestVersion: string | null,
  now: Date,
): KioskConnectionState {
  if (kiosk.status === 'DISABLED') return 'DISABLED';
  if (kiosk.status === 'PENDING') return 'PENDING';

  if (
    kiosk.lastHeartbeatAt === null ||
    now.getTime() - kiosk.lastHeartbeatAt.getTime() > OFFLINE_AFTER_MINUTES * 60_000
  ) {
    return 'OFFLINE';
  }

  if (
    expectedManifestVersion !== null &&
    expectedManifestVersion !== kiosk.syncedManifestVersion
  ) {
    return 'DESYNCHRONIZED';
  }

  return 'ONLINE';
}
