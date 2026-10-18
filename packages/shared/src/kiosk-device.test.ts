import { describe, expect, it } from 'vitest';

import {
  KioskHeartbeatRequestSchema,
  KioskHeartbeatResponseSchema,
  KioskManifestSchema,
  KioskPinVerifyRequestSchema,
  KioskPinVerifyResponseSchema,
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

  it('accepte categoryId et categoryIds sur les visites du manifeste', () => {
    const withCategories = {
      ...validManifest,
      selection: {
        ...validManifest.selection,
        tours: [
          {
            ...validManifest.selection.tours[0],
            categoryId: '01990000-0000-7000-8000-000000000004',
            categoryIds: ['01990000-0000-7000-8000-000000000004'],
          },
        ],
      },
    };
    expect(KioskManifestSchema.parse(withCategories)).toEqual(withCategories);
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

describe('KioskPinVerifyRequestSchema', () => {
  it.each([
    '1234',
    '123456',
    '123456789012',
  ])('accepte un PIN de 4 à 12 chiffres (%s)', (pin) => {
    expect(KioskPinVerifyRequestSchema.parse({ pin })).toEqual({ pin });
  });

  it.each([
    ['trop court (3 chiffres)', '123'],
    ['trop long (13 chiffres)', '1234567890123'],
    ['vide', ''],
    ['caractère non numérique', '123a'],
    ['espaces inclus', ' 1234 '],
    ['signes négatifs', '-1234'],
  ])('refuse un PIN invalide : %s (%s)', (_label, pin) => {
    expect(KioskPinVerifyRequestSchema.safeParse({ pin }).success).toBe(false);
  });

  it('refuse une valeur non-string ou absente', () => {
    expect(KioskPinVerifyRequestSchema.safeParse({}).success).toBe(false);
    expect(KioskPinVerifyRequestSchema.safeParse({ pin: 1234 }).success).toBe(false);
    expect(KioskPinVerifyRequestSchema.safeParse({ pin: null }).success).toBe(false);
  });
});

describe('KioskPinVerifyResponseSchema', () => {
  it.each([true, false])('valide une réponse booléenne valid=%s', (valid) => {
    expect(KioskPinVerifyResponseSchema.parse({ valid })).toEqual({ valid });
  });

  it('refuse un type non booléen', () => {
    expect(KioskPinVerifyResponseSchema.safeParse({ valid: 'true' }).success).toBe(false);
    expect(KioskPinVerifyResponseSchema.safeParse({ valid: 1 }).success).toBe(false);
    expect(KioskPinVerifyResponseSchema.safeParse({}).success).toBe(false);
  });
});

