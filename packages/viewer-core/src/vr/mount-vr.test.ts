/**
 * @vitest-environment happy-dom
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HotspotIcon, HotspotType, TourGraphSchema } from '@xplor/shared';
import { mountVr } from './mount-vr.js';
import * as indexExports from '../index.js';

const { mockLoadAsync, mockSetAnimationLoop } = vi.hoisted(() => ({
  mockLoadAsync: vi.fn<(url: string) => Promise<import('three').Texture>>(),
  mockSetAnimationLoop: vi.fn<(cb: ((time: number) => void) | null) => void>(),
}));

let lastControllers: import('three').Group[] = [];

function getLastControllers(): readonly import('three').Group[] {
  return lastControllers;
}

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    controllers: import('three').Group[] = [
      new actual.Group(),
      new actual.Group(),
    ];
    xr = {
      enabled: false,
      setReferenceSpaceType: vi.fn(),
      setSession: vi.fn().mockResolvedValue(undefined),
      getController: (index: number) => {
        while (this.controllers.length <= index) {
          this.controllers.push(new actual.Group());
        }
        const ctrl = this.controllers[index];
        if (ctrl !== undefined) {
          return ctrl;
        }
        const fallback = new actual.Group();
        this.controllers.push(fallback);
        return fallback;
      },
    };
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    setAnimationLoop = (cb: ((time: number) => void) | null) => {
      mockSetAnimationLoop(cb);
    };

    constructor() {
      lastControllers = this.controllers;
    }
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
    mockSetAnimationLoop.mockReset();
    lastControllers = [];
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

  it('(b) sélection d un SCENE_LINK → loadTexture et showScene appelés avec la cible, cibles mises à jour avec celles de la nouvelle scène, session toujours active', async () => {
    const graphWithSceneLink = TourGraphSchema.parse({
      id: '01990000-0000-7000-8000-00000000000b',
      contentVersion: 1,
      lang: 'fr',
      title: 'Visite multi-scène VR',
      summary: 'Résumé',
      city: 'Rabat',
      categories: ['Monument'],
      coverUrl: 'http://example.com/cover.jpg',
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      linkedTours: [],
      scenes: [
        {
          id: 'scene-1',
          title: 'Scène 1',
          caption: null,
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
          hotspots: [
            {
              type: HotspotType.SCENE_LINK,
              id: 'hs-link-scene-2',
              yaw: 0,
              pitch: 0,
              label: 'Vers scène 2',
              icon: HotspotIcon.ARROW,
              targetSceneId: 'scene-2',
              arrivalYaw: 1.57,
            },
          ],
        },
        {
          id: 'scene-2',
          title: 'Scène 2',
          caption: null,
          panorama: {
            preview: 'http://example.com/preview2.jpg',
            web: 'http://example.com/web2.jpg',
            tiles: {
              width: 4096,
              cols: 8,
              rows: 4,
              baseUrl: 'http://example.com/tiles2/{col}_{row}.jpg',
            },
          },
          initialView: { yaw: 0, pitch: 0, zoom: 50 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'http://example.com/thumb2.jpg',
          hotspots: [
            {
              type: HotspotType.SCENE_LINK,
              id: 'hs-link-scene-1',
              yaw: 1.0,
              pitch: 0,
              label: 'Vers scène 1',
              icon: HotspotIcon.ARROW,
              targetSceneId: 'scene-1',
            },
          ],
        },
      ],
    });

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

    let currentSceneId = 'scene-1';
    const showSceneSpy = vi.fn((targetId: string) => {
      currentSceneId = targetId;
      return Promise.resolve();
    });

    const handle = await mountVr(container, {
      label: 'Entrer en VR',
      graph: graphWithSceneLink,
      getCurrentSceneId: () => currentSceneId,
      showScene: showSceneSpy,
      resolveTextureUrl: (id: string) => `http://example.com/${id}.jpg`,
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    await vi.waitFor(() => {
      expect(mockSetAnimationLoop).toHaveBeenCalled();
    });

    const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
    expect(animationCallback).toBeDefined();

    if (animationCallback !== undefined && animationCallback !== null) {
      animationCallback(0);
      animationCallback(2100);
      animationCallback(2300);
    }

    await vi.waitFor(() => {
      expect(showSceneSpy).toHaveBeenCalledWith('scene-2');
    });

    expect(mockLoadAsync).toHaveBeenCalledWith('http://example.com/scene-2.jpg');
    expect(fakeSession.end).not.toHaveBeenCalled();

    handle.destroy();
  });

  it('(d) TOUR_LINK résolu → session.exit puis openTourLink(hotspotId), aucun showScene local', async () => {
    const graphWithTourLink = TourGraphSchema.parse({
      id: '01990000-0000-7000-8000-00000000000c',
      contentVersion: 1,
      lang: 'fr',
      title: 'Visite lien tour VR',
      summary: 'Résumé',
      city: 'Rabat',
      categories: ['Monument'],
      coverUrl: 'http://example.com/cover.jpg',
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      linkedTours: [
        {
          id: 'tour-ext-1',
          title: 'Visite externe',
          shareToken: 'token-ext-abc',
          coverUrl: 'http://example.com/cover-ext.jpg',
          availableOffline: true,
        },
      ],
      scenes: [
        {
          id: 'scene-1',
          title: 'Scène 1',
          caption: null,
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
          hotspots: [
            {
              type: HotspotType.TOUR_LINK,
              id: 'hs-link-tour-ext',
              yaw: 0,
              pitch: 0,
              label: 'Vers visite externe',
              icon: HotspotIcon.PORTAL,
              targetTourId: 'tour-ext-1',
            },
          ],
        },
      ],
    });

    const callOrder: string[] = [];
    const fakeSession = {
      addEventListener: vi.fn(),
      end: vi.fn().mockImplementation(() => {
        callOrder.push('session.end');
        return Promise.resolve();
      }),
    };
    const requestSessionMock = vi.fn().mockResolvedValue(fakeSession);
    const fakeNavigator = {
      xr: {
        isSessionSupported: () => Promise.resolve(true),
        requestSession: requestSessionMock,
      },
    };

    const showSceneSpy = vi.fn(() => Promise.resolve());
    const openTourLinkSpy = vi.fn((id: string) => {
      callOrder.push(`openTourLink:${id}`);
      return Promise.resolve();
    });

    const handle = await mountVr(container, {
      label: 'Entrer en VR',
      graph: graphWithTourLink,
      getCurrentSceneId: () => 'scene-1',
      showScene: showSceneSpy,
      openTourLink: openTourLinkSpy,
      resolveTextureUrl: () => null,
      navigatorLike: fakeNavigator,
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    if (button !== null) {
      button.click();
    }

    await vi.waitFor(() => {
      expect(mockSetAnimationLoop).toHaveBeenCalled();
    });

    const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
    expect(animationCallback).toBeDefined();

    if (animationCallback !== undefined && animationCallback !== null) {
      animationCallback(0);
      animationCallback(2100);
      animationCallback(2300);
    }

    await vi.waitFor(() => {
      expect(openTourLinkSpy).toHaveBeenCalledWith('hs-link-tour-ext');
    });

    expect(callOrder).toEqual([
      'session.end',
      'openTourLink:hs-link-tour-ext',
    ]);
    expect(showSceneSpy).not.toHaveBeenCalled();

    handle.destroy();
  });

  describe('Navigation VR par visée main/manette (M6 F-71)', () => {
    class OpaqueXRSpace {
      readonly __brand = 'XRSpace';
    }

    const graphWithSceneLink = TourGraphSchema.parse({
      id: '01990000-0000-7000-8000-00000000000b',
      contentVersion: 1,
      lang: 'fr',
      title: 'Visite multi-scène VR',
      summary: 'Résumé',
      city: 'Rabat',
      categories: ['Monument'],
      coverUrl: 'http://example.com/cover.jpg',
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      linkedTours: [],
      scenes: [
        {
          id: 'scene-1',
          title: 'Scène 1',
          caption: null,
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
          hotspots: [
            {
              type: HotspotType.SCENE_LINK,
              id: 'hs-link-scene-2',
              yaw: 0,
              pitch: 0,
              label: 'Vers scène 2',
              icon: HotspotIcon.ARROW,
              targetSceneId: 'scene-2',
              arrivalYaw: 1.57,
            },
          ],
        },
        {
          id: 'scene-2',
          title: 'Scène 2',
          caption: null,
          panorama: {
            preview: 'http://example.com/preview2.jpg',
            web: 'http://example.com/web2.jpg',
            tiles: {
              width: 4096,
              cols: 8,
              rows: 4,
              baseUrl: 'http://example.com/tiles2/{col}_{row}.jpg',
            },
          },
          initialView: { yaw: 0, pitch: 0, zoom: 50 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'http://example.com/thumb2.jpg',
          hotspots: [],
        },
      ],
    });

    it('affiche un rayon de visée visible attaché au contrôleur Three.js dans la scène', async () => {
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
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
        expect(fakeSession.addEventListener).toHaveBeenCalledWith(
          'select',
          expect.any(Function),
        );
      });

      const controllers = getLastControllers();
      expect(controllers.length).toBeGreaterThan(0);
      const controller = controllers[0];
      expect(controller).toBeDefined();
      if (controller !== undefined) {
        const ray = controller.getObjectByName('xplor-vr-ray');
        expect(ray).toBeDefined();
        expect(ray).toBeInstanceOf(THREE.Line);
        expect(controller.parent).not.toBeNull();
      }

      handle.destroy();
    });

    it('active le hotspot visé via selectNow lors d un événement select réaliste avec XRSpace opaque', async () => {
      const selectListeners: ((event: unknown) => void)[] = [];
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn((type: string, listener: (ev: unknown) => void) => {
          if (type === 'select') {
            selectListeners.push(listener);
          }
        }),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const showSceneSpy = vi.fn().mockResolvedValue(undefined);

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
        getCurrentSceneId: () => 'scene-1',
        showScene: showSceneSpy,
        resolveTextureUrl: () => null,
        navigatorLike: fakeNavigator,
      });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      if (button !== null) {
        button.click();
      }

      await vi.waitFor(() => {
        expect(selectListeners.length).toBeGreaterThan(0);
        expect(mockSetAnimationLoop).toHaveBeenCalled();
      });

      const controller = getLastControllers()[0];
      expect(controller).toBeDefined();
      if (controller !== undefined) {
        // Le contrôleur pointe par défaut le long de son axe local -Z (yaw: 0, pitch: 0),
        // aligné sur le hotspot hs-link-scene-2 situé à yaw: 0, pitch: 0
        controller.rotation.set(0, 0, 0);
        controller.updateMatrixWorld();
      }

      // Événement WebXR réaliste émis sur la session avec un XRSpace opaque
      const selectCallback = selectListeners[0];
      expect(selectCallback).toBeDefined();
      if (selectCallback !== undefined) {
        selectCallback({
          type: 'select',
          inputSource: fakeInputSource,
          timeStamp: 100,
        });
      }

      const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
      expect(animationCallback).toBeDefined();
      if (animationCallback !== undefined && animationCallback !== null) {
        animationCallback(0);
        animationCallback(150);
        animationCallback(300);
      }

      await vi.waitFor(() => {
        expect(showSceneSpy).toHaveBeenCalledWith('scene-2');
      });

      handle.destroy();
    });

    it('n active aucune sélection lorsque select est déclenché alors que le contrôleur ne vise aucun hotspot', async () => {
      const selectListeners: ((event: unknown) => void)[] = [];
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn((type: string, listener: (ev: unknown) => void) => {
          if (type === 'select') {
            selectListeners.push(listener);
          }
        }),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const showSceneSpy = vi.fn().mockResolvedValue(undefined);

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
        getCurrentSceneId: () => 'scene-1',
        showScene: showSceneSpy,
        resolveTextureUrl: () => null,
        navigatorLike: fakeNavigator,
      });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      if (button !== null) {
        button.click();
      }

      await vi.waitFor(() => {
        expect(selectListeners.length).toBeGreaterThan(0);
        expect(mockSetAnimationLoop).toHaveBeenCalled();
      });

      const controller = getLastControllers()[0];
      expect(controller).toBeDefined();
      if (controller !== undefined) {
        // Vise le zénith (pitch: π/2) en dehors de tout hotspot
        controller.rotation.x = Math.PI / 2;
        controller.updateMatrixWorld();
      }

      const selectCallback = selectListeners[0];
      expect(selectCallback).toBeDefined();
      if (selectCallback !== undefined) {
        selectCallback({
          type: 'select',
          inputSource: fakeInputSource,
          timeStamp: 100,
        });
      }

      const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
      expect(animationCallback).toBeDefined();
      if (animationCallback !== undefined && animationCallback !== null) {
        animationCallback(0);
        animationCallback(150);
        animationCallback(300);
      }

      expect(showSceneSpy).not.toHaveBeenCalled();

      handle.destroy();
    });

    it('maintient le regard avec dwell de 2 s comme secours lorsque la manette n est pas utilisée', async () => {
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const showSceneSpy = vi.fn().mockResolvedValue(undefined);

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
        getCurrentSceneId: () => 'scene-1',
        showScene: showSceneSpy,
        resolveTextureUrl: () => null,
        navigatorLike: fakeNavigator,
      });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      if (button !== null) {
        button.click();
      }

      await vi.waitFor(() => {
        expect(mockSetAnimationLoop).toHaveBeenCalled();
      });

      const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
      expect(animationCallback).toBeDefined();
      if (animationCallback !== undefined && animationCallback !== null) {
        // Aucune interaction par manette : regard maintenu pendant 2 s (dwell de fixation)
        animationCallback(0);
        animationCallback(1000);
        animationCallback(2000);
        animationCallback(2150);
      }

      await vi.waitFor(() => {
        expect(showSceneSpy).toHaveBeenCalledWith('scene-2');
      });

      handle.destroy();
    });

    it('nettoie les écouteurs XR et détache/dispose les rayons lors d un événement end émis par la session WebXR', async () => {
      const endListeners: (() => void)[] = [];
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn((type: string, listener: () => void) => {
          if (type === 'end') {
            endListeners.push(listener);
          }
        }),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
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
        expect(endListeners.length).toBeGreaterThan(0);
      });

      const controller = getLastControllers()[0];
      expect(controller).toBeDefined();
      if (controller !== undefined) {
        expect(controller.getObjectByName('xplor-vr-ray')).toBeDefined();
        expect(controller.parent).not.toBeNull();
      }

      // Émission de l'événement 'end' par le casque ou runtime WebXR
      const endCallback = endListeners[0];
      expect(endCallback).toBeDefined();
      if (endCallback !== undefined) {
        endCallback();
      }

      // Les écouteurs WebXR sont retirés
      expect(fakeSession.removeEventListener).toHaveBeenCalledWith(
        'select',
        expect.any(Function),
      );
      expect(fakeSession.removeEventListener).toHaveBeenCalledWith(
        'end',
        expect.any(Function),
      );

      // Le rayon est détaché et le contrôleur est retiré de la scène
      if (controller !== undefined) {
        expect(controller.getObjectByName('xplor-vr-ray')).toBeUndefined();
        expect(controller.parent).toBeNull();
      }

      handle.destroy();
    });

    it('nettoie les écouteurs XR et détache/dispose les rayons au destroy() du handle', async () => {
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
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
        expect(fakeSession.addEventListener).toHaveBeenCalledWith(
          'select',
          expect.any(Function),
        );
      });

      const controller = getLastControllers()[0];
      expect(controller).toBeDefined();
      if (controller !== undefined) {
        expect(controller.getObjectByName('xplor-vr-ray')).toBeDefined();
        expect(controller.parent).not.toBeNull();
      }

      // Destruction du handle
      handle.destroy();

      // Les écouteurs WebXR sont retirés
      expect(fakeSession.removeEventListener).toHaveBeenCalledWith(
        'select',
        expect.any(Function),
      );
      expect(fakeSession.removeEventListener).toHaveBeenCalledWith(
        'end',
        expect.any(Function),
      );

      // Le rayon est détaché et le contrôleur retiré de la scène
      if (controller !== undefined) {
        expect(controller.getObjectByName('xplor-vr-ray')).toBeUndefined();
        expect(controller.parent).toBeNull();
      }
    });

    it('calcule la direction à partir d une pose XR explicite dans l événement select si fournie', async () => {
      const selectListeners: ((event: unknown) => void)[] = [];
      const opaqueSpace = new OpaqueXRSpace();
      const fakeInputSource = {
        targetRaySpace: opaqueSpace,
        targetRayMode: 'tracked-pointer',
        handedness: 'right',
      };
      const fakeSession = {
        inputSources: [fakeInputSource],
        addEventListener: vi.fn((type: string, listener: (ev: unknown) => void) => {
          if (type === 'select') {
            selectListeners.push(listener);
          }
        }),
        removeEventListener: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const fakeNavigator = {
        xr: {
          isSessionSupported: () => Promise.resolve(true),
          requestSession: vi.fn().mockResolvedValue(fakeSession),
        },
      };

      const showSceneSpy = vi.fn().mockResolvedValue(undefined);

      const handle = await mountVr(container, {
        label: 'Entrer en VR',
        graph: graphWithSceneLink,
        getCurrentSceneId: () => 'scene-1',
        showScene: showSceneSpy,
        resolveTextureUrl: () => null,
        navigatorLike: fakeNavigator,
      });

      const button = container.querySelector('button');
      expect(button).not.toBeNull();
      if (button !== null) {
        button.click();
      }

      await vi.waitFor(() => {
        expect(selectListeners.length).toBeGreaterThan(0);
        expect(mockSetAnimationLoop).toHaveBeenCalled();
      });

      // Événement WebXR réaliste avec XRPose explicite orientée vers l'axe -Z (yaw: 0, pitch: 0)
      const selectCallback = selectListeners[0];
      expect(selectCallback).toBeDefined();
      if (selectCallback !== undefined) {
        selectCallback({
          type: 'select',
          inputSource: fakeInputSource,
          pose: {
            transform: {
              orientation: { x: 0, y: 0, z: 0, w: 1 },
            },
          },
          timeStamp: 50,
        });
      }

      const animationCallback = mockSetAnimationLoop.mock.calls[0]?.[0];
      expect(animationCallback).toBeDefined();
      if (animationCallback !== undefined && animationCallback !== null) {
        animationCallback(0);
        animationCallback(150);
        animationCallback(300);
      }

      await vi.waitFor(() => {
        expect(showSceneSpy).toHaveBeenCalledWith('scene-2');
      });

      handle.destroy();
    });
  });
});
