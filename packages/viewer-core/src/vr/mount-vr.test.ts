/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourGraphSchema } from '@xplor/shared';
import { mountVr } from './mount-vr.js';
import * as indexExports from '../index.js';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    xr = {
      enabled: false,
      setReferenceSpaceType: vi.fn(),
      setSession: vi.fn().mockResolvedValue(undefined),
    };
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    setAnimationLoop = vi.fn();
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('mountVr (M6 F-70, F-71)', () => {
  let container: HTMLDivElement;

  const validGraph = TourGraphSchema.parse({
    id: '01990000-0000-7000-8000-00000000000a',
    contentVersion: 1,
    lang: 'fr',
    title: 'Visite test VR',
    summary: 'Résumé test',
    city: 'Rabat',
    categories: ['Monument'],
    coverUrl: 'http://example.com/cover.jpg',
    practicalInfo: 'Infos',
    location: { lat: 34.0, lng: -6.8 },
    startSceneId: 'scene-1',
    linkedTours: [],
    scenes: [
      {
        id: 'scene-1',
        title: 'Scène 1',
        caption: 'Légende 1',
        panorama: {
          preview: 'http://example.com/preview1.jpg',
          web: 'http://example.com/web1.jpg',
          tiles: {
            width: 4096,
            cols: 8,
            rows: 4,
            baseUrl: 'http://example.com/tiles1/{col}_{row}.jpg',
          },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'http://example.com/thumb1.jpg',
        hotspots: [],
      },
    ],
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('exporte mountVr depuis index.ts', () => {
    expect(indexExports.mountVr).toBe(mountVr);
  });

  it('sans navigator.xr (navigatorLike = {}), aucun bouton n est ajoute au container happy-dom et destroy() est idempotent', async () => {
    const handle = await mountVr(container, {
      label: 'Mode VR',
      graph: validGraph,
      getCurrentSceneId: () => 'scene-1',
      showScene: async () => {},
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
      navigatorLike: {},
    });

    expect(container.children.length).toBe(0);
    expect(container.querySelector('button')).toBeNull();

    // Vérifie que destroy() est idempotent
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(container.children.length).toBe(0);
  });

  it('sans navigatorLike et sans navigator.xr global, aucun bouton n est ajoute et destroy() est idempotent', async () => {
    const handle = await mountVr(container, {
      label: 'Mode VR',
      graph: validGraph,
      getCurrentSceneId: () => 'scene-1',
      showScene: async () => {},
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
    });

    expect(container.children.length).toBe(0);
    expect(container.querySelector('button')).toBeNull();

    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(() => {
      handle.destroy();
    }).not.toThrow();
  });

  it('avec WebXR pris en charge, monte le bouton dans le conteneur puis le retire via destroy() idempotent', async () => {
    const fakeNavigator = {
      xr: {
        isSessionSupported: () => Promise.resolve(true),
      },
    };

    const handle = await mountVr(container, {
      label: 'Entrer en VR',
      graph: validGraph,
      getCurrentSceneId: () => 'scene-1',
      showScene: async () => {},
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
      navigatorLike: fakeNavigator,
    });

    expect(container.children.length).toBe(1);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      expect(button.textContent).toBe('Entrer en VR');
      expect(button.getAttribute('aria-label')).toBe('Entrer en VR');
      expect(button.className).toBe('xplor-vr-button');
    }

    handle.destroy();
    expect(container.children.length).toBe(0);

    // Vérifie l idempotence de destroy()
    expect(() => {
      handle.destroy();
    }).not.toThrow();
    expect(container.children.length).toBe(0);
  });

  it('lors du clic sur le bouton VR, requestSession reçoit immersive-vr et optionalFeatures local-floor', async () => {
    const fakeSession = {
      addEventListener: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    };
    const requestSessionMock = vi.fn().mockResolvedValue(fakeSession);

    const fakeNavigator = {
      xr: {
        isSessionSupported: () => Promise.resolve(true),
        requestSession: requestSessionMock,
      },
    };

    const handle = await mountVr(container, {
      label: 'Entrer en VR',
      graph: validGraph,
      getCurrentSceneId: () => 'scene-1',
      showScene: async () => {},
      resolveTextureUrl: () => null,
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    await vi.waitFor(() => {
      expect(requestSessionMock).toHaveBeenCalledWith('immersive-vr', {
        optionalFeatures: ['local-floor'],
      });
    });

    handle.destroy();
  });
});
