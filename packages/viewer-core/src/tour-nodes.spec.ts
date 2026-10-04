import { describe, it, expect } from 'vitest';
import { toTourNodes } from './tour-nodes.js';
import { TourGraph, HotspotType, HotspotIcon } from '@xplor/shared';

describe('toTourNodes', () => {
  it('converts a valid graph and filters links and null captions correctly', () => {
    const graph: TourGraph = {
      id: 'tour-1',
      contentVersion: 1,
      lang: 'fr',
      title: 'Tour Test',
      summary: 'Summary',
      city: 'City',
      categories: [],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      linkedTours: [],
      scenes: [
        {
          id: 'scene-1',
          title: 'Scene 1',
          caption: 'Caption 1',
          narrationUrl: null,
          ambientUrl: null,
          initialView: { yaw: 0, pitch: 0, zoom: 1 },
          panorama: {
            preview: 'preview-1.jpg',
            web: 'web-1.jpg',
            tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b1' }
          },
          thumb: 'thumb-1.jpg',
          hotspots: [
            {
              type: HotspotType.SCENE_LINK,
              id: 'h1',
              label: 'Go to 2',
              icon: HotspotIcon.ARROW,
              yaw: 1,
              pitch: 2,
              targetSceneId: 'scene-2',
            },
            {
              type: HotspotType.SCENE_LINK,
              id: 'h2',
              label: 'Go to missing',
              icon: HotspotIcon.ARROW,
              yaw: 3,
              pitch: 4,
              targetSceneId: 'scene-missing',
            },
            {
              type: HotspotType.INFO,
              id: 'h3',
              label: 'Info',
              icon: HotspotIcon.INFO,
              yaw: 0,
              pitch: 0,
              bodyHtml: 'Info',
              images: [],
            }
          ],
        },
        {
          id: 'scene-2',
          title: 'Scene 2',
          caption: null,
          narrationUrl: null,
          ambientUrl: null,
          initialView: { yaw: 0, pitch: 0, zoom: 1 },
          panorama: {
            preview: 'preview-2.jpg',
            web: 'web-2.jpg',
            tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b2' }
          },
          thumb: 'thumb-2.jpg',
          hotspots: [],
        },
      ],
    };

    const nodes = toTourNodes(graph);

    expect(nodes).toHaveLength(2);

    expect(nodes[0]).toEqual({
      id: 'scene-1',
      name: 'Scene 1',
      caption: 'Caption 1',
      panorama: 'web-1.jpg',
      thumbnail: 'thumb-1.jpg',
      links: [
        {
          nodeId: 'scene-2',
          position: { yaw: 1, pitch: 2 },
        },
      ],
    });

    expect(nodes[1]).toEqual({
      id: 'scene-2',
      name: 'Scene 2',
      panorama: 'web-2.jpg',
      thumbnail: 'thumb-2.jpg',
      links: [],
    });
    expect(nodes[1]).not.toHaveProperty('caption');
  });
});
