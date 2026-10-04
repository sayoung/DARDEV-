import {
  AssetKind,
  HotspotType,
  LocalizedTextSchema,
  ProcessingStatus,
  TourCreateSchema,
  TourResponseSchema,
  TourStatus,
  type LocalizedText,
} from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { validateTour } from '../catalog/publication-rules.js';
import { SEED_CATEGORIES, SEED_CITIES } from './seed-catalog.js';
import {
  findSeedTargetTour,
  listSeedAssets,
  SEED_TOURS,
  seedTourSnapshot,
  computeSeedDerivatives,
} from './seed-tours.js';

describe('seed des visites', () => {
  it('décrit 3 visites publiées, traduites, liées, aux identifiants uniques', () => {
    expect(SEED_TOURS).toHaveLength(3);
    expect(SEED_TOURS.map((tour) => tour.title.fr)).toEqual([
      'Kasbah des Oudayas',
      'Jardin de Salé',
      'Plage de Mehdia',
    ]);
    expect(SEED_TOURS.map((tour) => tour.cityFr)).toEqual(['Rabat', 'Salé', 'Kénitra']);

    const ids: string[] = [];
    const tokens: string[] = [];
    const targets = new Set<string>();

    for (const tour of SEED_TOURS) {
      expect(tour.status).toBe(TourStatus.PUBLISHED);
      expect(tour.scenes.length).toBeGreaterThanOrEqual(2);
      expect(tour.scenes.length).toBeLessThanOrEqual(3);
      expect(TourResponseSchema.shape.id.parse(tour.id)).toBe(tour.id);
      expect(TourResponseSchema.shape.shareToken.parse(tour.shareToken)).toBe(tour.shareToken);
      expectTranslated(tour.title);
      expectTranslated(tour.summary);
      expectTranslated(tour.description);
      expectTranslated(tour.practicalInfo);
      expect(tour.cover.kind).toBe(AssetKind.IMAGE);
      expect(tour.cover.processingStatus).toBe(ProcessingStatus.READY);
      expect(tour.cover.originalKey.startsWith('seed/')).toBe(true);

      TourCreateSchema.parse({
        title: tour.title,
        summary: tour.summary,
        description: tour.description,
        cityId: requireId(SEED_CITIES, tour.cityFr),
        categoryIds: [requireId(SEED_CATEGORIES, tour.categoryFr)],
        coverAssetId: tour.cover.id,
        durationMinutes: tour.durationMinutes,
        lat: tour.lat,
        lng: tour.lng,
        practicalInfo: tour.practicalInfo,
      });

      ids.push(tour.id, tour.categoryLinkId, tour.cover.id);
      tokens.push(tour.shareToken);

      const tourLinks = tour.scenes.flatMap((scene) =>
        scene.hotspots.filter((hotspot) => hotspot.type === HotspotType.TOUR_LINK),
      );
      expect(tourLinks.length).toBeGreaterThanOrEqual(1);
      for (const link of tourLinks) {
        expect(link.targetTourId).not.toBe(tour.id);
        expect(link.targetTourId).not.toBeNull();
        expect(SEED_TOURS.some((item) => item.id === link.targetTourId)).toBe(true);
        if (link.targetTourId !== null) {
          targets.add(link.targetTourId);
        }
        expectTranslated(link.label);
      }

      for (const scene of tour.scenes) {
        expectTranslated(scene.title);
        expectTranslated(scene.caption);
        expect(scene.panorama.kind).toBe(AssetKind.PANORAMA);
        expect(scene.panorama.processingStatus).toBe(ProcessingStatus.READY);
        expect(scene.panorama.originalKey.startsWith('seed/')).toBe(true);
        ids.push(scene.id, scene.panorama.id);
        for (const hotspot of scene.hotspots) {
          ids.push(hotspot.id);
          expectTranslated(hotspot.label);
        }
      }
    }

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(targets.size).toBe(SEED_TOURS.length);

    const assets = listSeedAssets();
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(assets.length);
    expect(new Set(assets.map((asset) => asset.contentHash)).size).toBe(assets.length);
    for (const asset of assets) {
      expect(asset.contentHash).toHaveLength(64);
    }
  });

  it('ne produit aucun problème de publication', () => {
    for (const tour of SEED_TOURS) {
      expect(validateTour(seedTourSnapshot(tour), findSeedTargetTour)).toEqual([]);
    }
  });

  it('fournit une visite de démonstration (demo-rabat) avec SCENE_LINK et des dérivés corrects', () => {
    const demoTour = SEED_TOURS.find((t) => t.shareToken === 'demo-rabat');
    expect(demoTour).toBeDefined();
    expect(demoTour?.publicShare).toBe(true);

    const sceneLinks = demoTour?.scenes.flatMap((scene) =>
      scene.hotspots.filter((h) => h.type === HotspotType.SCENE_LINK)
    );
    expect(sceneLinks?.length).toBeGreaterThanOrEqual(1);

    const assets = listSeedAssets();
    const panoramas = assets.filter((a) => a.kind === AssetKind.PANORAMA);
    expect(panoramas.length).toBeGreaterThan(0);
    for (const panorama of panoramas) {
      const derivatives = computeSeedDerivatives(panorama);
      const expectedBase = `panoramas/${panorama.id}/${panorama.contentHash}`;
      expect(derivatives).toEqual({
        preview: `${expectedBase}/preview.jpg`,
        web: `${expectedBase}/web.jpg`,
        thumb: `${expectedBase}/thumb.jpg`,
        tilesPrefix: `${expectedBase}/tiles/`,
        tileGrid: { cols: 16, rows: 8, size: 512 },
      });
    }
  });
});

function expectTranslated(value: LocalizedText): void {
  expect(LocalizedTextSchema.parse(value)).toEqual(value);
  expect(value.ar ?? '').not.toBe('');
  expect(value.en ?? '').not.toBe('');
}

function requireId(rows: readonly { id: string; name: LocalizedText }[], nameFr: string): string {
  const row = rows.find((item) => item.name.fr === nameFr);
  if (row === undefined) {
    throw new Error(`référentiel de seed absent : ${nameFr}`);
  }
  return row.id;
}
