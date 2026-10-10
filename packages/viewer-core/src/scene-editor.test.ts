import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
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
        navbar: { getButton: vi.fn().mockReturnValue({ toggleActive: vi.fn() }) },
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
  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('document', { activeElement: null });
  });

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

  it('clic photo sans mode Déplacer = aucun appel à onMarkerMove', () => {
    const mockAddEventListener = vi.fn();
    const mockMarkersPlugin = { setMarkers: vi.fn(), addEventListener: vi.fn(), updateMarker: vi.fn(), getMarkers: vi.fn().mockReturnValue([]) };
    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: mockAddEventListener,
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
      navbar: { getButton: vi.fn() },
    }) as unknown as Viewer);

    const onMarkerMove = vi.fn();
    const onPanoramaClick = vi.fn();
    mountSceneEditor({} as HTMLElement, { ...defaultOptions, onMarkerMove, onPanoramaClick });

    const clickCall = mockAddEventListener.mock.calls.find((call: unknown[]) => call[0] === 'click');
    if (!clickCall) throw new Error('Événement click non branché');
    const clickHandler = clickCall[1] as (e: { data: { rightclick: boolean, yaw: number, pitch: number, target: unknown } }) => void;

    // Simulate click on panorama
    clickHandler({ data: { rightclick: false, yaw: 1.0, pitch: 0.5, target: { closest: () => null } } });
    
    expect(onMarkerMove).not.toHaveBeenCalled();
    expect(onPanoramaClick).toHaveBeenCalledWith(1.0, 0.5);
  });

  it('clic photo avec mode actif = déplacement puis sortie du mode', () => {
    let viewerConfig: Record<string, unknown> = {};
    const mockAddEventListener = vi.fn();
    const mockToggleActive = vi.fn();
    const mockMarkersPlugin = { setMarkers: vi.fn(), addEventListener: vi.fn(), updateMarker: vi.fn(), getMarkers: vi.fn().mockReturnValue([{ id: 'm1', config: { className: '' } }]) };
    
    vi.mocked(Viewer).mockImplementationOnce((config) => {
      viewerConfig = config;
      return {
        getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
        addEventListener: mockAddEventListener,
        getPosition: vi.fn(),
        getZoomLevel: vi.fn(),
        destroy: vi.fn(),
        container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
        navbar: { getButton: vi.fn().mockReturnValue({ toggleActive: mockToggleActive }) },
      } as unknown as Viewer;
    });

    const onMarkerMove = vi.fn();
    const onPanoramaClick = vi.fn();
    const instance = mountSceneEditor({} as HTMLElement, { ...defaultOptions, onMarkerMove, onPanoramaClick });
    
    // Select marker
    instance.setSelectedMarker('m1');

    // Activate move mode
    const navItems = viewerConfig.navbar as Array<{ id?: string, onClick?: () => void }>;
    const moveBtnConfig = navItems.find((n) => n.id === 'move-mode');
    if (!moveBtnConfig || !moveBtnConfig.onClick) throw new Error('btn missing');
    moveBtnConfig.onClick();
    
    expect(mockToggleActive).toHaveBeenCalledWith(true);

    const clickCall = mockAddEventListener.mock.calls.find((call: unknown[]) => call[0] === 'click');
    if (!clickCall) throw new Error('Événement click non branché');
    const clickHandler = clickCall[1] as (e: { data: { rightclick: boolean, yaw: number, pitch: number, target: unknown } }) => void;

    // Click on panorama
    clickHandler({ data: { rightclick: false, yaw: 2.0, pitch: -0.5, target: { closest: () => null } } });
    
    expect(mockMarkersPlugin.updateMarker).toHaveBeenCalledWith({ id: 'm1', position: { yaw: 2.0, pitch: -0.5 } });
    expect(onMarkerMove).toHaveBeenCalledWith('m1', 2.0, -0.5);
    expect(onPanoramaClick).not.toHaveBeenCalled();
    expect(mockToggleActive).toHaveBeenCalledWith(false);
  });

  it('Échap désactive le mode', () => {
    let viewerConfig: Record<string, unknown> = {};
    let handleKeyDown: (e: { key: string }) => void = () => {};
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'keydown') handleKeyDown = cb as unknown as typeof handleKeyDown;
    });

    const mockToggleActive = vi.fn();
    vi.mocked(Viewer).mockImplementationOnce((config) => {
      viewerConfig = config;
      return {
        getPlugin: vi.fn().mockReturnValue({ setMarkers: vi.fn(), addEventListener: vi.fn(), updateMarker: vi.fn(), getMarkers: vi.fn().mockReturnValue([]) }),
        addEventListener: vi.fn(),
        getPosition: vi.fn(),
        getZoomLevel: vi.fn(),
        destroy: vi.fn(),
        container: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
        navbar: { getButton: vi.fn().mockReturnValue({ toggleActive: mockToggleActive }) },
      } as unknown as Viewer;
    });

    mountSceneEditor({} as HTMLElement, defaultOptions);

    // Activate move mode
    const navItems = viewerConfig.navbar as Array<{ id?: string, onClick?: () => void }>;
    const moveBtnConfig = navItems.find((n) => n.id === 'move-mode');
    if (!moveBtnConfig || !moveBtnConfig.onClick) throw new Error('btn missing');
    moveBtnConfig.onClick();

    // Press Escape
    handleKeyDown({ key: 'Escape' });

    expect(mockToggleActive).toHaveBeenCalledWith(false);
  });

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

  it('avec onMarkerMove, gère le drag and drop avec un seuil de 4px', () => {
    let handlePointerDown: (e: { target: unknown; clientX: number; clientY: number; pointerId: number; stopPropagation: () => void; preventDefault: () => void }) => void = () => {};
    let handlePointerMove: (e: { clientX: number; clientY: number }) => void = () => {};
    let handlePointerUp: (e: { pointerId: number; clientX: number; clientY: number }) => void = () => {};

    const mockContainer = {
      addEventListener: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'pointerdown') handlePointerDown = cb as typeof handlePointerDown;
        if (event === 'pointermove') handlePointerMove = cb as typeof handlePointerMove;
        if (event === 'pointerup') handlePointerUp = cb as typeof handlePointerUp;
      }),
      removeEventListener: vi.fn(),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
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

    const setOptionMock = vi.fn();

    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      setOption: setOptionMock,
      container: mockContainer,
      dataHelper: mockDataHelper,
    }) as unknown as Viewer);

    const onMarkerMove = vi.fn();
    mountSceneEditor({} as unknown as HTMLElement, { ...defaultOptions, onMarkerMove });

    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    
    class FakeElement {
      dataset = { psvMarker: 'm1' };
      closest(sel: string) { return sel === '.psv-marker' ? this : null; }
    }
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLElement', FakeElement);

    const target = new FakeElement();

    // Démarrage du glisser (startX: 10, startY: 10)
    handlePointerDown({ target, clientX: 10, clientY: 10, pointerId: 42, stopPropagation, preventDefault });
    
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(setOptionMock).toHaveBeenCalledWith('mousemove', false);
    expect(mockContainer.setPointerCapture).toHaveBeenCalledWith(42);

    // Mouvement < 4px (ex: 12, 12, distance carré = 8 < 16)
    handlePointerMove({ clientX: 12, clientY: 12 });
    expect(mockMarkersPlugin.updateMarker).not.toHaveBeenCalled();

    // Mouvement >= 4px (ex: 14, 14, distance carré = 32 >= 16)
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 4, pitch: 0.2 });
    handlePointerMove({ clientX: 14, clientY: 14 });
    expect(mockMarkersPlugin.updateMarker).toHaveBeenCalledWith({ id: 'm1', position: { yaw: 4, pitch: 0.2 } });

    // Fin du glisser
    mockDataHelper.viewerCoordsToSphericalCoords.mockReturnValueOnce({ yaw: 4.1, pitch: 0.25 });
    handlePointerUp({ pointerId: 42, clientX: 15, clientY: 15 });
    
    expect(mockContainer.releasePointerCapture).toHaveBeenCalledWith(42);
    expect(setOptionMock).toHaveBeenCalledWith('mousemove', true);
    expect(onMarkerMove).toHaveBeenCalledWith('m1', normalizeYaw(4.1), 0.25);
  });

  it('un clic simple sur un marqueur appelle onMarkerSelect sans le déplacer', () => {
    let handlePointerDown: (e: { target: unknown; clientX: number; clientY: number; pointerId: number; stopPropagation?: () => void; preventDefault?: () => void }) => void = () => {};
    let handlePointerUp: (e: { pointerId: number; clientX: number; clientY: number }) => void = () => {};

    const mockContainer = {
      addEventListener: vi.fn().mockImplementation((event: string, cb: unknown) => {
        if (event === 'pointerdown') handlePointerDown = cb as typeof handlePointerDown;
        if (event === 'pointerup') handlePointerUp = cb as typeof handlePointerUp;
      }),
      removeEventListener: vi.fn(),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0 }),
    };

    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
      getMarkers: vi.fn().mockReturnValue([]),
    };

    vi.mocked(Viewer).mockImplementationOnce(() => ({
      getPlugin: vi.fn().mockReturnValue(mockMarkersPlugin),
      addEventListener: vi.fn(),
      getPosition: vi.fn(),
      getZoomLevel: vi.fn(),
      destroy: vi.fn(),
      setOption: vi.fn(),
      container: mockContainer,
      dataHelper: { viewerCoordsToSphericalCoords: vi.fn() },
    }) as unknown as Viewer);

    const onMarkerSelect = vi.fn();
    const onMarkerMove = vi.fn();
    mountSceneEditor({} as unknown as HTMLElement, { ...defaultOptions, onMarkerSelect, onMarkerMove });

    class FakeElement {
      dataset = { psvMarker: 'm2' };
      closest(sel: string) { return sel === '.psv-marker' ? this : null; }
    }
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('HTMLElement', FakeElement);

    const target = new FakeElement();

    // Démarrage du clic
    handlePointerDown({ target, clientX: 10, clientY: 10, pointerId: 99 });
    
    // Fin du clic (même position, distance = 0 < 4px)
    handlePointerUp({ pointerId: 99, clientX: 10, clientY: 10 });

    expect(onMarkerSelect).toHaveBeenCalledWith('m2');
    expect(onMarkerMove).not.toHaveBeenCalled();
    expect(mockMarkersPlugin.updateMarker).not.toHaveBeenCalled();
  });

  it('gère les flèches du clavier pour déplacer le marqueur sélectionné', () => {
    let handleKeyDown: (e: { key: string; shiftKey: boolean; preventDefault: () => void }) => void = () => {};
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'keydown') handleKeyDown = cb as unknown as typeof handleKeyDown;
    });

    const mockMarkersPlugin = {
      setMarkers: vi.fn(),
      addEventListener: vi.fn(),
      updateMarker: vi.fn(),
      getMarkers: vi.fn().mockReturnValue([]),
      getMarker: vi.fn().mockReturnValue({ id: 'm1', config: { position: { yaw: 0, pitch: 0 } } }),
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

    const onMarkerMove = vi.fn();
    const instance = mountSceneEditor({} as HTMLElement, { ...defaultOptions, onMarkerMove });
    
    // Simuler la sélection d'un marqueur
    instance.setSelectedMarker('m1');

    const preventDefault = vi.fn();

    // Flèche droite sans shift (1°)
    handleKeyDown({ key: 'ArrowRight', shiftKey: false, preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(mockMarkersPlugin.updateMarker).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    expect(onMarkerMove).toHaveBeenCalledWith('m1', Math.PI / 180, 0);

    // Flèche gauche avec shift (5°)
    onMarkerMove.mockClear();
    mockMarkersPlugin.getMarker.mockReturnValue({ id: 'm1', config: { position: { yaw: 0, pitch: 0 } } });
    handleKeyDown({ key: 'ArrowLeft', shiftKey: true, preventDefault });
    expect(onMarkerMove).toHaveBeenCalledWith('m1', normalizeYaw(-5 * Math.PI / 180), 0);
  });

  it('avec onMarkerMove, destroy retire les écouteurs ajoutés', () => {
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

    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const instance = mountSceneEditor({} as unknown as HTMLElement, { ...defaultOptions, onMarkerMove: vi.fn() });
    instance.destroy();

    expect(vi.mocked(mockContainer.removeEventListener)).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);
    expect(vi.mocked(mockContainer.removeEventListener)).toHaveBeenCalledWith('pointermove', expect.any(Function), true);
    expect(vi.mocked(mockContainer.removeEventListener)).toHaveBeenCalledWith('pointerup', expect.any(Function), true);
    expect(vi.mocked(mockContainer.removeEventListener)).toHaveBeenCalledWith('pointercancel', expect.any(Function), true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
