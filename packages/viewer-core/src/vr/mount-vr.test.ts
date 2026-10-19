/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourGraphSchema } from '@xplor/shared';
import { mountVr } from './mount-vr.js';
import * as indexExports from '../index.js';

const { mockLoadAsync } = vi.hoisted(() => ({
  mockLoadAsync: vi.fn<(url: string) => Promise<import('three').Texture>>(),
}));

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
  class MockTextureLoader {
    loadAsync = (url: string): Promise<import('three').Texture> => {
      return mockLoadAsync(url);
    };
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    TextureLoader: MockTextureLoader,
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
    mockLoadAsync.mockReset();
    mockLoadAsync.mockImplementation(() =>
      Promise.resolve(new THREE.Texture()),
    );
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

  it('requestSession est appele avant la resolution d un loadAsync de texture mocke en promesse differee', async () => {
    let resolveTexturePromise: (value: THREE.Texture) => void = () => {};
    let textureResolved = false;
    let requestSessionCalledBeforeTextureResolved = false;

    const deferredTexturePromise = new Promise<THREE.Texture>((resolve) => {
      resolveTexturePromise = (texture: THREE.Texture) => {
        textureResolved = true;
        resolve(texture);
      };
    });

    mockLoadAsync.mockReturnValue(deferredTexturePromise);

    const fakeSession = {
      addEventListener: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    };

    const requestSessionMock = vi.fn().mockImplementation(() => {
      if (!textureResolved) {
        requestSessionCalledBeforeTextureResolved = true;
      }
      return Promise.resolve(fakeSession);
    });

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
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    // Dans le geste du clic synchrone, requestSession est déclenché avant la résolution de la texture
    expect(requestSessionMock).toHaveBeenCalledTimes(1);
    expect(requestSessionCalledBeforeTextureResolved).toBe(true);
    expect(textureResolved).toBe(false);

    // Résolution de la promesse différée de texture
    resolveTexturePromise(new THREE.Texture());

    await vi.waitFor(() => {
      expect(textureResolved).toBe(true);
    });

    handle.destroy();
  });

  it('un echec de chargement de texture apres entree n appelle pas session.end et ne rejette pas', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockLoadAsync.mockRejectedValue(new Error('Texture load failure'));

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
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    await vi.waitFor(() => {
      expect(requestSessionMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // La session reste ouverte : session.end n'a pas été appelé
    expect(fakeSession.end).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    handle.destroy();
  });

  it('un requestSession qui rejette affiche le message d erreur, ne produit aucun unhandledRejection et demonte le renderer', async () => {
    const unhandledRejections: unknown[] = [];
    const handleUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', handleUnhandledRejection);

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const requestSessionMock = vi
      .fn()
      .mockRejectedValue(new Error('WebXR requestSession denied'));

    const fakeNavigator = {
      xr: {
        isSessionSupported: () => Promise.resolve(true),
        requestSession: requestSessionMock,
      },
    };

    const handle = await mountVr(container, {
      label: 'Entrer en VR',
      startFailedLabel: "La VR n'a pas pu démarrer",
      graph: validGraph,
      getCurrentSceneId: () => 'scene-1',
      showScene: async () => {},
      resolveTextureUrl: () => 'http://example.com/web1.jpg',
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    await vi.waitFor(() => {
      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toBe("La VR n'a pas pu démarrer");
      expect(alert?.getAttribute('role')).toBe('alert');
    });

    // Aucun unhandledRejection
    expect(unhandledRejections).toHaveLength(0);

    // Le renderer Three.js est démonté (aucun canvas dans le conteneur)
    expect(container.querySelector('canvas')).toBeNull();

    // console.error a bien capturé l'erreur
    expect(consoleErrorSpy).toHaveBeenCalled();

    // destroy() retire le message d'alerte et nettoie le conteneur
    handle.destroy();
    expect(container.querySelector('[role="alert"]')).toBeNull();

    consoleErrorSpy.mockRestore();
    process.off('unhandledRejection', handleUnhandledRejection);
  });

  it('le message d erreur role="alert" disparait automatiquement apres ~4s', async () => {
    vi.useFakeTimers();
    try {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const requestSessionMock = vi
        .fn()
        .mockRejectedValue(new Error('WebXR requestSession failed'));

      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: requestSessionMock,
        },
      };

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        startFailedLabel: "La VR n'a pas pu démarrer",
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

      await vi.advanceTimersByTimeAsync(0);

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toBe("La VR n'a pas pu démarrer");

      // Après 4 secondes (~4s), l'élément est automatiquement retiré
      await vi.advanceTimersByTimeAsync(4000);
      expect(container.querySelector('[role="alert"]')).toBeNull();

      consoleErrorSpy.mockRestore();
      handle.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
