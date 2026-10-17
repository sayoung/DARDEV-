import { KioskSchema } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { toKioskResponse, type KioskRow } from './kiosks.service.js';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const MANIFEST_VERSION = 'manifest-v3';

function kioskRow(overrides: Partial<KioskRow> = {}): KioskRow {
  return {
    id: '01990000-0000-7000-8000-000000000301',
    label: 'Hall principal',
    hotelId: '01990000-0000-7000-8000-000000000101',
    deviceType: 'TOUCH_AND_HEADSET',
    status: 'ACTIVE',
    enrollmentCode: 'AB12CD34',
    enrollmentExpiresAt: new Date('2026-10-17T13:00:00.000Z'),
    tokenHash: 'sensitive-token-hash',
    lastHeartbeatAt: new Date('2026-10-17T11:59:00.000Z'),
    lastIp: '192.0.2.4',
    appVersion: '1.2.3',
    syncedManifestVersion: MANIFEST_VERSION,
    storageFreeMb: 2048,
    idleTimeoutSeconds: 90,
    deletedAt: null,
    createdAt: new Date('2026-10-01T08:30:00.000Z'),
    updatedAt: new Date('2026-10-17T11:59:00.000Z'),
    ...overrides,
  };
}

describe('toKioskResponse', () => {
  it('renvoie ONLINE avec heartbeat récent et manifeste synchronisé', () => {
    const response = toKioskResponse(kioskRow(), MANIFEST_VERSION, NOW);

    expect(response.connectionState).toBe('ONLINE');
    expect(response.lastHeartbeatAt).toBe('2026-10-17T11:59:00.000Z');
    expect(response.createdAt).toBe('2026-10-01T08:30:00.000Z');
  });

  it('renvoie DESYNCHRONIZED si le manifeste attendu diffère', () => {
    const response = toKioskResponse(kioskRow(), 'manifest-v4', NOW);

    expect(response.connectionState).toBe('DESYNCHRONIZED');
  });

  it('renvoie PENDING et DISABLED selon le statut', () => {
    expect(
      toKioskResponse(kioskRow({ status: 'PENDING' }), MANIFEST_VERSION, NOW)
        .connectionState,
    ).toBe('PENDING');
    expect(
      toKioskResponse(kioskRow({ status: 'DISABLED' }), MANIFEST_VERSION, NOW)
        .connectionState,
    ).toBe('DISABLED');
  });

  it('renvoie OFFLINE si le heartbeat date de plus de 15 minutes', () => {
    const response = toKioskResponse(
      kioskRow({ lastHeartbeatAt: new Date('2026-10-17T11:44:59.999Z') }),
      MANIFEST_VERSION,
      NOW,
    );

    expect(response.connectionState).toBe('OFFLINE');
  });

  it('valide la réponse et n’expose aucun secret ni adresse IP', () => {
    const response = toKioskResponse(kioskRow(), MANIFEST_VERSION, NOW);

    expect(KioskSchema.parse(response)).toEqual(response);
    expect(Object.keys(response)).not.toContain('tokenHash');
    expect(Object.keys(response)).not.toContain('enrollmentCode');
    expect(Object.keys(response)).not.toContain('enrollmentExpiresAt');
    expect(Object.keys(response)).not.toContain('lastIp');
  });

  it('conserve un heartbeat null', () => {
    const response = toKioskResponse(
      kioskRow({ lastHeartbeatAt: null, status: 'PENDING' }),
      null,
      NOW,
    );

    expect(response.lastHeartbeatAt).toBeNull();
  });
});
