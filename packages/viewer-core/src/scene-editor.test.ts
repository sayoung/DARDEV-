import { describe, expect, it, vi, afterEach } from 'vitest';
import { HotspotResponse, HotspotType, HotspotIcon } from '@xplor/shared';
import { editorMarkers, editorPanorama, mountSceneEditor, normalizeYaw, toEditorMarkerConfig } from './scene-editor.js';

describe('editorMarkers', () => {
  const baseHotspot: HotspotResponse = {
    id: 'h1',
    sceneId: 's1',
    type: HotspotType.INFO,
    yaw: 1.5,
    pitch: -0.5,
    label: { fr: 'Information', en: 'Info' },
    targetSceneId: null,
    targetTourId: null,
    targetTourSceneId: null,
    body: { fr: 'Détails' },
    url: null,
    arrivalYaw: null,
    mediaAssetIds: [],
    icon: HotspotIcon.INFO,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('retourne une liste vide si aucun hotspot', () => {
    expect(editorMarkers([], 'fr')).toEqual([]);
  });

  it('conserve yaw et pitch', () => {
    const markers = editorMarkers([baseHotspot], 'fr');
    expect(markers[0]?.position.yaw).toBe(1.5);
    expect(markers[0]?.position.pitch).toBe(-0.5);
  });

  it('utilise le libellé dans la langue demandée', () => {
    const markers = editorMarkers([baseHotspot], 'en');
    expect(markers[0]?.tooltip).toBe('Info');
  });

  it('se replie sur fr si la langue demandée manque', () => {
    const markers = editorMarkers([baseHotspot], 'ar');
    expect(markers[0]?.tooltip).toBe('Information');
  });

  it('génère className en minuscules par type', () => {
    const hotspots: HotspotResponse[] = [
      { ...baseHotspot, id: 'h1', type: HotspotType.SCENE_LINK },
      { ...baseHotspot, id: 'h2', type: HotspotType.TOUR_LINK },
      { ...baseHotspot, id: 'h3', type: HotspotType.INFO },
      { ...baseHotspot, id: 'h4', type: HotspotType.MEDIA },
      { ...baseHotspot, id: 'h5', type: HotspotType.URL },
    ];
    const markers = editorMarkers(hotspots, 'fr');
    
    expect(markers[0]?.className).toBe('xplor-marker xplor-marker-scene-link');
    expect(markers[1]?.className).toBe('xplor-marker xplor-marker-tour-link');
    expect(markers[2]?.className).toBe('xplor-marker xplor-marker-info');
    expect(markers[3]?.className).toBe('xplor-marker xplor-marker-media');
    expect(markers[4]?.className).toBe('xplor-marker xplor-marker-url');
  });
});

describe('toEditorMarkerConfig', () => {
  it('convertit un EditorMarker en MarkerConfig avec contenu html non vide', () => {
    const editorMarker = {
      id: 'm1',
      position: { yaw: 1, pitch: -1 },
      tooltip: 'Test',
      className: 'xplor-marker'
    };
    
    const config = toEditorMarkerConfig(editorMarker);
    
    expect(config.id).toBe('m1');
    expect(config.position).toEqual({ yaw: 1, pitch: -1 });
    expect(config.tooltip).toBe('Test');
    expect(config.className).toBe('xplor-marker');
    expect(config.html).not.toBe('');
    expect(config.html).toBe('<div class="editor-marker"></div>');
    expect(config.anchor).toBe('center center');
  });
});

describe('editorPanorama', () => {
  const validPanorama = {
    preview: 'preview.jpg',
    web: 'web.jpg',
    tiles: { width: 2048, cols: 4, rows: 2, baseUrl: 'https://example.com/tiles/{col}_{row}.jpg' },
  };

  it('construit la configuration de panorama correcte', () => {
    const asset = { panorama: validPanorama };
    const config = editorPanorama(asset);

    expect(config.width).toBe(2048);
    expect(config.cols).toBe(4);
    expect(config.rows).toBe(2);
    expect(config.baseUrl).toBe('preview.jpg');
    expect(config.tileUrl(3, 1)).toBe('https://example.com/tiles/3_1.jpg');
  });

  it('lève une erreur avec un message explicite si le panorama est null', () => {
    const asset = { panorama: null };
    expect(() => editorPanorama(asset)).toThrowError('Les dérivés du panorama sont manquants ou incomplets.');
  });
});

describe('normalizeYaw', () => {
  it('ramène 3π/2 à -π/2', () => {
    expect(normalizeYaw(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('ramène 2π à 0', () => {
    expect(normalizeYaw(2 * Math.PI)).toBeCloseTo(0);
  });

  it('ramène -3π/2 à π/2', () => {
    expect(normalizeYaw(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('conserve π', () => {
    expect(normalizeYaw(Math.PI)).toBeCloseTo(Math.PI);
  });
});

import { Viewer } from '@photo-sphere-viewer/core';

vi.mock('@photo-sphere-viewer/core', () => {
  return {
    Viewer: vi.fn().mockImplementation(() => {
      return {
        getPlugin: vi.fn(),
        addEventListener: vi.fn(),
        getPosition: vi.fn().mockReturnValue({ yaw: 1.2, pitch: 0.5 }),
        getZoomLevel: vi.fn().mockReturnValue(60),
        destroy: vi.fn(),
        container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
      };
    }),
  };
});

vi.mock('@photo-sphere-viewer/markers-plugin', () => ({
  MarkersPlugin: vi.fn(),
}));

vi.mock('@photo-sphere-viewer/equirectangular-tiles-adapter', () => ({
  EquirectangularTilesAdapter: vi.fn(),
}));

describe('mountSceneEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const dummyPanorama = {
    width: 2048,
    cols: 4,
    rows: 2,
    baseUrl: 'preview.jpg',
    tileUrl: (col: number, row: number) => `tiles/${String(col)}_${String(row)}.jpg`,
  };

  const dummyMarkers = [
    { id: 'm1', position: { yaw: 1, pitch: 0 }, tooltip: 'M1', className: 'xplor-marker' },
  ];

  const defaultOptions = {
    panorama: dummyPanorama,
    markers: dummyMarkers,
    initialView: { yaw: 0, pitch: 0, zoom: 50 },
    onPanoramaClick: vi.fn(),
    onMarkerSelect: vi.fn(),
  };

  it('un clic appelle onPanoramaClick avec les bonnes valeurs', () => {
    const mockAddEventListener = vi.fn();
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
    };
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: mockAddEventListener,
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const onPanoramaClick = vi.fn();
    mountSceneEditor({} as HTMLElement, {
      ...defaultOptions,
      onPanoramaClick,
    });

    const clickCall = mockAddEventListener.mock.calls.find((call: unknown[]) => call[0] === 'click');
    if (!clickCall) throw new Error('Événement click non branché');
    const clickHandler = clickCall[1] as (e: { data: { rightclick: boolean, yaw: number, pitch: number, target: unknown } }) => void;

    // Simule un clic normal (avec un angle à normaliser)
    clickHandler({
      data: {
        rightclick: false,
        yaw: 3 * Math.PI / 2,
        pitch: -1.0,
        target: { closest: () => null }, // Pas de .psv-marker
      }
    });

    expect(onPanoramaClick).toHaveBeenCalledWith(-Math.PI / 2, -1.0);
  });

  it('un clic sur un marqueur n\'appelle pas onPanoramaClick', () => {
    const mockAddEventListener = vi.fn();
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
    };
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: mockAddEventListener,
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const onPanoramaClick = vi.fn();
    mountSceneEditor({} as HTMLElement, {
      ...defaultOptions,
      onPanoramaClick,
    });

    const clickCall = mockAddEventListener.mock.calls.find((call: unknown[]) => call[0] === 'click');
    if (!clickCall) throw new Error('Événement click non branché');
    const clickHandler = clickCall[1] as (e: { data: { rightclick: boolean, yaw: number, pitch: number, target: unknown } }) => void;

    // Simule un clic sur un marqueur
    const childEl = {
      closest: (selector: string) => selector === '.psv-marker' ? {} : null
    } as unknown as HTMLElement;

    clickHandler({
      data: {
        rightclick: false,
        yaw: 2.5,
        pitch: -1.0,
        target: childEl, // À l'intérieur d'un marqueur
      }
    });

    expect(onPanoramaClick).not.toHaveBeenCalled();
  });

  it('setMarkers remplace les marqueurs', () => {
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
    };
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const instance = mountSceneEditor({} as HTMLElement, defaultOptions);
    
    // Le premier setMarkers est appelé lors de l'initialisation
    expect(mockMarkersPlugin.setMarkers).toHaveBeenCalledTimes(1);

    const newMarkers = [
      { id: 'm2', position: { yaw: 2, pitch: 1 }, tooltip: 'M2', className: 'xplor-marker' },
    ];
    instance.setMarkers(newMarkers);

    expect(mockMarkersPlugin.setMarkers).toHaveBeenCalledTimes(2);
    expect(mockMarkersPlugin.setMarkers).toHaveBeenLastCalledWith([
      { id: 'm2', position: { yaw: 2, pitch: 1 }, tooltip: 'M2', className: 'xplor-marker', html: '<div class="editor-marker"></div>', anchor: 'center center' }
    ]);
  });

  it('destroy détruit le viewer', () => {
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
    };
    const destroyMock = vi.fn();
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: destroyMock,
      container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const instance = mountSceneEditor({} as HTMLElement, defaultOptions);
    instance.destroy();

    expect(destroyMock).toHaveBeenCalled();
  });

  it('sans onMarkerMove, mountSceneEditor n\'enregistre aucun écouteur pointerdown/pointermove/pointerup', () => {
    const mockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
    };

    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: mockContainer as unknown as HTMLElement,
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    mountSceneEditor({} as HTMLElement, defaultOptions);

    expect(mockContainer.addEventListener).not.toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockContainer.addEventListener).not.toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockContainer.addEventListener).not.toHaveBeenCalledWith('pointerup', expect.any(Function));
  });

  it('avec onMarkerMove, gère le drag and drop et appelle onMarkerMove', () => {
    let handlePointerDown: (e: { target: unknown; clientX: number; clientY: number; stopPropagation: () => void }) => void = () => {};
    let handlePointerMove: (e: { clientX: number; clientY: number }) => void = () => {};
    let handlePointerUp: (e: object) => void = () => {};

    const mockContainer = {
      addEventListener: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'pointerdown' && typeof cb === 'function') handlePointerDown = cb as typeof handlePointerDown;
        if (event === 'pointermove' && typeof cb === 'function') handlePointerMove = cb as typeof handlePointerMove;
        if (event === 'pointerup' && typeof cb === 'function') handlePointerUp = cb as typeof handlePointerUp;
      }),
      removeEventListener: vi.fn(),
    };
    
    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
      getMarkers: vi.fn().mockReturnValue([]),
    };

    const mockDataHelper = {
      viewerCoordsToSphericalCoords: vi.fn(),
    };

    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: mockContainer,
      dataHelper: mockDataHelper,
    }) as unknown as Viewer);

    const onMarkerMove = vi.fn();
    mountSceneEditor({} as unknown as HTMLElement, { ...defaultOptions, onMarkerMove });

    const stopPropagation = vi.fn();
    
    class FakeElement {
      dataset = { psvMarker: 'm1' };
      closest(sel: string) {
        return sel === '.psv-marker' ? this : null;
      }
    }
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLElement', FakeElement);

    const target = new FakeElement();

    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 0.1, pitch: 0.1 });
    handlePointerDown({ target, clientX: 10, clientY: 10, stopPropagation });
    
    expect(stopPropagation).toHaveBeenCalled();

    // (a) pointerdown sur un élément .psv-marker puis pointermove avec viewerCoordsToSphericalCoords renvoyant un yaw hors plage (ex. 4)
    // → updateMarker appelé avec l'id et la position, puis pointerup → onMarkerMove appelé avec normalizeYaw(4) et le pitch.
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 4, pitch: 0.2 });
    handlePointerMove({ clientX: 20, clientY: 20 });
    
    expect(mockMarkersPlugin.updateMarker).toHaveBeenCalledWith({ id: 'm1', position: { yaw: 4, pitch: 0.2 } });

    handlePointerUp({});
    
    // On doit importer normalizeYaw pour tester
    expect(onMarkerMove).toHaveBeenCalledWith('m1', normalizeYaw(4), 0.2);
    
    // (b) pointerdown puis pointerup sans pointermove → onMarkerMove non appelé.
    onMarkerMove.mockClear();
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 0.3, pitch: 0.3 });
    handlePointerDown({ target, clientX: 10, clientY: 10, stopPropagation });
    handlePointerUp({});
    expect(onMarkerMove).not.toHaveBeenCalled();
    
    // Test: conversion null ignorée
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce(null);
    handlePointerDown({ target, clientX: 10, clientY: 10, stopPropagation });
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 0.4, pitch: 0.4 });
    handlePointerMove({ clientX: 20, clientY: 20 });
    expect(mockMarkersPlugin.updateMarker).not.toHaveBeenCalledWith(expect.objectContaining({ position: { yaw: 0.4, pitch: 0.4 } }));
  });

  it('avec onMarkerMove, destroy retire les quatre écouteurs ajoutés', () => {
    const mockContainer = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue({ setMarkers: vi.fn(), addEventListener: vi.fn() }),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: mockContainer,
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const instance = mountSceneEditor({} as unknown as HTMLElement, { ...defaultOptions, onMarkerMove: vi.fn() });
    instance.destroy();

    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('pointercancel', expect.any(Function));
  });
});
