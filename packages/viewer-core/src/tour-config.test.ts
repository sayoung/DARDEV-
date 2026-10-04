import { describe, it, expect } from 'vitest';
import { tourPluginOptions, TRANSITION_MS } from './tour-config.js';
import { TourGraphSchema } from '@xplor/shared';

describe('tourPluginOptions', () => {
  const validGraph = TourGraphSchema.parse({
    id: 'tour-1',
    contentVersion: 1,
    lang: 'fr',
    title: 'Test',
    summary: 'Test',
    city: 'Test',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        title: 'S1',
        caption: null,
        panorama: {
          preview: 'p1',
          web: 'w1',
          tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b1' }
        },
        initialView: { yaw: 0, pitch: 0, zoom: 1 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 't1',
        hotspots: []
      },
      {
        id: 'scene-2',
        title: 'S2',
        caption: null,
        panorama: {
          preview: 'p2',
          web: 'w2',
          tiles: { width: 1, cols: 1, rows: 1, baseUrl: 'b2' }
        },
        initialView: { yaw: 0, pitch: 0, zoom: 1 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 't2',
        hotspots: []
      }
    ],
    linkedTours: []
  });

  it('uses provided sceneId if valid', () => {
    const options = tourPluginOptions(validGraph, 'scene-2');
    expect(options.startNodeId).toBe('scene-2');
  });

  it('falls back to startSceneId if provided sceneId is unknown', () => {
    const options = tourPluginOptions(validGraph, 'unknown');
    expect(options.startNodeId).toBe('scene-1');
  });

  it('falls back to startSceneId if provided sceneId is null', () => {
    const options = tourPluginOptions(validGraph, null);
    expect(options.startNodeId).toBe('scene-1');
  });

  it('returns valid configuration with correct number of nodes', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.nodes).toHaveLength(2);
    expect(options.positionMode).toBe('manual');
    expect(options.renderMode).toBe('3d');
  });

  it('configures transition options correctly', () => {
    const options = tourPluginOptions(validGraph);
    expect(options.transitionOptions).toEqual({
      effect: 'fade',
      speed: TRANSITION_MS
    });
  });
});
