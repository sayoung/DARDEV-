import { resources } from '@xplor/i18n';
import type { Lang, TourGraph } from '@xplor/shared';
import { TourNotFoundError } from '@xplor/viewer-core';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { startViewer } from './app.js';

describe('startViewer', () => {
  let mockLoad: Mock<(shareToken: string, lang: Lang) => Promise<TourGraph>>;
  let mockMount: Mock<(
    container: HTMLElement,
    graph: TourGraph,
    opts: {
      sceneId?: string | null;
      onSceneChange?: (sceneId: string) => void;
      onHotspotClick?: (hotspotId: string) => void;
    }
  ) => { goToScene(id: string): Promise<void>; destroy(): void; gyroscopeSupported(): Promise<boolean>; toggleGyroscope(): void }>;
  let mockNavigate: Mock<(url: string) => void>;
  let doc: Document;

  const mockGraph: TourGraph = {
    id: 'tour-1',
    contentVersion: 1,
    lang: 'fr',
    title: 'Test Tour',
    summary: '',
    city: '',
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
          preview: '',
          web: '',
          tiles: { width: 0, cols: 0, rows: 0, baseUrl: '' }
        },
        initialView: { yaw: 0, pitch: 0, zoom: 0 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: '',
        hotspots: []
      }
    ],
    linkedTours: []
  };

  beforeEach(() => {
    mockLoad = vi.fn();
    mockMount = vi.fn().mockReturnValue({
      goToScene: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      gyroscopeSupported: vi.fn().mockResolvedValue(false),
      toggleGyroscope: vi.fn()
    });
    mockNavigate = vi.fn();
    doc = document.implementation.createHTMLDocument();
  });

  it('jeton invalide: ne charge pas, affiche notFound', async () => {
    await startViewer(
      doc,
      { pathname: '/invalid', search: '' },
      { load: mockLoad, mount: mockMount, navigate: mockNavigate }
    );

    expect(mockLoad).not.toHaveBeenCalled();
    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.fr.viewer.notFound);
  });

  it('visite introuvable: affiche notFound', async () => {
    mockLoad.mockRejectedValue(new TourNotFoundError());

    await startViewer(
      doc,
      { pathname: '/v/12345', search: '' },
      { load: mockLoad, mount: mockMount, navigate: mockNavigate }
    );

    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.fr.viewer.notFound);
    expect(mockMount).not.toHaveBeenCalled();
  });

  it('erreur réseau: affiche loadError', async () => {
    mockLoad.mockRejectedValue(new Error('Network error'));

    await startViewer(
      doc,
      { pathname: '/v/12345', search: '?lang=en' },
      { load: mockLoad, mount: mockMount, navigate: mockNavigate }
    );

    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.en.viewer.loadError);
    expect(mockMount).not.toHaveBeenCalled();
  });

  it('succès: met à jour le titre, cache le statut et monte la visite', async () => {
    mockLoad.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, mount: mockMount, navigate: mockNavigate }
    );

    expect(doc.title).toBe('Test Tour');
    const status = doc.getElementById('status');
    expect(status?.textContent).toBe('');
    expect(status?.hidden).toBe(true);

    const viewer = doc.getElementById('viewer');
    expect(mockMount).toHaveBeenCalledTimes(1);
    const args = mockMount.mock.calls[0];
    if (!args) throw new Error('mockMount not called');
    expect(args[0]).toBe(viewer);
    expect(args[1]).toBe(mockGraph);
    expect(args[2].sceneId).toBe('scene-1');
    expect(typeof args[2].onSceneChange).toBe('function');
    expect(typeof args[2].onHotspotClick).toBe('function');
  });

  it('erreur de montage: affiche loadError et ne reste pas masquée', async () => {
    mockLoad.mockResolvedValue(mockGraph);

    mockMount.mockImplementation(() => {
      throw new Error('Mount error');
    });

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, mount: mockMount, navigate: mockNavigate }
    );

    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.fr.viewer.loadError);
    expect(status?.hidden).toBe(false);
  });
});
