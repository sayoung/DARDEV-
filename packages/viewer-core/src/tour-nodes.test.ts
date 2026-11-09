import { describe, expect, it } from 'vitest';
import {
  TourGraphSchema,
  HotspotType,
  HotspotIcon,
  TourGraphHotspot,
  TourGraphScene,
  z,
} from '@xplor/shared';
import { toTourNodes, resolveTourLinkDir } from './tour-nodes.js';

const uuidA = '01990000-0000-7000-8000-00000000000a';
const scene1Id = '01990000-0000-7000-8000-000000000001';
const scene2Id = '01990000-0000-7000-8000-000000000002';
const scene3Id = '01990000-0000-7000-8000-000000000003';
const scene4Id = '01990000-0000-7000-8000-000000000004';
const missingSceneId = '01990000-0000-7000-8000-000000000005';

const validGraph = TourGraphSchema.parse({
  id: uuidA,
  contentVersion: 1,
  lang: 'fr',
  title: 'Test Graphe',
  summary: 'Résumé',
  city: 'Test City',
  categories: ['Test'],
  coverUrl: 'http://example.com/cover.jpg',
  practicalInfo: 'Infos',
  location: { lat: 0, lng: 0 },
  startSceneId: scene1Id,
  linkedTours: [],
  scenes: [
    {
      id: scene1Id,
      title: 'Scène 1',
      caption: 'Légende de la scène 1',
      panorama: {
        preview: 'http://example.com/preview1.jpg',
        web: 'http://example.com/web1.jpg',
        tiles: { width: 4096, cols: 8, rows: 4, baseUrl: 'http://example.com/tiles1/{col}_{row}.jpg' }
      },
      initialView: { yaw: 0, pitch: 0, zoom: 50 },
      narrationUrl: null,
      ambientUrl: null,
      thumb: 'http://example.com/thumb1.jpg',
      hotspots: [
        {
          id: 'hs1',
          type: 'SCENE_LINK',
          yaw: 1.5,
          pitch: -0.5,
          label: 'Aller à scène 2',
          icon: 'ARROW',
          targetSceneId: scene2Id,
          arrivalYaw: 0
        },
        {
          id: 'hs2',
          type: 'SCENE_LINK',
          yaw: 2.0,
          pitch: 0.1,
          label: 'Scène absente',
          icon: 'ARROW',
          targetSceneId: missingSceneId,
          arrivalYaw: 0
        },
        {
          id: 'hs3',
          type: 'INFO',
          yaw: -1.0,
          pitch: 0,
          label: 'Info',
          icon: 'INFO',
          bodyHtml: '<p>Info</p>',
          images: []
        },
        {
          id: 'hs4',
          type: 'TOUR_LINK',
          yaw: 0.5,
          pitch: 0.5,
          label: 'Autre visite',
          icon: 'PORTAL',
          targetTourId: '01990000-0000-7000-8000-00000000000b',
          targetSceneId: null
        },
        {
          id: 'hs5',
          type: 'URL',
          yaw: 1.0,
          pitch: 1.0,
          label: 'Lien Web',
          icon: 'INFO',
          url: 'https://example.com'
        }
      ]
    },
    {
      id: scene2Id,
      title: 'Scène 2',
      caption: null,
      panorama: {
        preview: 'http://example.com/preview2.jpg',
        web: 'http://example.com/web2.jpg',
        tiles: { width: 4096, cols: 8, rows: 4, baseUrl: 'http://example.com/tiles2/{col}_{row}.jpg' }
      },
      initialView: { yaw: 0, pitch: 0, zoom: 50 },
      narrationUrl: null,
      ambientUrl: null,
      thumb: 'http://example.com/thumb2.jpg',
      hotspots: []
    }
  ]
});

const PanoTilesTestSchema = z.object({
  width: z.number(),
  cols: z.number(),
  rows: z.number(),
  baseUrl: z.string(),
  tileUrl: z.custom<(col: number, row: number) => string>((val) => typeof val === 'function'),
});

