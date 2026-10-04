import { describe, it, expect, vi } from 'vitest';
import { createTourNavigator } from './tour-navigator.js';
import { TourGraph } from '@xplor/shared';

function createMockGraph(): TourGraph {
  return {
    id: 'test-tour',
    contentVersion: 1,
    lang: 'fr',
    title: 'Test Tour',
    summary: 'Test summary',
    city: 'Test City',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        title: 'Scene 1',
        caption: null,
        panorama: {
          preview: 'preview.jpg',
          web: 'web.jpg',
          tiles: { width: 1024, cols: 2, rows: 1, baseUrl: 'tiles' },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'thumb1.jpg',
        hotspots: [],
      },
      {
        id: 'scene-2',
        title: 'Scene 2',
        caption: null,
        panorama: {
          preview: 'preview2.jpg',
          web: 'web2.jpg',
          tiles: { width: 1024, cols: 2, rows: 1, baseUrl: 'tiles2' },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'thumb2.jpg',
        hotspots: [],
      },
    ],
    linkedTours: [],
  };
}

describe('createTourNavigator', () => {
  it('current() is null initially', () => {
    const load = vi.fn();
    const navigator = createTourNavigator({ load });
    expect(navigator.current()).toBeNull();
  });

  it('opens with a valid scene', async () => {
    const graph = createMockGraph();
    const load = vi.fn().mockResolvedValue(graph);
    const navigator = createTourNavigator({ load });

    await navigator.open('token1', 'scene-2');

    expect(load).toHaveBeenCalledWith('token1');
    expect(navigator.current()).toEqual({
      shareToken: 'token1',
      graph,
      sceneId: 'scene-2',
    });
  });

  it('falls back to startSceneId for an unknown scene', async () => {
    const graph = createMockGraph();
    const load = vi.fn().mockResolvedValue(graph);
    const navigator = createTourNavigator({ load });

    await navigator.open('token1', 'unknown-scene');

    expect(navigator.current()).toEqual({
      shareToken: 'token1',
      graph,
      sceneId: 'scene-1', // startSceneId
    });
  });

  it('falls back to startSceneId if sceneId is null or absent', async () => {
    const graph = createMockGraph();
    const load = vi.fn().mockResolvedValue(graph);
    const navigator = createTourNavigator({ load });

    await navigator.open('token1', null);
    expect(navigator.current()?.sceneId).toBe('scene-1');

    await navigator.open('token2');
    expect(navigator.current()?.sceneId).toBe('scene-1');
  });

  it('keeps current state unchanged if load fails', async () => {
    const graph = createMockGraph();
    let shouldFail = false;
    const load = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(new Error('Load failed'));
      }
      return Promise.resolve(graph);
    });

    const navigator = createTourNavigator({ load });

    // Open first successfully
    await navigator.open('token1', 'scene-2');
    const firstState = navigator.current();
    expect(firstState?.sceneId).toBe('scene-2');

    // Try to open another one and fail
    shouldFail = true;
    await expect(navigator.open('token2', 'scene-1')).rejects.toThrow('Load failed');

    // State should remain unchanged
    expect(navigator.current()).toEqual(firstState);
  });
});
