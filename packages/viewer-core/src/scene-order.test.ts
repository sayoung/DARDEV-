import { describe, it, expect } from 'vitest';
import { adjacentScenes } from './scene-order.js';
import { TourGraphSchema, TourGraph } from '@xplor/shared';

function createMockGraph(sceneIds: string[]): TourGraph {
  const scenes = sceneIds.map((id) => ({
    id,
    title: `Scene ${id}`,
    caption: null,
    panorama: {
      preview: 'http://example.com/preview.jpg',
      web: 'http://example.com/web.jpg',
      tiles: {
        width: 1000,
        cols: 2,
        rows: 2,
        baseUrl: 'http://example.com/tiles',
      },
    },
    initialView: { yaw: 0, pitch: 0, zoom: 50 },
    narrationUrl: null,
    ambientUrl: null,
    thumb: 'http://example.com/thumb.jpg',
    hotspots: [],
  }));

  const graph = {
    id: 'tour-1',
    contentVersion: 1,
    lang: 'fr',
    title: 'Test Tour',
    summary: 'Test summary',
    city: 'Test City',
    categories: ['Test Category'],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: sceneIds[0] || 'scene-0',
    scenes,
    linkedTours: [],
  };

  return TourGraphSchema.parse(graph);
}

describe('adjacentScenes', () => {
  it('should return correct adjacencies for the first scene in a 3-scene graph', () => {
    const graph = createMockGraph(['scene-1', 'scene-2', 'scene-3']);
    const result = adjacentScenes(graph, 'scene-1');
    expect(result).toEqual({
      previous: null,
      next: 'scene-2',
      index: 0,
      total: 3,
    });
  });

  it('should return correct adjacencies for the middle scene in a 3-scene graph', () => {
    const graph = createMockGraph(['scene-1', 'scene-2', 'scene-3']);
    const result = adjacentScenes(graph, 'scene-2');
    expect(result).toEqual({
      previous: 'scene-1',
      next: 'scene-3',
      index: 1,
      total: 3,
    });
  });

  it('should return correct adjacencies for the last scene in a 3-scene graph', () => {
    const graph = createMockGraph(['scene-1', 'scene-2', 'scene-3']);
    const result = adjacentScenes(graph, 'scene-3');
    expect(result).toEqual({
      previous: 'scene-2',
      next: null,
      index: 2,
      total: 3,
    });
  });

  it('should handle a graph with a single scene', () => {
    const graph = createMockGraph(['scene-1']);
    const result = adjacentScenes(graph, 'scene-1');
    expect(result).toEqual({
      previous: null,
      next: null,
      index: 0,
      total: 1,
    });
  });

  it('should throw an error if the sceneId is unknown', () => {
    const graph = createMockGraph(['scene-1', 'scene-2', 'scene-3']);
    expect(() => adjacentScenes(graph, 'unknown-scene')).toThrowError(
      "Scene with id 'unknown-scene' not found"
    );
  });
});
