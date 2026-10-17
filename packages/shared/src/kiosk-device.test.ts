import { describe, expect, it } from 'vitest';

import {
  KioskHeartbeatRequestSchema,
  KioskHeartbeatResponseSchema,
  KioskManifestSchema,
} from './kiosk-device.js';

const validManifest = {
  manifestVersion: 's14-t9f2c1',
  kiosk: {
    id: '01990000-0000-7000-8000-000000000001',
    label: 'Hall principal',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_AND_HEADSET',
  },
  hotel: {
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Hôtel Exemple Rabat',
    logoUrl: 'https://example.test/logo.png',
    brandColor: '#8A5A2B',
    languages: ['fr', 'ar', 'en'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: {
    featuredTourId: '01990000-0000-7000-8000-000000000003',
    attractTourIds: ['01990000-0000-7000-8000-000000000003'],
    tours: [
      {
        id: '01990000-0000-7000-8000-000000000003',
        contentVersion: 12,
        sizeBytes: 184000000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000003',
      },
    ],
  },
  categories: [
    {
      id: '01990000-0000-7000-8000-000000000004',
      name: { fr: 'Monuments', ar: 'مآثر', en: 'Monuments' },
      icon: 'landmark',
      color: '#1F6F8B',
    },
  ],
};

describe('KioskManifestSchema', () => {
  it('accepte un manifeste kiosque valide', () => {
    expect(KioskManifestSchema.parse(validManifest)).toEqual(validManifest);
  });

  it('refuse une taille de visite négative', () => {
    const invalid = {
      ...validManifest,
      selection: {
        ...validManifest.selection,
        tours: [{ ...validManifest.selection.tours[0], sizeBytes: -1 }],
      },
    };
    expect(KioskManifestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('KioskHeartbeatRequestSchema', () => {
  it('refuse un espace de stockage libre négatif', () => {
    expect(
      KioskHeartbeatRequestSchema.safeParse({
        appVersion: '1.2.3',
        syncedManifestVersion: null,
        storageFreeMb: -1,
      }).success,
    ).toBe(false);
  });

  it('refuse plus de dix erreurs récentes', () => {
    expect(
      KioskHeartbeatRequestSchema.safeParse({
        appVersion: '1.2.3',
        syncedManifestVersion: 's14-t9f2c1',
        storageFreeMb: 2048,
        recentErrors: Array.from({ length: 11 }, () => 'erreur'),
      }).success,
    ).toBe(false);
  });

  it('utilise un tableau vide d’erreurs par défaut', () => {
    expect(
      KioskHeartbeatRequestSchema.parse({
        appVersion: '1.2.3',
        syncedManifestVersion: null,
        storageFreeMb: null,
      }).recentErrors,
    ).toEqual([]);
  });
});

describe('KioskHeartbeatResponseSchema', () => {
  it('valide forceSync et une date serveur ISO', () => {
    expect(
      KioskHeartbeatResponseSchema.safeParse({
        forceSync: false,
        serverTime: '2026-10-17T12:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
