import { describe, expect, it } from 'vitest';

import {
  KioskCreateSchema,
  KioskEnrollRequestSchema,
  KioskSchema,
  KioskUpdateSchema,
} from './kiosk.js';

const hotelId = '01990000-0000-7000-8000-000000000001';
const kioskId = '01990000-0000-7000-8000-000000000002';
const createdAt = '2026-10-17T12:00:00.000Z';

describe('KioskCreateSchema', () => {
  it('accepte une création valide avec le délai de veille facultatif', () => {
    expect(
      KioskCreateSchema.parse({
        label: 'Hall principal',
        hotelId,
        deviceType: 'TOUCH_AND_HEADSET',
      }),
    ).toEqual({ label: 'Hall principal', hotelId, deviceType: 'TOUCH_AND_HEADSET' });
  });

  it('refuse un libellé vide', () => {
    expect(
      KioskCreateSchema.safeParse({ label: '', hotelId, deviceType: 'TOUCH_SCREEN' }).success,
    ).toBe(false);
  });

  it('refuse un délai de veille hors de la plage 15..600', () => {
    for (const idleTimeoutSeconds of [14, 601, 15.5]) {
      expect(
        KioskCreateSchema.safeParse({
          label: 'Hall principal',
          hotelId,
          deviceType: 'TOUCH_SCREEN',
          idleTimeoutSeconds,
        }).success,
      ).toBe(false);
    }
  });
});

describe('KioskUpdateSchema', () => {
  it('accepte une mise à jour partielle valide', () => {
    expect(KioskUpdateSchema.parse({ idleTimeoutSeconds: 600 })).toEqual({
      idleTimeoutSeconds: 600,
    });
  });
});

describe('KioskEnrollRequestSchema', () => {
  it('accepte un code et des informations d’appareil valides', () => {
    const request = {
      code: 'AB12CD34',
      deviceInfo: { userAgent: 'Xplor Kiosk/1.0', screen: '1920x1080' },
    };
    expect(KioskEnrollRequestSchema.parse(request)).toEqual(request);
  });

  it('refuse un code de sept caractères', () => {
    expect(
      KioskEnrollRequestSchema.safeParse({ code: 'AB12CD3', deviceInfo: { userAgent: 'Kiosk' } })
        .success,
    ).toBe(false);
  });

  it('refuse un code contenant des minuscules', () => {
    expect(
      KioskEnrollRequestSchema.safeParse({ code: 'ab12CD34', deviceInfo: { userAgent: 'Kiosk' } })
        .success,
    ).toBe(false);
  });
});

describe('KioskSchema', () => {
  it('retire tokenHash et enrollmentCode de la réponse validée', () => {
    const parsed = KioskSchema.parse({
      id: kioskId,
      label: 'Hall principal',
      hotelId,
      deviceType: 'TOUCH_AND_HEADSET',
      status: 'ACTIVE',
      connectionState: 'ONLINE',
      lastHeartbeatAt: createdAt,
      appVersion: '1.0.0',
      syncedManifestVersion: 's14-t9f2c1',
      storageFreeMb: 512,
      idleTimeoutSeconds: 90,
      createdAt,
      tokenHash: 'must-not-leak',
      enrollmentCode: 'AB12CD34',
    });

    expect(parsed).not.toHaveProperty('tokenHash');
    expect(parsed).not.toHaveProperty('enrollmentCode');
    expect(parsed).toEqual({
      id: kioskId,
      label: 'Hall principal',
      hotelId,
      deviceType: 'TOUCH_AND_HEADSET',
      status: 'ACTIVE',
      connectionState: 'ONLINE',
      lastHeartbeatAt: createdAt,
      appVersion: '1.0.0',
      syncedManifestVersion: 's14-t9f2c1',
      storageFreeMb: 512,
      idleTimeoutSeconds: 90,
      createdAt,
    });
  });
});
