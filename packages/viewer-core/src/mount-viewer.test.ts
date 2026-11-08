/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Viewer } from '@photo-sphere-viewer/core';
import { VirtualTourPlugin } from '@photo-sphere-viewer/virtual-tour-plugin';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { TourGraphSchema, type TourGraph } from '@xplor/shared';
import { mountViewer } from './mount-viewer.js';

type EventCallback = (event: Record<string, unknown>) => void;

let lastViewerConfig: Record<string, unknown> = {};
const mockRotate = vi.fn();
const mockZoom = vi.fn();
const mockDestroy = vi.fn();
const mockSetMarkers = vi.fn();
const mockSetCurrentNode = vi.fn().mockResolvedValue(true);
const mockGetCurrentNode = vi.fn().mockReturnValue({ id: 'scene-1' });
const mockIsSupported = vi.fn().mockResolvedValue(true);
const mockToggle = vi.fn();

const tourEventListeners = new Map<string, EventCallback>();
const markersEventListeners = new Map<string, EventCallback>();

const mockTourPlugin = {
  addEventListener: vi.fn((event: string, cb: EventCallback) => {
    tourEventListeners.set(event, cb);
  }),
  getCurrentNode: mockGetCurrentNode,
  setCurrentNode: mockSetCurrentNode,
};

const mockMarkersPlugin = {
  addEventListener: vi.fn((event: string, cb: EventCallback) => {
    markersEventListeners.set(event, cb);
  }),
  setMarkers: mockSetMarkers,
};

const mockGyroscopePlugin = {
  isSupported: mockIsSupported,
  toggle: mockToggle,
};

const mockGalleryPlugin = {};

const mockViewerInstance = {
  getPlugin: vi.fn((pluginKey: unknown) => {
    if (pluginKey === VirtualTourPlugin) {
      return mockTourPlugin;
    }
    if (pluginKey === MarkersPlugin) {
      return mockMarkersPlugin;
    }
    if (pluginKey === GyroscopePlugin) {
      return mockGyroscopePlugin;
    }
    return mockGalleryPlugin;
  }),
  rotate: mockRotate,
  zoom: mockZoom,
  destroy: mockDestroy,
};

vi.mock('@photo-sphere-viewer/core', () => {
  return {
    Viewer: vi.fn().mockImplementation((config: Record<string, unknown>) => {
      lastViewerConfig = config;
      return mockViewerInstance;
    }),
  };
});

vi.mock('@photo-sphere-viewer/virtual-tour-plugin', () => ({
  VirtualTourPlugin: vi.fn(),
}));

vi.mock('@photo-sphere-viewer/markers-plugin', () => ({
  MarkersPlugin: vi.fn(),
}));

vi.mock('@photo-sphere-viewer/gallery-plugin', () => ({
  GalleryPlugin: vi.fn(),
}));

vi.mock('@photo-sphere-viewer/gyroscope-plugin', () => ({
  GyroscopePlugin: vi.fn(),
}));

vi.mock('@photo-sphere-viewer/equirectangular-tiles-adapter', () => ({
  EquirectangularTilesAdapter: vi.fn(),
}));

