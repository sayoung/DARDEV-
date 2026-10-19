import { describe, expect, it } from 'vitest';
import {
  HotspotIcon,
  HotspotType,
  TourGraph,
  TourGraphSchema,
  TourGraphScene,
  TourGraphSceneSchema,
} from '@xplor/shared';
import {
  toVrTargets,
  VR_EXIT_TARGET,
  VR_EXIT_TARGET_ID,
  withExitTarget,
} from './vr-targets.js';
import type { HotspotTarget } from './vr-geometry.js';

function createTestScene(hotspots: unknown[], id = 'test-scene-vr-1'): TourGraphScene {
  return TourGraphSceneSchema.parse({
    id,
    title: 'Scène VR de test',
    caption: null,
    panorama: {
      preview: 'http://example.com/preview.jpg',
      web: 'http://example.com/web.jpg',
      tiles: {
        width: 8192,
        cols: 16,
        rows: 8,
        baseUrl: 'http://example.com/tiles',
      },
    },
    initialView: {
      yaw: 0,
      pitch: 0,
      zoom: 50,
    },
    narrationUrl: null,
    ambientUrl: null,
    thumb: 'http://example.com/thumb.jpg',
    hotspots,
  });
}

function createTestGraph(
  scenes: TourGraphScene[],
  linkedTours: Array<{
    id: string;
    title: string;
    shareToken: string | null;
    coverUrl?: string;
    availableOffline?: boolean;
  }> = [],
): TourGraph {
  return TourGraphSchema.parse({
    id: '01990000-0000-7000-8000-000000000001',
    contentVersion: 1,
    lang: 'fr',
    title: 'Visite test VR',
    summary: 'Résumé',
    city: 'Rabat',
    categories: ['Monument'],
    coverUrl: 'http://example.com/cover.jpg',
    practicalInfo: null,
    location: null,
    startSceneId: scenes[0]?.id ?? 'test-scene-vr-1',
    linkedTours: linkedTours.map((lt) => ({
      id: lt.id,
      title: lt.title,
      shareToken: lt.shareToken,
      coverUrl: lt.coverUrl ?? 'http://example.com/cover.jpg',
      availableOffline: lt.availableOffline ?? true,
    })),
    scenes,
  });
}