describe('toTourNodes', () => {
  it('convertit un graphe en nœuds pour Photo Sphere Viewer en appliquant les règles de filtrage', () => {
    const nodes = toTourNodes(validGraph);

    // (1) ordre des nœuds identique, panorama.web, thumb, title
    expect(nodes).toHaveLength(2);
    
    const node0 = nodes[0];
    const node1 = nodes[1];
    if (!node0 || !node1) {
      throw new Error('Nœuds manquants');
    }

    expect(node0.id).toBe(scene1Id);
    expect(node1.id).toBe(scene2Id);

    expect(node0.name).toBe('Scène 1');

    expect(node0.panorama).toMatchObject({
      width: 4096,
      cols: 8,
      rows: 4,
      baseUrl: 'http://example.com/preview1.jpg',
    });

    const parsedPanorama = PanoTilesTestSchema.parse(node0.panorama);
    expect(parsedPanorama.tileUrl(3, 1)).toBe('http://example.com/tiles1/3_1.jpg');

    expect(node0.thumbnail).toBe('http://example.com/thumb1.jpg');

    // (2) hotspot SCENE_LINK vers une scène présente (conservé avec sa position et son label)
    // (3) hotspot SCENE_LINK vers une scène absente (ignoré)
    // (4) hotspots INFO, TOUR_LINK, URL (exclus)
    expect(node0.links).toEqual([
      {
        nodeId: scene2Id,
        position: { yaw: 1.5, pitch: -0.5 },
        data: { arrivalYaw: 0, label: 'Aller à scène 2', dir: 'next' }
      }
    ]);
    expect(node1.links).toEqual([]);

    // (5) caption absente (clé non définie) si null, présente sinon
    expect(node0.caption).toBe('Légende de la scène 1');
    expect(node1).not.toHaveProperty('caption');
  });

  it('gère correctement les directions de liens (next, prev, other, boucles début et fin)', () => {
    function makeHotspot(id: string, targetSceneId: string, label: string): TourGraphHotspot {
      return {
        type: HotspotType.SCENE_LINK,
        id,
        yaw: 0,
        pitch: 0,
        label,
        icon: HotspotIcon.ARROW,
        targetSceneId,
        arrivalYaw: 1.2,
      };
    }

    function makeScene(id: string, title: string, hotspots: TourGraphHotspot[]): TourGraphScene {
      return {
        id,
        title,
        caption: null,
        panorama: {
          preview: `http://example.com/prev-${id}.jpg`,
          web: `http://example.com/web-${id}.jpg`,
          tiles: { width: 4096, cols: 8, rows: 4, baseUrl: `http://example.com/tiles-${id}/{col}_{row}.jpg` },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: `http://example.com/thumb-${id}.jpg`,
        hotspots,
      };
    }

    // Graphe à 4 scènes : S1 (0), S2 (1), S3 (2), S4 (3)
    const fourScenesGraph = TourGraphSchema.parse({
      id: uuidA,
      contentVersion: 1,
      lang: 'fr',
      title: 'Visite 4 scènes',
      summary: 'Test directions',
      city: 'Rabat',
      categories: ['Test'],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: scene1Id,
      linkedTours: [],
      scenes: [
        makeScene(scene1Id, 'Scène 1', [
          makeHotspot('hs-1-next', scene2Id, 'Vers scène 2 (next)'),
          makeHotspot('hs-1-other', scene3Id, 'Vers scène 3 (other)'),
          makeHotspot('hs-1-prev', scene4Id, 'Vers scène 4 (prev - boucle début)'),
        ]),
        makeScene(scene2Id, 'Scène 2', [
          makeHotspot('hs-2-next', scene3Id, 'Vers scène 3 (next)'),
          makeHotspot('hs-2-prev', scene1Id, 'Vers scène 1 (prev)'),
        ]),
        makeScene(scene3Id, 'Scène 3', [
          makeHotspot('hs-3-next', scene4Id, 'Vers scène 4 (next)'),
          makeHotspot('hs-3-prev', scene2Id, 'Vers scène 2 (prev)'),
        ]),
        makeScene(scene4Id, 'Scène 4', [
          makeHotspot('hs-4-next', scene1Id, 'Vers scène 1 (next - boucle fin)'),
          makeHotspot('hs-4-prev', scene3Id, 'Vers scène 3 (prev)'),
          makeHotspot('hs-4-other', scene2Id, 'Vers scène 2 (other)'),
        ]),
      ],
    });

    const nodes = toTourNodes(fourScenesGraph);
    expect(nodes).toHaveLength(4);

    const n0 = nodes[0];
    const n1 = nodes[1];
    const n2 = nodes[2];
    const n3 = nodes[3];
    if (!n0 || !n1 || !n2 || !n3) {
      throw new Error('Nœuds manquants');
    }

    // Scène 1 (index 0)
    expect(n0.links).toEqual([
      {
        nodeId: scene2Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 2 (next)', dir: 'next' },
      },
      {
        nodeId: scene3Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 3 (other)', dir: 'other' },
      },
      {
        nodeId: scene4Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 4 (prev - boucle début)', dir: 'prev' },
      },
    ]);

    // Scène 2 (index 1)
    expect(n1.links).toEqual([
      {
        nodeId: scene3Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 3 (next)', dir: 'next' },
      },
      {
        nodeId: scene1Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 1 (prev)', dir: 'prev' },
      },
    ]);

    // Scène 3 (index 2)
    expect(n2.links).toEqual([
      {
        nodeId: scene4Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 4 (next)', dir: 'next' },
      },
      {
        nodeId: scene2Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 2 (prev)', dir: 'prev' },
      },
    ]);

    // Scène 4 (index 3) : boucle vers 1 (next), prev vers 3, other vers 2
    expect(n3.links).toEqual([
      {
        nodeId: scene1Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 1 (next - boucle fin)', dir: 'next' },
      },
      {
        nodeId: scene3Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 3 (prev)', dir: 'prev' },
      },
      {
        nodeId: scene2Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 1.2, label: 'Vers scène 2 (other)', dir: 'other' },
      },
    ]);
  });

  it('attribue dir: next lorsque next et prev coïncident sur un graphe à 1 ou 2 scènes', () => {
    function makeHotspot(id: string, targetSceneId: string): TourGraphHotspot {
      return {
        type: HotspotType.SCENE_LINK,
        id,
        yaw: 0,
        pitch: 0,
        label: 'Lien',
        icon: HotspotIcon.ARROW,
        targetSceneId,
        arrivalYaw: 0,
      };
    }

    function makeScene(id: string, hotspots: TourGraphHotspot[]): TourGraphScene {
      return {
        id,
        title: 'Titre',
        caption: null,
        panorama: {
          preview: `http://example.com/prev.jpg`,
          web: `http://example.com/web.jpg`,
          tiles: { width: 4096, cols: 8, rows: 4, baseUrl: `http://example.com/tiles/{col}_{row}.jpg` },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: `http://example.com/thumb.jpg`,
        hotspots,
      };
    }

    // 1 scène avec auto-lien
    const singleSceneGraph = TourGraphSchema.parse({
      id: uuidA,
      contentVersion: 1,
      lang: 'fr',
      title: '1 scène',
      summary: 'Test',
      city: 'Rabat',
      categories: ['Test'],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: scene1Id,
      linkedTours: [],
      scenes: [
        makeScene(scene1Id, [makeHotspot('hs-self', scene1Id)]),
      ],
    });

    const singleNodes = toTourNodes(singleSceneGraph);
    const sn0 = singleNodes[0];
    if (!sn0) {
      throw new Error('Nœud manquant');
    }
    expect(sn0.links).toEqual([
      {
        nodeId: scene1Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 0, label: 'Lien', dir: 'next' },
      },
    ]);

    // 2 scènes : 1 -> 2 et 2 -> 1 (next et prev coïncident, next l'emporte)
    const twoScenesGraph = TourGraphSchema.parse({
      id: uuidA,
      contentVersion: 1,
      lang: 'fr',
      title: '2 scènes',
      summary: 'Test',
      city: 'Rabat',
      categories: ['Test'],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: scene1Id,
      linkedTours: [],
      scenes: [
        makeScene(scene1Id, [makeHotspot('hs-1-2', scene2Id)]),
        makeScene(scene2Id, [makeHotspot('hs-2-1', scene1Id)]),
      ],
    });

    const twoNodes = toTourNodes(twoScenesGraph);
    const tn0 = twoNodes[0];
    const tn1 = twoNodes[1];
    if (!tn0 || !tn1) {
      throw new Error('Nœuds manquants');
    }
    expect(tn0.links).toEqual([
      {
        nodeId: scene2Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 0, label: 'Lien', dir: 'next' },
      },
    ]);
    expect(tn1.links).toEqual([
      {
        nodeId: scene1Id,
        position: { yaw: 0, pitch: 0 },
        data: { arrivalYaw: 0, label: 'Lien', dir: 'next' },
      },
    ]);
  });
});

