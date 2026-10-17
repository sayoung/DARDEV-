import { describe, expect, it } from 'vitest';

import { computeManifestVersion } from './manifest-version.js';

const input = {
  selectionVersion: 4,
  tours: [
    { id: 'tour-b', contentVersion: 7 },
    { id: 'tour-a', contentVersion: 2 },
  ],
  hotel: {
    name: 'Hôtel Exemple',
    brandColor: '#6958A5',
    languages: ['fr', 'ar'],
    active: true,
    logoAssetId: 'asset-logo',
    maintenancePinHash: 'pin-hash',
  },
  kiosk: {
    label: 'Hall principal',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_AND_HEADSET',
  },
};

describe('computeManifestVersion', () => {
  it('renvoie une version stable au format m suivi de 12 caractères hexadécimaux', () => {
    const version = computeManifestVersion(input);

    expect(version).toBe(computeManifestVersion(input));
    expect(version).toMatch(/^m[0-9a-f]{12}$/);
  });

  it('ne dépend pas de l’ordre des visites', () => {
    expect(computeManifestVersion(input)).toBe(computeManifestVersion({
      ...input,
      tours: [...input.tours].reverse(),
    }));
  });

  it.each([
    ['selectionVersion', { selectionVersion: input.selectionVersion + 1 }],
    ['contentVersion', { tours: input.tours.map((tour, index) =>
      index === 0 ? { ...tour, contentVersion: tour.contentVersion + 1 } : tour) }],
    ['nom de l’hôtel', { hotel: { ...input.hotel, name: 'Hôtel Modifié' } }],
    ['PIN de maintenance', {
      hotel: { ...input.hotel, maintenancePinHash: 'different-pin-hash' },
    }],
    ['délai de veille', { kiosk: { ...input.kiosk, idleTimeoutSeconds: 120 } }],
  ])('change si %s change', (_field, changes) => {
    expect(computeManifestVersion(input)).not.toBe(computeManifestVersion({
      ...input,
      ...changes,
    }));
  });
});