describe('mountViewer', () => {
  let container: HTMLElement;

  const createTestGraph = (): TourGraph => {
    return TourGraphSchema.parse({
      id: 'tour-1',
      contentVersion: 1,
      lang: 'fr',
      title: 'Visite Test',
      summary: 'Résumé Test',
      city: 'Rabat',
      categories: ['HISTORIQUE'],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-1',
      scenes: [
        {
          id: 'scene-1',
          title: 'Scène 1',
          caption: null,
          panorama: {
            preview: 'preview-1.jpg',
            web: 'web-1.jpg',
            tiles: { width: 1024, cols: 2, rows: 1, baseUrl: 'tiles-1/' },
          },
          initialView: { yaw: 1.5, pitch: -0.2, zoom: 45 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'thumb-1.jpg',
          hotspots: [
            {
              id: 'hs-info-1',
              type: 'INFO',
              yaw: 0.5,
              pitch: -0.1,
              label: 'Détail historique',
              icon: 'INFO',
              bodyHtml: '<p>Description</p>',
              images: [],
            },
            {
              id: 'hs-link-1',
              type: 'SCENE_LINK',
              yaw: 1.2,
              pitch: 0.1,
              label: 'Vers la salle suivante',
              icon: 'ARROW',
              targetSceneId: 'scene-2',
              arrivalYaw: 0.8,
            },
          ],
        },
        {
          id: 'scene-2',
          title: 'Scène 2',
          caption: null,
          panorama: {
            preview: 'preview-2.jpg',
            web: 'web-2.jpg',
            tiles: { width: 1024, cols: 2, rows: 1, baseUrl: 'tiles-2/' },
          },
          initialView: { yaw: 2.8, pitch: 0.4, zoom: 60 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'thumb-2.jpg',
          hotspots: [],
        },
      ],
      linkedTours: [],
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    lastViewerConfig = {};
    tourEventListeners.clear();
    markersEventListeners.clear();
    mockRotate.mockClear();
    mockZoom.mockClear();
    mockDestroy.mockClear();
    mockSetMarkers.mockClear();
    mockSetCurrentNode.mockClear();
    mockGetCurrentNode.mockClear();
    mockIsSupported.mockClear();
    mockToggle.mockClear();
    vi.mocked(Viewer).mockClear();
  });

  it('le Viewer reçoit defaultYaw/defaultPitch de la scène de départ (startSceneId)', () => {
    const graph = createTestGraph();
    mountViewer(container, graph);

    expect(Viewer).toHaveBeenCalledTimes(1);
    expect(lastViewerConfig.defaultYaw).toBe(1.5);
    expect(lastViewerConfig.defaultPitch).toBe(-0.2);
    expect(lastViewerConfig.defaultZoomLvl).toBe(45);
  });

  it('le sceneId demandé l\'emporte sur startSceneId', () => {
    const graph = createTestGraph();
    mountViewer(container, graph, { sceneId: 'scene-2' });

    expect(Viewer).toHaveBeenCalledTimes(1);
    expect(lastViewerConfig.defaultYaw).toBe(2.8);
    expect(lastViewerConfig.defaultPitch).toBe(0.4);
    expect(lastViewerConfig.defaultZoomLvl).toBe(60);
  });

  it('se replie sur startSceneId si le sceneId demandé est inconnu ou null', () => {
    const graph = createTestGraph();
    mountViewer(container, graph, { sceneId: 'scene-inconnue' });

    expect(lastViewerConfig.defaultYaw).toBe(1.5);
    expect(lastViewerConfig.defaultPitch).toBe(-0.2);
    expect(lastViewerConfig.defaultZoomLvl).toBe(45);

    mountViewer(container, graph, { sceneId: null });
    expect(lastViewerConfig.defaultYaw).toBe(1.5);
    expect(lastViewerConfig.defaultPitch).toBe(-0.2);
    expect(lastViewerConfig.defaultZoomLvl).toBe(45);
  });

  it('l\'événement node-changed n\'appelle plus rotate ni zoom mais met à jour les marqueurs et appelle onSceneChange', () => {
    const graph = createTestGraph();
    const onSceneChange = vi.fn();
    mountViewer(container, graph, { onSceneChange });

    const nodeChangedListener = tourEventListeners.get('node-changed');
    expect(nodeChangedListener).toBeDefined();

    if (nodeChangedListener) {
      nodeChangedListener({
        node: { id: 'scene-1' },
        data: { fromLink: { nodeId: 'scene-1', data: { arrivalYaw: 0.8 } } },
      });
    }

    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockZoom).not.toHaveBeenCalled();

    expect(mockSetMarkers).toHaveBeenCalledTimes(1);
    expect(mockSetMarkers).toHaveBeenCalledWith([
      {
        id: 'hs-info-1',
        position: { yaw: 0.5, pitch: -0.1 },
        tooltip: 'Détail historique',
        className: 'xplor-marker xplor-marker-info',
        html: '<div class="marker-icon"><span class="icon-INFO"></span></div>',
      },
    ]);

    expect(onSceneChange).toHaveBeenCalledTimes(1);
    expect(onSceneChange).toHaveBeenCalledWith('scene-1');
  });

  it('l\'événement node-changed avec scène inexistante n\'appelle pas rotate ni zoom ni setMarkers mais déclenche onSceneChange', () => {
    const graph = createTestGraph();
    const onSceneChange = vi.fn();
    mountViewer(container, graph, { onSceneChange });

    const nodeChangedListener = tourEventListeners.get('node-changed');
    expect(nodeChangedListener).toBeDefined();

    if (nodeChangedListener) {
      nodeChangedListener({ node: { id: 'scene-inconnue' } });
    }

    expect(mockRotate).not.toHaveBeenCalled();
    expect(mockZoom).not.toHaveBeenCalled();
    expect(mockSetMarkers).not.toHaveBeenCalled();
    expect(onSceneChange).toHaveBeenCalledWith('scene-inconnue');
  });

  it('l\'événement select-marker propage onHotspotClick avec l\'identifiant du marqueur', () => {
    const graph = createTestGraph();
    const onHotspotClick = vi.fn();
    mountViewer(container, graph, { onHotspotClick });

    const selectMarkerListener = markersEventListeners.get('select-marker');
    expect(selectMarkerListener).toBeDefined();

    if (selectMarkerListener) {
      selectMarkerListener({ marker: { id: 'hs-info-1' } });
    }

    expect(onHotspotClick).toHaveBeenCalledTimes(1);
    expect(onHotspotClick).toHaveBeenCalledWith('hs-info-1');
  });

  it('goToScene appelle tourPlugin.setCurrentNode', async () => {
    const graph = createTestGraph();
    const instance = mountViewer(container, graph);

    await instance.goToScene('scene-2');

    expect(mockSetCurrentNode).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentNode).toHaveBeenCalledWith('scene-2');
  });

  it('currentSceneId renvoie l\'identifiant de la scène courante', () => {
    const graph = createTestGraph();
    const instance = mountViewer(container, graph);

    expect(instance.currentSceneId()).toBe('scene-1');
    expect(mockGetCurrentNode).toHaveBeenCalledTimes(1);
  });

  it('destroy appelle viewer.destroy', () => {
    const graph = createTestGraph();
    const instance = mountViewer(container, graph);

    instance.destroy();

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('gyroscopeSupported et toggleGyroscope délèguent à gyroscopePlugin', async () => {
    const graph = createTestGraph();
    const instance = mountViewer(container, graph);

    const supported = await instance.gyroscopeSupported();
    expect(supported).toBe(true);
    expect(mockIsSupported).toHaveBeenCalledTimes(1);

    instance.toggleGyroscope();
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
