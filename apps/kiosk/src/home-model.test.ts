import { describe, expect, it } from 'vitest';

import {
  KioskManifestSchema,
  type KioskManifest,
  type KioskManifestCategory,
  type KioskManifestTour,
} from '@xplor/shared';

import { buildHomeModel } from './home-model.js';

const categoryMonuments: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000010',
  name: { fr: 'Monuments', ar: 'مآثر', en: 'Monuments' },
  icon: 'landmark',
  color: '#1F6F8B',
};

const categoryMuseums: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000020',
  name: { fr: 'Musées', ar: 'متاحف', en: 'Museums' },
  icon: 'museum',
  color: '#8A5A2B',
};

const categoryGardens: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000030',
  name: { fr: 'Jardins' },
  icon: 'trees',
  color: '#2E7D32',
};

const categoryUnused: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000040',
  name: { fr: 'Plages', ar: 'شواطئ', en: 'Beaches' },
  icon: 'waves',
  color: '#0288D1',
};

const tourOudayas: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000100',
  contentVersion: 3,
  sizeBytes: 150000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000100',
  categoryId: categoryMonuments.id,
};

const tourHassan: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000200',
  contentVersion: 5,
  sizeBytes: 180000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000200',
  categoryId: categoryMonuments.id,
};

const tourMuseum: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000300',
  contentVersion: 2,
  sizeBytes: 120000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000300',
  categoryId: categoryMuseums.id,
};

const tourChellah: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000400',
  contentVersion: 1,
  sizeBytes: 130000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000400',
  categoryId: categoryGardens.id,
  categoryIds: [categoryGardens.id, categoryMonuments.id],
};

function createTestManifest(overrides?: {
  featuredTourId?: string | null;
  tours?: KioskManifestTour[];
  categories?: KioskManifestCategory[];
}): KioskManifest {
  const rawManifest = {
    manifestVersion: 'm-20261018-01',
    kiosk: {
      id: '01990000-0000-7000-8000-000000000001',
      label: 'Borne Hall Principal',
      idleTimeoutSeconds: 90,
      deviceType: 'TOUCH_SCREEN',
    },
    hotel: {
      id: '01990000-0000-7000-8000-000000000002',
      name: 'Hôtel La Tour Hassan Palace',
      logoUrl: 'https://media.xplor.ma/hotels/tour-hassan.png',
      brandColor: '#6958A5',
      languages: ['fr', 'ar', 'en'],
      serviceActive: true,
      maintenancePinHash: null,
    },
    selection: {
      featuredTourId:
        overrides?.featuredTourId !== undefined
          ? overrides.featuredTourId
          : tourOudayas.id,
      attractTourIds: [tourOudayas.id, tourHassan.id],
      tours: overrides?.tours ?? [tourOudayas, tourHassan, tourMuseum, tourChellah],
    },
    categories: overrides?.categories ?? [
      categoryMonuments,
      categoryMuseums,
      categoryGardens,
      categoryUnused,
    ],
  };

  return KioskManifestSchema.parse(rawManifest);
}

describe('buildHomeModel', () => {
  it('sans filtre : renvoie toutes les visites dans l’ordre du manifeste, l’hôtel et les catégories utilisées', () => {
    const manifest = createTestManifest();

    const model = buildHomeModel(manifest, 'fr', null);

    expect(model.hotelName).toBe('Hôtel La Tour Hassan Palace');
    expect(model.brandColor).toBe('#6958A5');
    expect(model.featured).toEqual(tourOudayas);
    expect(model.tours).toEqual([tourOudayas, tourHassan, tourMuseum, tourChellah]);
    expect(model.categories).toEqual([
      { id: categoryMonuments.id, label: 'Monuments' },
      { id: categoryMuseums.id, label: 'Musées' },
      { id: categoryGardens.id, label: 'Jardins' },
    ]);
    expect(model.selectedCategoryId).toBeNull();
  });

  it('avec filtre : renvoie uniquement les visites de la catégorie demandée dans l’ordre du manifeste', () => {
    const manifest = createTestManifest();

    const model = buildHomeModel(manifest, 'fr', categoryMuseums.id);

    expect(model.tours).toEqual([tourMuseum]);
    expect(model.featured).toEqual(tourOudayas);
    expect(model.categories).toEqual([
      { id: categoryMonuments.id, label: 'Monuments' },
      { id: categoryMuseums.id, label: 'Musées' },
      { id: categoryGardens.id, label: 'Jardins' },
    ]);
    expect(model.selectedCategoryId).toBe(categoryMuseums.id);
  });

  it('avec filtre multi-catégories via categoryIds : inclut les visites rattachées', () => {
    const manifest = createTestManifest();

    const model = buildHomeModel(manifest, 'fr', categoryMonuments.id);

    expect(model.tours).toEqual([tourOudayas, tourHassan, tourChellah]);
  });

  it('catégorie inconnue : renvoie une liste vide de visites', () => {
    const manifest = createTestManifest();

    const model = buildHomeModel(
      manifest,
      'fr',
      '01990000-0000-7000-8000-999999999999',
    );

    expect(model.tours).toEqual([]);
    expect(model.categories).toEqual([
      { id: categoryMonuments.id, label: 'Monuments' },
      { id: categoryMuseums.id, label: 'Musées' },
      { id: categoryGardens.id, label: 'Jardins' },
    ]);
  });

  it('visite mise en avant absente : renvoie featured null quand featuredTourId est null', () => {
    const manifest = createTestManifest({ featuredTourId: null });

    const model = buildHomeModel(manifest, 'fr', null);

    expect(model.featured).toBeNull();
  });

  it('visite mise en avant absente : renvoie featured null quand featuredTourId n’est pas dans les visites', () => {
    const manifest = createTestManifest({
      featuredTourId: '01990000-0000-7000-8000-999999999999',
    });

    const model = buildHomeModel(manifest, 'fr', null);

    expect(model.featured).toBeNull();
  });

  it('repli fr : utilise le français si la langue demandée est absente ou vide', () => {
    const manifest = createTestManifest();

    const modelAr = buildHomeModel(manifest, 'ar', null);

    expect(modelAr.categories).toEqual([
      { id: categoryMonuments.id, label: 'مآثر' },
      { id: categoryMuseums.id, label: 'متاحف' },
      { id: categoryGardens.id, label: 'Jardins' },
    ]);

    const modelEn = buildHomeModel(manifest, 'en', null);

    expect(modelEn.categories).toEqual([
      { id: categoryMonuments.id, label: 'Monuments' },
      { id: categoryMuseums.id, label: 'Museums' },
      { id: categoryGardens.id, label: 'Jardins' },
    ]);
  });

  it('exclut les catégories qui ne sont associées à aucune visite de la sélection', () => {
    const manifest = createTestManifest({
      tours: [tourMuseum],
    });

    const model = buildHomeModel(manifest, 'fr', null);

    expect(model.categories).toEqual([
      { id: categoryMuseums.id, label: 'Musées' },
    ]);
  });

  it('gère une sélection de visites vide', () => {
    const manifest = createTestManifest({
      featuredTourId: null,
      tours: [],
    });

    const model = buildHomeModel(manifest, 'fr', null);

    expect(model.featured).toBeNull();
    expect(model.tours).toEqual([]);
    expect(model.categories).toEqual([]);
  });
});
