import { describe, it, expect } from 'vitest';
import { toTourGraph, TourSource } from './tour-graph.js';
import { SceneCtx } from './tour-graph-scene.js';

describe('toTourGraph', () => {
  const baseCtx: SceneCtx = {
    lang: 'fr',
    audience: 'public',
    mediaBase: 'https://media.test',
    assetUrlById: new Map(),
    media: new Map(),
  };

  const validDerivatives = {
    preview: '/pano/preview.jpg',
    web: '/pano/web.jpg',
    thumb: '/pano/thumb.jpg',
    tilesPrefix: '/pano/tiles/',
    tileGrid: { cols: 4, rows: 2, size: 512 },
  };

  const createValidTour = (): TourSource => ({
    id: 'tour-1',
    contentVersion: 1,
    title: { fr: 'Titre FR', ar: 'Titre AR' },
    summary: { fr: 'Résumé' },
    practicalInfo: null,
    startSceneId: 'scene-1',
    lat: 34.0,
    lng: -6.8,
    city: { name: { fr: 'Rabat' } },
    categories: [{ category: { name: { fr: 'Cat 1' } } }],
    coverAsset: { derivatives: validDerivatives },
    scenes: [
      {
        id: 'scene-1',
        title: { fr: 'Scène 1 FR', ar: 'Scène 1 AR' },
        caption: null,
        weight: 1,
        initialYaw: 0,
        initialPitch: 0,
        initialZoom: 1,
        panoramaAsset: { derivatives: validDerivatives },
        ambientAsset: null,
        narration: null,
        hotspots: [],
      },
      {
        id: 'scene-2',
        title: { fr: 'Scène 2 FR' },
        caption: null,
        weight: 2,
        initialYaw: 90,
        initialPitch: 0,
        initialZoom: 1,
        panoramaAsset: { derivatives: validDerivatives },
        ambientAsset: null,
        narration: null,
        hotspots: [],
      }
    ],
    linkedTours: [
      {
        id: 'tour-2',
        title: { fr: 'Tour lié' },
        coverAsset: null,
      }
    ],
  });

  it('maps a complete tour, keeps scene order and resolves fallback text', () => {
    const ctx = { ...baseCtx, lang: 'ar' as const };
    const source = createValidTour();
    
    const graph = toTourGraph(source, ctx);
    
    expect(graph.id).toBe('tour-1');
    expect(graph.title).toBe('Titre AR');
    expect(graph.summary).toBe('Résumé');
    expect(graph.location).toEqual({ lat: 34.0, lng: -6.8 });
    expect(graph.scenes.length).toBe(2);
    
    const [scene1, scene2] = graph.scenes;
    if (!scene1 || !scene2) throw new Error('Missing scenes');

    expect(scene1.id).toBe('scene-1');
    expect(scene1.title).toBe('Scène 1 AR');
    
    expect(scene2.id).toBe('scene-2');
    expect(scene2.title).toBe('Scène 2 FR');
  });

  it('sets location to null if lat is null', () => {
    const source = createValidTour();
    source.lat = null;
    
    const graph = toTourGraph(source, baseCtx);
    
    expect(graph.location).toBeNull();
  });

  it('throws an error if startSceneId is null', () => {
    const source = createValidTour();
    source.startSceneId = null;
    
    expect(() => toTourGraph(source, baseCtx)).toThrowError('startSceneId is required');
  });

  it('includes URL hotspot in public and excludes it in kiosk', () => {
    const source = createValidTour();
    const s1 = source.scenes[0];
    if (s1) {
      s1.hotspots = [
        {
          id: 'hs-url',
          type: 'URL',
          yaw: 0,
          pitch: 0,
          label: { fr: 'Lien externe' },
          url: 'https://example.com',
          targetSceneId: null,
          targetTourId: null,
          targetTourSceneId: null,
          body: null,
          mediaAssetIds: [],
          icon: null,
          arrivalYaw: null,
        }
      ];
    }

    const publicGraph = toTourGraph(source, { ...baseCtx, audience: 'public' });
    const pScene1 = publicGraph.scenes[0];
    if (!pScene1) throw new Error('Missing scene');
    expect(pScene1.hotspots.length).toBe(1);
    const pHotspot1 = pScene1.hotspots[0];
    if (!pHotspot1) throw new Error('Missing hotspot');
    expect(pHotspot1.type).toBe('URL');

    const kioskGraph = toTourGraph(source, { ...baseCtx, audience: 'kiosk' });
    const kScene1 = kioskGraph.scenes[0];
    if (!kScene1) throw new Error('Missing scene');
    expect(kScene1.hotspots.length).toBe(0);
  });

  it('sets linkedTours.availableOffline false in public and based on allowedTourIds in kiosk', () => {
    const source = createValidTour();
    
    const publicGraph = toTourGraph(source, { ...baseCtx, audience: 'public' });
    const ltPublic = publicGraph.linkedTours[0];
    if (!ltPublic) throw new Error('Missing linked tour');
    expect(ltPublic.availableOffline).toBe(false);

    const kioskGraphNoAuth = toTourGraph(source, { ...baseCtx, audience: 'kiosk' });
    const ltKioskNoAuth = kioskGraphNoAuth.linkedTours[0];
    if (!ltKioskNoAuth) throw new Error('Missing linked tour');
    expect(ltKioskNoAuth.availableOffline).toBe(false);

    const kioskGraphAuth = toTourGraph(source, { 
      ...baseCtx, 
      audience: 'kiosk',
      allowedTourIds: new Set(['tour-2'])
    });
    const ltKioskAuth = kioskGraphAuth.linkedTours[0];
    if (!ltKioskAuth) throw new Error('Missing linked tour');
    expect(ltKioskAuth.availableOffline).toBe(true);
  });
});