describe('resolveTourLinkDir', () => {
  it('gère les cas limites et paramètres hors bornes', () => {
    expect(resolveTourLinkDir(0, 0, 0)).toBe('other');
    expect(resolveTourLinkDir(-1, 0, 3)).toBe('other');
    expect(resolveTourLinkDir(0, -1, 3)).toBe('other');
    expect(resolveTourLinkDir(0, 5, 3)).toBe('other');
    expect(resolveTourLinkDir(5, 0, 3)).toBe('other');
  });

  it('gère 1 scène : next et prev coïncident, next l\'emporte', () => {
    expect(resolveTourLinkDir(0, 0, 1)).toBe('next');
  });

  it('gère 2 scènes : next et prev coïncident, next l\'emporte', () => {
    expect(resolveTourLinkDir(0, 1, 2)).toBe('next');
    expect(resolveTourLinkDir(1, 0, 2)).toBe('next');
    expect(resolveTourLinkDir(0, 0, 2)).toBe('other');
    expect(resolveTourLinkDir(1, 1, 2)).toBe('other');
  });

  it('gère 3 scènes : boucles au début et à la fin', () => {
    // Scène 0 (début)
    expect(resolveTourLinkDir(0, 1, 3)).toBe('next');
    expect(resolveTourLinkDir(0, 2, 3)).toBe('prev'); // boucle au début : précédent de 0 = 2 (dernière scène)
    expect(resolveTourLinkDir(0, 0, 3)).toBe('other');

    // Scène 2 (fin)
    expect(resolveTourLinkDir(2, 0, 3)).toBe('next'); // boucle à la fin : suivant de 2 = 0 (première scène)
    expect(resolveTourLinkDir(2, 1, 3)).toBe('prev');
    expect(resolveTourLinkDir(2, 2, 3)).toBe('other');
  });

  it('gère 4 scènes : next, prev, other et boucles', () => {
    // Scène 0 : next=1, prev=3, other=2
    expect(resolveTourLinkDir(0, 1, 4)).toBe('next');
    expect(resolveTourLinkDir(0, 3, 4)).toBe('prev');
    expect(resolveTourLinkDir(0, 2, 4)).toBe('other');

    // Scène 1 : next=2, prev=0, other=3
    expect(resolveTourLinkDir(1, 2, 4)).toBe('next');
    expect(resolveTourLinkDir(1, 0, 4)).toBe('prev');
    expect(resolveTourLinkDir(1, 3, 4)).toBe('other');

    // Scène 3 (fin) : next=0 (boucle fin), prev=2, other=1
    expect(resolveTourLinkDir(3, 0, 4)).toBe('next');
    expect(resolveTourLinkDir(3, 2, 4)).toBe('prev');
    expect(resolveTourLinkDir(3, 1, 4)).toBe('other');
  });
});
