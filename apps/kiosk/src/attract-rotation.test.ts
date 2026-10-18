import { describe, expect, it } from 'vitest';

import {
  KioskManifestSchema,
  type KioskManifest,
  type KioskManifestTour,
} from '@xplor/shared';

import { createAttractRotation } from './attract-rotation.js';

const tourA: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000101',
  contentVersion: 1,
  sizeBytes: 50_000_000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000101',
};

const tourB: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000102',
  contentVersion: 2,
  sizeBytes: 60_000_000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000102',
};

const tourC: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000103',
  contentVersion: 3,
  sizeBytes: 70_000_000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000103',
};

const unknownTourId1 = '01990000-0000-7000-8000-000000000991';
const unknownTourId2 = '01990000-0000-7000-8000-000000000992';

function createTestManifest(overrides?: {
  attractTourIds?: string[];
  tours?: KioskManifestTour[];
}): KioskManifest {
  const rawManifest = {
    manifestVersion: 'm-20261018-01',
    kiosk: {
      id: '01990000-0000-7000-8000-000000000001',
      label: 'Borne Hall',
      idleTimeoutSeconds: 60,
      deviceType: 'TOUCH_SCREEN',
    },
    hotel: {
      id: '01990000-0000-7000-8000-000000000002',
      name: 'Riad Test',
      logoUrl: null,
      brandColor: '#6958A5',
      languages: ['fr', 'ar', 'en'],
      serviceActive: true,
      maintenancePinHash: null,
    },
    selection: {
      featuredTourId: null,
      attractTourIds: overrides?.attractTourIds ?? [tourA.id, tourB.id, tourC.id],
      tours: overrides?.tours ?? [tourA, tourB, tourC],
    },
    categories: [],
  };

  return KioskManifestSchema.parse(rawManifest);
}

describe('createAttractRotation (F-63)', () => {
  it('cycle complet : tourne indéfiniment sur la liste des visites dans l’ordre défini', () => {
    const manifest = createTestManifest({
      attractTourIds: [tourA.id, tourB.id, tourC.id],
      tours: [tourA, tourB, tourC],
    });

    const rotation = createAttractRotation(manifest);

    // Premier cycle complet
    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourB.id);
    expect(rotation.next()).toBe(tourC.id);

    // Deuxième cycle complet
    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourB.id);
    expect(rotation.next()).toBe(tourC.id);

    // Troisième cycle amorcé
    expect(rotation.next()).toBe(tourA.id);
  });

  it('id inconnu ignoré : filtre les identifiants absents de selection.tours sans interrompre le cycle', () => {
    const manifest = createTestManifest({
      attractTourIds: [unknownTourId1, tourA.id, unknownTourId2, tourB.id],
      tours: [tourA, tourB],
    });

    const rotation = createAttractRotation(manifest);

    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourB.id);
    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourB.id);
  });

  it('id inconnu ignoré : renvoie null si tous les identifiants sont absents de selection.tours', () => {
    const manifest = createTestManifest({
      attractTourIds: [unknownTourId1, unknownTourId2],
      tours: [tourA, tourB],
    });

    const rotation = createAttractRotation(manifest);

    expect(rotation.next()).toBeNull();
    expect(rotation.next()).toBeNull();
  });

  it('liste vide : renvoie null lorsque attractTourIds est vide', () => {
    const manifest = createTestManifest({
      attractTourIds: [],
      tours: [tourA, tourB],
    });

    const rotation = createAttractRotation(manifest);

    expect(rotation.next()).toBeNull();
    expect(rotation.next()).toBeNull();
  });

  it('liste vide : renvoie null lorsque tours est vide', () => {
    const manifest = createTestManifest({
      attractTourIds: [tourA.id],
      tours: [],
    });

    const rotation = createAttractRotation(manifest);

    expect(rotation.next()).toBeNull();
    expect(rotation.next()).toBeNull();
  });

  it('un seul élément : renvoie continuellement le même identifiant', () => {
    const manifest = createTestManifest({
      attractTourIds: [tourA.id],
      tours: [tourA, tourB],
    });

    const rotation = createAttractRotation(manifest);

    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourA.id);
    expect(rotation.next()).toBe(tourA.id);
  });

  it('instances indépendantes : chaque rotation maintient son propre curseur d’avancement', () => {
    const manifest = createTestManifest({
      attractTourIds: [tourA.id, tourB.id],
      tours: [tourA, tourB],
    });

    const rotation1 = createAttractRotation(manifest);
    const rotation2 = createAttractRotation(manifest);

    expect(rotation1.next()).toBe(tourA.id);
    expect(rotation2.next()).toBe(tourA.id);

    expect(rotation1.next()).toBe(tourB.id);
    expect(rotation2.next()).toBe(tourB.id);

    expect(rotation1.next()).toBe(tourA.id);
    expect(rotation2.next()).toBe(tourA.id);
  });
});