describe('toVrTargets', () => {
  it('(a) une scène avec SCENE_LINK produit une cible VR', () => {
    const scene1 = createTestScene([
      {
        type: HotspotType.SCENE_LINK,
        id: 'hs-scene-link',
        yaw: 0.5,
        pitch: -0.2,
        label: 'Vers la pièce suivante',
        icon: HotspotIcon.ARROW,
        targetSceneId: 'scene-2',
      },
    ]);
    const scene2 = createTestScene([], 'scene-2');
    const graph = createTestGraph([scene1, scene2]);

    const targets = toVrTargets(scene1, graph);

    expect(targets).toEqual([
      {
        id: 'hs-scene-link',
        yaw: 0.5,
        pitch: -0.2,
      },
    ]);
  });

  it('(c) SCENE_LINK vers une scène absente du graphe → pas de cible', () => {
    const scene1 = createTestScene([
      {
        type: HotspotType.SCENE_LINK,
        id: 'hs-scene-link-orphan',
        yaw: 0.1,
        pitch: 0.2,
        label: 'Vers scène inexistante',
        icon: HotspotIcon.ARROW,
        targetSceneId: 'scene-absente',
      },
    ]);
    const graph = createTestGraph([scene1]);

    const targets = toVrTargets(scene1, graph);

    expect(targets).toEqual([]);
  });

  it('(e) TOUR_LINK sans shareToken → pas de cible VR', () => {
    const scene = createTestScene([
      {
        type: HotspotType.TOUR_LINK,
        id: 'hs-tour-link-no-token',
        yaw: 0.3,
        pitch: -0.1,
        label: 'Vers tour non partagé',
        icon: HotspotIcon.PORTAL,
        targetTourId: 'tour-unshared',
      },
    ]);
    const graph = createTestGraph([scene], [
      {
        id: 'tour-unshared',
        title: 'Tour non partagé',
        shareToken: null,
      },
    ]);

    const targets = toVrTargets(scene, graph);

    expect(targets).toEqual([]);
  });

  it('TOUR_LINK non présent dans linkedTours → pas de cible VR', () => {
    const scene = createTestScene([
      {
        type: HotspotType.TOUR_LINK,
        id: 'hs-tour-link-missing',
        yaw: 0.3,
        pitch: -0.1,
        label: 'Vers tour inconnu',
        icon: HotspotIcon.PORTAL,
        targetTourId: 'tour-inconnu',
      },
    ]);
    const graph = createTestGraph([scene], []);

    const targets = toVrTargets(scene, graph);

    expect(targets).toEqual([]);
  });

  it('TOUR_LINK avec shareToken résolu produit une cible VR', () => {
    const scene = createTestScene([
      {
        type: HotspotType.TOUR_LINK,
        id: 'hs-tour-link-valid',
        yaw: 0.75,
        pitch: -0.25,
        label: 'Vers le jardin',
        icon: HotspotIcon.PORTAL,
        targetTourId: 'tour-jardin',
      },
    ]);
    const graph = createTestGraph([scene], [
      {
        id: 'tour-jardin',
        title: 'Visite du jardin',
        shareToken: 'token-jardin-456',
      },
    ]);

    const targets = toVrTargets(scene, graph);

    expect(targets).toEqual([
      {
        id: 'hs-tour-link-valid',
        yaw: 0.75,
        pitch: -0.25,
      },
    ]);
  });

  it('filtre par type : conserve SCENE_LINK (présent), TOUR_LINK (résolu) et INFO, exclut MEDIA et URL', () => {
    const scene = createTestScene([
      {
        type: HotspotType.SCENE_LINK,
        id: 'hs-scene-link',
        yaw: 0.1,
        pitch: 0.1,
        label: 'Vers la pièce suivante',
        icon: HotspotIcon.ARROW,
        targetSceneId: 'scene-2',
      },
      {
        type: HotspotType.TOUR_LINK,
        id: 'hs-tour-link',
        yaw: 0.75,
        pitch: -0.25,
        label: 'Vers la visite du jardin',
        icon: HotspotIcon.PORTAL,
        targetTourId: 'tour-jardin',
      },
      {
        type: HotspotType.INFO,
        id: 'hs-info',
        yaw: -1.2,
        pitch: 0.4,
        label: 'Panneau historique',
        icon: HotspotIcon.INFO,
        bodyHtml: '<p>Description</p>',
        images: [],
      },
      {
        type: HotspotType.MEDIA,
        id: 'hs-media',
        yaw: 2.1,
        pitch: 0.3,
        label: 'Galerie photo',
        icon: HotspotIcon.PHOTO,
        media: [{ url: 'http://example.com/photo.jpg', mimeType: 'image/jpeg' }],
      },
      {
        type: HotspotType.URL,
        id: 'hs-url',
        yaw: -2.5,
        pitch: -0.15,
        label: 'Site officiel',
        icon: HotspotIcon.INFO,
        url: 'https://example.com',
      },
    ]);

    const scene2 = createTestScene([], 'scene-2');
    const graph = createTestGraph([scene, scene2], [
      {
        id: 'tour-jardin',
        title: 'Visite du jardin',
        shareToken: 'token-jardin',
      },
    ]);

    const targets = toVrTargets(scene, graph);

    expect(targets).toHaveLength(3);

    expect(targets).toEqual([
      {
        id: 'hs-scene-link',
        yaw: 0.1,
        pitch: 0.1,
      },
      {
        id: 'hs-tour-link',
        yaw: 0.75,
        pitch: -0.25,
      },
      {
        id: 'hs-info',
        yaw: -1.2,
        pitch: 0.4,
      },
    ]);

    const ids = targets.map((t) => t.id);
    expect(ids).not.toContain('hs-media');
    expect(ids).not.toContain('hs-url');
  });

  it('conservation des angles : préserve fidèlement yaw et pitch des hotspots retenus', () => {
    const scene = createTestScene([
      {
        type: HotspotType.SCENE_LINK,
        id: 'hs-angles-1',
        yaw: 3.14159,
        pitch: -0.8765,
        label: 'Destination',
        icon: HotspotIcon.ARROW,
        targetSceneId: 'scene-2',
      },
      {
        type: HotspotType.INFO,
        id: 'hs-angles-2',
        yaw: -2.71828,
        pitch: 0.54321,
        label: 'Détail',
        icon: HotspotIcon.INFO,
        bodyHtml: '<p>Info</p>',
        images: [],
      },
    ]);
    const scene2 = createTestScene([], 'scene-2');
    const graph = createTestGraph([scene, scene2]);

    const targets = toVrTargets(scene, graph);

    expect(targets).toHaveLength(2);
    expect(targets[0]?.id).toBe('hs-angles-1');
    expect(targets[0]?.yaw).toBeCloseTo(3.14159, 5);
    expect(targets[0]?.pitch).toBeCloseTo(-0.8765, 5);

    expect(targets[1]?.id).toBe('hs-angles-2');
    expect(targets[1]?.yaw).toBeCloseTo(-2.71828, 5);
    expect(targets[1]?.pitch).toBeCloseTo(0.54321, 5);
  });

  it('retourne un tableau vide quand la scène ne contient aucun hotspot', () => {
    const scene = createTestScene([]);
    const graph = createTestGraph([scene]);
    const targets = toVrTargets(scene, graph);
    expect(targets).toEqual([]);
  });

  it('retourne un tableau vide quand la scène ne contient que des types non éligibles VR', () => {
    const scene = createTestScene([
      {
        type: HotspotType.MEDIA,
        id: 'hs-2',
        yaw: 1,
        pitch: 0,
        label: 'Audio',
        icon: HotspotIcon.PHOTO,
        media: [{ url: 'http://example.com/audio.mp3', mimeType: 'audio/mpeg' }],
      },
      {
        type: HotspotType.URL,
        id: 'hs-3',
        yaw: -1,
        pitch: 0,
        label: 'Lien',
        icon: HotspotIcon.INFO,
        url: 'https://example.com',
      },
    ]);
    const graph = createTestGraph([scene]);

    const targets = toVrTargets(scene, graph);
    expect(targets).toEqual([]);
  });
});

