import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneEditor360 } from './SceneEditor360';
import { mountSceneEditor } from '@xplor/viewer-core';

vi.mock('@xplor/viewer-core', () => ({
  mountSceneEditor: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => `translated_${key}`,
  }),
}));

describe('SceneEditor360', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    panorama: { width: 4096, cols: 8, rows: 4, baseUrl: 'base', tileUrl: () => 'tile' },
    hotspots: [],
    initialView: { yaw: 0, pitch: 0, zoom: 50 },
    onPanoramaClick: vi.fn(),
    onMarkerSelect: vi.fn(),
  };

  it('appelle mountSceneEditor au montage avec hotspots et destroy au démontage', () => {
    const destroyMock = vi.fn();
    vi.mocked(mountSceneEditor).mockReturnValue({
      destroy: destroyMock,
      setMarkers: vi.fn(),
      getView: vi.fn(),
    });

    const hotspots = [{ id: 'h1', position: { yaw: 1, pitch: 1 }, className: 'test', tooltip: 'Test' }];
    const { unmount } = render(<SceneEditor360 {...defaultProps} hotspots={hotspots} />);

    expect(mountSceneEditor).toHaveBeenCalledTimes(1);
    expect(mountSceneEditor).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        panorama: defaultProps.panorama,
        initialView: defaultProps.initialView,
        markers: hotspots,
      })
    );

    unmount();
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('appelle setMarkers quand les hotspots changent sans remontage', () => {
    const setMarkersMock = vi.fn();
    vi.mocked(mountSceneEditor).mockReturnValue({
      destroy: vi.fn(),
      setMarkers: setMarkersMock,
      getView: vi.fn(),
    });

    const { rerender } = render(<SceneEditor360 {...defaultProps} />);
    
    vi.mocked(mountSceneEditor).mockClear();

    const newHotspots = [{ id: 'h1', position: { yaw: 1, pitch: 1 }, className: 'test', tooltip: 'Test' }];
    rerender(<SceneEditor360 {...defaultProps} hotspots={newHotspots} />);

    expect(mountSceneEditor).not.toHaveBeenCalled();
    expect(setMarkersMock).toHaveBeenCalledWith(newHotspots);
  });

  it('remonte le composant lors d\'un changement de panorama et réapplique les hotspots courants', () => {
    const destroyMock = vi.fn();
    vi.mocked(mountSceneEditor).mockReturnValue({
      destroy: destroyMock,
      setMarkers: vi.fn(),
      getView: vi.fn(),
    });

    const hotspots = [{ id: 'h1', position: { yaw: 1, pitch: 1 }, className: 'test', tooltip: 'Test' }];
    const { rerender } = render(<SceneEditor360 {...defaultProps} hotspots={hotspots} />);
    
    expect(mountSceneEditor).toHaveBeenCalledTimes(1);

    const newPanorama = { width: 8192, cols: 16, rows: 8, baseUrl: 'new', tileUrl: () => 'new' };
    rerender(<SceneEditor360 {...defaultProps} hotspots={hotspots} panorama={newPanorama} />);

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(mountSceneEditor).toHaveBeenCalledTimes(2);
    expect(mountSceneEditor).toHaveBeenNthCalledWith(2, expect.any(HTMLElement), expect.objectContaining({
      panorama: newPanorama,
      markers: hotspots,
    }));
  });

  it('ne remonte pas le composant si initialView change (rerender avec littéral neuf)', () => {
    vi.mocked(mountSceneEditor).mockReturnValue({
      destroy: vi.fn(),
      setMarkers: vi.fn(),
      getView: vi.fn(),
    });

    const { rerender } = render(<SceneEditor360 {...defaultProps} initialView={{ yaw: 0, pitch: 0, zoom: 50 }} />);
    
    vi.mocked(mountSceneEditor).mockClear();

    rerender(<SceneEditor360 {...defaultProps} initialView={{ yaw: 1, pitch: 1, zoom: 60 }} />);

    expect(mountSceneEditor).not.toHaveBeenCalled();
  });

  it('relaie les callbacks onPanoramaClick et onMarkerSelect, y compris après rerender', () => {
    vi.mocked(mountSceneEditor).mockReturnValue({
      destroy: vi.fn(),
      setMarkers: vi.fn(),
      getView: vi.fn(),
    });

    const onPanoramaClick1 = vi.fn();
    const onMarkerSelect1 = vi.fn();
    
    const { rerender } = render(
      <SceneEditor360 {...defaultProps} onPanoramaClick={onPanoramaClick1} onMarkerSelect={onMarkerSelect1} />
    );

    const call1 = vi.mocked(mountSceneEditor).mock.calls[0];
    if (!call1) throw new Error('mountSceneEditor not called');
    const options = call1[1];

    options.onPanoramaClick(1, 2);
    expect(onPanoramaClick1).toHaveBeenCalledWith(1, 2);

    options.onMarkerSelect('m1');
    expect(onMarkerSelect1).toHaveBeenCalledWith('m1');

    const onPanoramaClick2 = vi.fn();
    const onMarkerSelect2 = vi.fn();

    rerender(
      <SceneEditor360 {...defaultProps} onPanoramaClick={onPanoramaClick2} onMarkerSelect={onMarkerSelect2} />
    );

    options.onPanoramaClick(3, 4);
    expect(onPanoramaClick2).toHaveBeenCalledWith(3, 4);
    expect(onPanoramaClick1).toHaveBeenCalledTimes(1);

    options.onMarkerSelect('m2');
    expect(onMarkerSelect2).toHaveBeenCalledWith('m2');
    expect(onMarkerSelect1).toHaveBeenCalledTimes(1);
  });

  it('l\'aria-label provient de i18n', () => {
    const { getByRole } = render(<SceneEditor360 {...defaultProps} />);
    const editorNode = getByRole('application');
    
    expect(editorNode.getAttribute('aria-label')).toBe('translated_editor.sceneAriaLabel');
  });
});
