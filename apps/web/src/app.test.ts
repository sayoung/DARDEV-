import { resources } from '@xplor/i18n';
import type { TourGraph } from '@xplor/shared';
import { TourNotFoundError } from '@xplor/viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startViewer } from './app.js';

describe('startViewer', () => {
  let mockLoad: ReturnType<typeof vi.fn>;
  let mockMount: ReturnType<typeof vi.fn>;
  let doc: Document;

  beforeEach(() => {
    mockLoad = vi.fn();
    mockMount = vi.fn();
    doc = document.implementation.createHTMLDocument();
  });

  it('jeton invalide: ne charge pas, affiche notFound', async () => {
    await startViewer(
      doc,
      { pathname: '/invalid', search: '' },
      { load: mockLoad, mount: mockMount }
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
      { load: mockLoad, mount: mockMount }
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
      { load: mockLoad, mount: mockMount }
    );

    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.en.viewer.loadError);
    expect(mockMount).not.toHaveBeenCalled();
  });

  it('succès: met à jour le titre, cache le statut et monte la visite', async () => {
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
    mockLoad.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, mount: mockMount }
    );

    expect(doc.title).toBe('Test Tour');
    const status = doc.getElementById('status');
    expect(status?.textContent).toBe('');
    expect(status?.hidden).toBe(true);

    const viewer = doc.getElementById('viewer');
    expect(mockMount).toHaveBeenCalledWith(viewer, mockGraph);
  });
});