describe('VR_EXIT_TARGET et VR_EXIT_TARGET_ID', () => {
  it('définit la constante VR_EXIT_TARGET_ID avec la valeur attendue', () => {
    expect(VR_EXIT_TARGET_ID).toBe('__xplor_vr_exit__');
  });

  it('définit la cible permanente de sortie VR avec yaw: 0 et pitch: -1.0 rad', () => {
    expect(VR_EXIT_TARGET).toEqual({
      id: '__xplor_vr_exit__',
      yaw: 0,
      pitch: -1.0,
    });
  });
});

describe('withExitTarget', () => {
  it('withExitTarget non mutant : ne modifie pas le tableau source et renvoie une nouvelle instance', () => {
    const originalTargets: readonly HotspotTarget[] = [
      { id: 'target-a', yaw: 0.5, pitch: 0.1 },
      { id: 'target-b', yaw: -0.8, pitch: -0.2 },
    ];
    const originalSnapshot = [
      { id: 'target-a', yaw: 0.5, pitch: 0.1 },
      { id: 'target-b', yaw: -0.8, pitch: -0.2 },
    ];

    const result = withExitTarget(originalTargets);

    // Le tableau original n'est pas muté
    expect(originalTargets).toHaveLength(2);
    expect(originalTargets).toEqual(originalSnapshot);

    // Le résultat est une nouvelle référence
    expect(result).not.toBe(originalTargets);
    expect(result).toHaveLength(3);

    // Les éléments d'origine sont conservés dans l'ordre
    expect(result[0]).toEqual(originalTargets[0]);
    expect(result[1]).toEqual(originalTargets[1]);

    // La cible de sortie VR est positionnée à la fin
    expect(result[2]).toEqual(VR_EXIT_TARGET);
  });

  it('ajoute la cible de sortie à la fin même pour un tableau vide', () => {
    const emptyTargets: HotspotTarget[] = [];
    const result = withExitTarget(emptyTargets);

    expect(emptyTargets).toHaveLength(0);
    expect(result).toEqual([VR_EXIT_TARGET]);
  });
});
