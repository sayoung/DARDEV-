import { describe, expect, it } from 'vitest';
import { TourGraphSchema } from '@xplor/shared';
import { toTourNodes } from './tour-nodes.js';

const uuidA = '01990000-0000-7000-8000-00000000000a';
const scene1Id = '01990000-0000-7000-8000-000000000001';
const scene2Id = '01990000-0000-7000-8000-000000000002';
const missingSceneId = '01990000-0000-7000-8000-000000000003';

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const panoramaObj = node0.panorama;
    expect(panoramaObj).toMatchObject({
      width: 4096,
      cols: 8,
      rows: 4,
      baseUrl: 'http://example.com/preview1.jpg',
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    expect(node0.panorama.tileUrl(3, 1)).toBe('http://example.com/tiles1/3_1.jpg');

    expect(node0.thumbnail).toBe('http://example.com/thumb1.jpg');

    // (2) hotspot SCENE_LINK vers une scène présente (conservé avec sa position)
    // (3) hotspot SCENE_LINK vers une scène absente (ignoré)
    // (4) hotspots INFO, TOUR_LINK, URL (exclus)
    expect(node0.links).toEqual([
      {
        nodeId: scene2Id,
        position: { yaw: 1.5, pitch: -0.5 }
      }
    ]);
    expect(node1.links).toEqual([]);

    // (5) caption absente (clé non définie) si null, présente sinon
    expect(node0.caption).toBe('Légende de la scène 1');
    expect(node1).not.toHaveProperty('caption');
  });
});
