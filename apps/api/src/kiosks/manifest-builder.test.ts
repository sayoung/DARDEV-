import { describe, expect, it } from 'vitest';

import { KioskManifestSchema } from '@xplor/shared';

import { buildManifest, type ManifestBuilderInput } from './manifest-builder.js';

const ids = {
  kiosk: '10000000-0000-4000-8000-000000000001',
  hotel: '20000000-0000-4000-8000-000000000001',
  publishedFirst: '30000000-0000-4000-8000-000000000001',
  draft: '30000000-0000-4000-8000-000000000002',
  deleted: '30000000-0000-4000-8000-000000000003',
  publishedLast: '30000000-0000-4000-8000-000000000004',
  category: '40000000-0000-4000-8000-000000000001',
};

const baseInput: ManifestBuilderInput = {
  kiosk: {
    id: ids.kiosk,
    label: 'Hall principal',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_AND_HEADSET',
  },
  hotel: {
    id: ids.hotel,
    name: 'Hôtel Exemple',
    logoUrl: 'https://media.example/logo.png',
    brandColor: '#6958A5',
    languages: ['fr'],
    active: true,
    logoAssetId: '50000000-0000-4000-8000-000000000001',
    maintenancePinHash: 'maintenance-hash',
  },
  selection: {
    version: 3,
    featuredTourId: ids.draft,
    attractTourIds: [ids.publishedLast, ids.deleted, ids.draft],
    items: [
      {
        tourId: ids.publishedLast,
        position: 2,
        contentVersion: 4,
        sizeBytes: 200,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      {
        tourId: ids.draft,
        position: 0,
        contentVersion: 8,
        sizeBytes: 300,
        status: 'DRAFT',
        deletedAt: null,
      },
      {
        tourId: ids.publishedFirst,
        position: 1,
        contentVersion: 2,
        sizeBytes: 100,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      {
        tourId: ids.deleted,
        position: 3,
        contentVersion: 9,
        sizeBytes: 400,
        status: 'PUBLISHED',
        deletedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ],
  },
  categories: [{
    id: ids.category,
    name: { fr: 'Monuments' },
    icon: 'landmark',
    color: '#1F6F8B',
  }],
};

describe('buildManifest', () => {
  it('exclut les visites brouillon ou supprimées, filtre featured/attract et conserve l’ordre', () => {
    const manifest = buildManifest(baseInput);

    expect(manifest.selection.tours.map((tour) => tour.id)).toEqual([
      ids.publishedFirst,
      ids.publishedLast,
    ]);
    expect(manifest.selection.featuredTourId).toBeNull();
    expect(manifest.selection.attractTourIds).toEqual([ids.publishedLast]);
    expect(manifest.selection.tours.map((tour) => tour.url)).toEqual([
      `/api/v1/tours/${ids.publishedFirst}`,
      `/api/v1/tours/${ids.publishedLast}`,
    ]);
  });

  it('accepte une sélection vide et renvoie featured null et aucun attract', () => {
    const manifest = buildManifest({
      ...baseInput,
      selection: {
        ...baseInput.selection,
        items: [],
      },
    });

    expect(manifest.selection).toEqual({
      featuredTourId: null,
      attractTourIds: [],
      tours: [],
    });
  });

  it('ne révèle aucun secret de kiosque et produit un manifeste validé par le schéma partagé', () => {
    const input = {
      ...baseInput,
      kiosk: {
        ...baseInput.kiosk,
        tokenHash: 'must-not-leak',
        enrollmentCode: 'A1B2C3D4',
      },
    };
    const manifest = buildManifest(input);

    expect(KioskManifestSchema.parse(manifest)).toEqual(manifest);
    expect(manifest.kiosk).not.toHaveProperty('tokenHash');
    expect(manifest.kiosk).not.toHaveProperty('enrollmentCode');
    expect(JSON.stringify(manifest)).not.toContain('must-not-leak');
    expect(JSON.stringify(manifest)).not.toContain('A1B2C3D4');
    expect(manifest.hotel.serviceActive).toBe(true);
  });
});
