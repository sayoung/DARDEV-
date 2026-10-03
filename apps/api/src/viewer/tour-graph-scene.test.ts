import { describe, it, expect } from 'vitest';
import { toGraphScene, SceneSource, SceneCtx } from './tour-graph-scene.js';
import { HotspotType } from '@xplor/shared';

describe('toGraphScene', () => {
  const validDerivatives = {
    preview: 'preview.jpg',
    web: 'web.jpg',
    thumb: 'thumb.jpg',
    tilesPrefix: 'tiles/',
    tileGrid: { cols: 4, rows: 2, size: 512 },
  };

  const defaultSceneSource: SceneSource = {
    id: 'scene-1',
    title: { fr: 'Titre FR' },
    caption: null,
    weight: 0,
    initialYaw: 0,
    initialPitch: 0,
    initialZoom: 50,
    panoramaAsset: { derivatives: validDerivatives },
    ambientAsset: null,
    narration: null,
    hotspots: [],
  };

  const defaultCtx: SceneCtx = {
    lang: 'fr',
    audience: 'public',
    mediaBase: 'https://media.local',
    media: new Map(),
    assetUrlById: new Map(),
  };

  it("gère le repli fr d'un titre sans traduction ar", () => {
    const scene: SceneSource = {
      ...defaultSceneSource,
      title: { fr: 'Titre FR (repli)' },
    };
    const ctx: SceneCtx = { ...defaultCtx, lang: 'ar' };

    const result = toGraphScene(scene, ctx);
    expect(result.title).toBe('Titre FR (repli)');
  });

  it('gère narrationUrl null', () => {
    const scene: SceneSource = { ...defaultSceneSource, narration: null };
    const result = toGraphScene(scene, defaultCtx);
    expect(result.narrationUrl).toBeNull();
  });

  it('gère narrationUrl présente', () => {
    const scene: SceneSource = {
      ...defaultSceneSource,
      narration: { fr: 'narr-1' },
    };
    const ctx: SceneCtx = {
      ...defaultCtx,
      assetUrlById: new Map([['narr-1', 'https://media.local/audio.mp3']]),
    };
    const result = toGraphScene(scene, ctx);
    expect(result.narrationUrl).toBe('https://media.local/audio.mp3');
  });

  it('retourne ambientUrl null si absent de assetUrlById', () => {
    const scene: SceneSource = {
      ...defaultSceneSource,
      ambientAsset: { id: 'amb-1' },
    };
    const ctx: SceneCtx = {
      ...defaultCtx,
      assetUrlById: new Map(), // amb-1 n'est pas dans la map
    };
    const result = toGraphScene(scene, ctx);
    expect(result.ambientUrl).toBeNull();
  });

  it('filtre un hotspot invalide', () => {
    const scene: SceneSource = {
      ...defaultSceneSource,
      hotspots: [
        {
          id: 'hs-1',
          type: 'SCENE_LINK',
          yaw: 0,
          pitch: 0,
          label: { fr: 'Lien' },
          targetSceneId: null, // rend le hotspot invalide
          targetTourId: null,
          targetTourSceneId: null,
          body: null,
          mediaAssetIds: [],
          url: null,
          icon: null,
          arrivalYaw: null,
        },
      ],
    };
    
    const result = toGraphScene(scene, defaultCtx);
    expect(result.hotspots).toHaveLength(0);
  });

  it('omet un hotspot URL en mode kiosque', () => {
    const scene: SceneSource = {
      ...defaultSceneSource,
      hotspots: [
        {
          id: 'hs-url',
          type: 'URL',
          yaw: 0,
          pitch: 0,
          label: { fr: 'Lien' },
          targetSceneId: null,
          targetTourId: null,
          targetTourSceneId: null,
          body: null,
          mediaAssetIds: [],
          url: 'https://example.com',
          icon: null,
          arrivalYaw: null,
        },
      ],
    };
    const publicCtx: SceneCtx = { ...defaultCtx, audience: 'public' };
    const kioskCtx: SceneCtx = { ...defaultCtx, audience: 'kiosk' };

    const publicResult = toGraphScene(scene, publicCtx);
    expect(publicResult.hotspots).toHaveLength(1);
    expect(publicResult.hotspots[0]?.type).toBe(HotspotType.URL);

    const kioskResult = toGraphScene(scene, kioskCtx);
    expect(kioskResult.hotspots).toHaveLength(0);
  });
});
