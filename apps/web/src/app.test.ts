import { resources } from '@xplor/i18n';
import type { Lang, TourGraph } from '@xplor/shared';
import { TourNotFoundError } from '@xplor/viewer-core';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { startViewer } from './app.js';

describe('startViewer', () => {
  let mockLoad: Mock<(shareToken: string, lang: Lang) => Promise<TourGraph>>;
  let mockLoadPreview: Mock<(previewToken: string, lang: Lang) => Promise<TourGraph>>;
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
    mockLoadPreview = vi.fn();
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
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
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
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
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
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
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
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(doc.title).toBe('Test Tour');
    const status = doc.getElementById('status');
    expect(status?.textContent).toBe('');
    expect(status?.hidden).toBe(true);
    expect(doc.getElementById('preview-badge')).toBeNull();

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

  it('enregistre l’ouverture de visite et le changement de langue sans bloquer l’interface', async () => {
    mockLoad.mockResolvedValue(mockGraph);
    const stats = { openTour: vi.fn(), langChange: vi.fn() };

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate, stats }
    );

    expect(stats.openTour).toHaveBeenCalledExactlyOnceWith(mockGraph.id);
    const language = doc.getElementById('lang-switcher') as HTMLSelectElement;
    language.value = 'ar';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    expect(stats.langChange).toHaveBeenCalledExactlyOnceWith('ar');
    expect(mockNavigate).toHaveBeenCalledWith('?lang=ar');

    const throwingStats = {
      openTour: vi.fn(() => { throw new Error('stats offline'); }),
      langChange: vi.fn(() => { throw new Error('stats offline'); }),
    };
    const secondDoc = document.implementation.createHTMLDocument();
    await expect(startViewer(
      secondDoc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate, stats: throwingStats }
    )).resolves.toBeUndefined();
    expect(mockMount).toHaveBeenCalledTimes(2);
  });

  it('erreur de montage: affiche loadError et ne reste pas masquée', async () => {
    mockLoad.mockResolvedValue(mockGraph);

    mockMount.mockImplementation(() => {
      throw new Error('Mount error');
    });

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.fr.viewer.loadError);
    expect(status?.hidden).toBe(false);
  });

  it('enregistre un scan QR pour les visites web marquées src=kiosk', async () => {
    mockLoad.mockResolvedValue(mockGraph);
    const qrShown = vi.fn();
    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '?src=kiosk&lang=fr' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate, stats: { openTour: vi.fn(), langChange: vi.fn(), qrShown } },
    );
    expect(qrShown).toHaveBeenCalledWith(mockGraph.id);
  });

  it('preview: appelle loadPreview et affiche le bandeau', async () => {
    mockLoadPreview.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/preview/abc.def', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(mockLoadPreview).toHaveBeenCalledWith('abc.def', 'fr');
    expect(mockLoad).not.toHaveBeenCalled();

    const badge = doc.getElementById('preview-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe(resources.fr.viewer.preview.badge);

    expect(mockMount).toHaveBeenCalledTimes(1);
  });

  it('preview: loadPreview rejeté avec TourNotFoundError affiche notFound', async () => {
    mockLoadPreview.mockRejectedValue(new TourNotFoundError());

    await startViewer(
      doc,
      { pathname: '/v/preview/abc.def', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(mockLoadPreview).toHaveBeenCalled();
    const status = doc.getElementById('status');
    expect(status?.textContent).toBe(resources.fr.viewer.notFound);
    expect(mockMount).not.toHaveBeenCalled();
  });

  it('route legal : affiche la page légale complète sans charger de visite', async () => {
    await startViewer(
      doc,
      { pathname: '/v/legal', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(mockLoad).not.toHaveBeenCalled();
    expect(mockLoadPreview).not.toHaveBeenCalled();
    expect(mockMount).not.toHaveBeenCalled();
    const status = doc.getElementById('status');
    expect(status?.hidden).toBe(true);
    const legal = doc.getElementById('legal');
    expect(legal).not.toBeNull();
    const h1 = legal?.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe(resources.fr.legal.title);
    expect(doc.title).toBe(resources.fr.legal.title);

    const sections = legal?.querySelectorAll('section');
    expect(sections?.length).toBe(4);
    expect(legal?.querySelector('.xplor-legal-publisher')).not.toBeNull();
    expect(legal?.querySelector('.xplor-legal-hosting')).not.toBeNull();
    expect(legal?.querySelector('.xplor-legal-privacy')).not.toBeNull();
    expect(legal?.querySelector('.xplor-legal-contact')).not.toBeNull();

    // Sans paramètre from, aucun bouton retour
    expect(legal?.querySelector('.xplor-legal-back')).toBeNull();
    // Le lien vers /v/legal n'est pas affiché sur la page légale elle-même
    expect(doc.getElementById('legal-link')).toBeNull();
  });

  it('route legal : retire #legal-link s\'il était déjà présent dans le DOM et masque le viewer', async () => {
    const existingLink = doc.createElement('a');
    existingLink.id = 'legal-link';
    doc.body.append(existingLink);

    await startViewer(
      doc,
      { pathname: '/v/legal', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(doc.getElementById('legal-link')).toBeNull();
    expect(doc.getElementById('viewer')?.hidden).toBe(true);
  });

  it('route legal : un from externe (https://evil.example) est ignoré et backHref est null', async () => {
    await startViewer(
      doc,
      { pathname: '/v/legal', search: '?from=https://evil.example' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const legal = doc.getElementById('legal');
    expect(legal).not.toBeNull();
    expect(legal?.querySelector('.xplor-legal-back')).toBeNull();
  });

  it('route legal : un from externe relatif sans /v/ ou avec protocole est ignoré', async () => {
    await startViewer(
      doc,
      { pathname: '/v/legal', search: '?from=%2F%2Fevil.example' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );
    expect(doc.querySelector('.xplor-legal-back')).toBeNull();

    const secondDoc = document.implementation.createHTMLDocument();
    await startViewer(
      secondDoc,
      { pathname: '/v/legal', search: '?from=javascript:alert(1)' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );
    expect(secondDoc.querySelector('.xplor-legal-back')).toBeNull();

    const thirdDoc = document.implementation.createHTMLDocument();
    await startViewer(
      thirdDoc,
      { pathname: '/v/legal', search: '?from=%2Fv%2F%2Fevil.example' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );
    expect(thirdDoc.querySelector('.xplor-legal-back')).toBeNull();
  });

  it('route legal : un from interne valide commençant par /v/ affiche le bouton retour', async () => {
    await startViewer(
      doc,
      { pathname: '/v/legal', search: '?from=%2Fv%2FvalidToken' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const backLink = doc.querySelector('.xplor-legal-back');
    expect(backLink).not.toBeNull();
    if (backLink instanceof HTMLAnchorElement) {
      expect(backLink.getAttribute('href')).toBe('/v/validToken');
      expect(backLink.textContent).toBe(resources.fr.legal.back);
    }
  });

  it('route legal : respecte la langue demandée via resolveLang(location.search)', async () => {
    await startViewer(
      doc,
      { pathname: '/v/legal', search: '?lang=en&from=%2Fv%2FvalidToken' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(doc.documentElement.getAttribute('lang')).toBe('en');
    expect(doc.documentElement.getAttribute('dir')).toBe('ltr');
    expect(doc.title).toBe(resources.en.legal.title);
    const h1 = doc.querySelector('.xplor-legal-title');
    expect(h1?.textContent).toBe(resources.en.legal.title);
    const backLink = doc.querySelector('.xplor-legal-back');
    expect(backLink?.textContent).toBe(resources.en.legal.back);

    const arDoc = document.implementation.createHTMLDocument();
    await startViewer(
      arDoc,
      { pathname: '/v/legal', search: '?lang=ar' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    expect(arDoc.documentElement.getAttribute('lang')).toBe('ar');
    expect(arDoc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(arDoc.title).toBe(resources.ar.legal.title);
    expect(arDoc.querySelector('.xplor-legal-title')?.textContent).toBe(resources.ar.legal.title);
  });

  it('transmet mountVr et le libellé i18n au contrôleur', async () => {
    mockLoad.mockResolvedValue(mockGraph);
    const mockMountVr = vi.fn().mockResolvedValue({ destroy: vi.fn() });

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      {
        load: mockLoad,
        loadPreview: mockLoadPreview,
        mount: mockMount,
        navigate: mockNavigate,
        mountVr: mockMountVr,
      }
    );

    const controls = doc.getElementById('controls');
    expect(controls).not.toBeNull();
    expect(mockMountVr).toHaveBeenCalledTimes(1);
    expect(mockMountVr).toHaveBeenCalledWith(controls, 'scene-1', mockGraph, expect.any(Function));
  });

  it('transmet le callback onVrChange du contrôleur à mountVr', async () => {
    mockLoad.mockResolvedValue(mockGraph);
    let capturedOnVrChange: ((active: boolean) => void) | undefined;
    const mockMountVr = vi.fn().mockImplementation((
      _container: HTMLElement,
      _sceneId: string,
      _graph: TourGraph,
      onVrChange?: (active: boolean) => void
    ) => {
      capturedOnVrChange = onVrChange;
      return Promise.resolve({ destroy: vi.fn() });
    });

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      {
        load: mockLoad,
        loadPreview: mockLoadPreview,
        mount: mockMount,
        navigate: mockNavigate,
        mountVr: mockMountVr,
      }
    );

    expect(typeof capturedOnVrChange).toBe('function');

    const placesBtn = doc.querySelector('button.xplor-nav-btn--places');
    expect(placesBtn).not.toBeNull();
    if (!(placesBtn instanceof HTMLButtonElement)) throw new Error('Missing placesBtn');
    expect(placesBtn.hidden).toBe(false);

    const legalLink = doc.getElementById('legal-link');
    expect(legalLink).not.toBeNull();
    if (!(legalLink instanceof HTMLElement)) throw new Error('Missing legalLink');
    expect(legalLink.hidden).toBe(false);

    if (typeof capturedOnVrChange === 'function') {
      capturedOnVrChange(true);
    }
    expect(placesBtn.hidden).toBe(true);
    expect(legalLink.hidden).toBe(true);

    if (typeof capturedOnVrChange === 'function') {
      capturedOnVrChange(false);
    }
    expect(placesBtn.hidden).toBe(false);
    expect(legalLink.hidden).toBe(false);
  });

  it('visite publique : crée le lien #legal-link avec libellé i18n et href encodé', async () => {
    mockLoad.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const legalLink = doc.getElementById('legal-link');
    expect(legalLink).not.toBeNull();
    if (!(legalLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected #legal-link to be an HTMLAnchorElement');
    }
    expect(legalLink.textContent).toBe(resources.fr.legal.linkLabel);
    expect(legalLink.getAttribute('href')).toBe('/v/legal?lang=fr&from=%2Fv%2FvalidToken');
    expect(legalLink.hidden).toBe(false);
  });

  it('visite publique : respecte la langue pour le libellé et le paramètre lang de #legal-link', async () => {
    mockLoad.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/validToken', search: '?lang=en' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const enLink = doc.getElementById('legal-link');
    expect(enLink).not.toBeNull();
    if (!(enLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected #legal-link to be an HTMLAnchorElement');
    }
    expect(enLink.textContent).toBe(resources.en.legal.linkLabel);
    expect(enLink.getAttribute('href')).toBe('/v/legal?lang=en&from=%2Fv%2FvalidToken');

    const arDoc = document.implementation.createHTMLDocument();
    await startViewer(
      arDoc,
      { pathname: '/v/validToken', search: '?lang=ar' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const arLink = arDoc.getElementById('legal-link');
    expect(arLink).not.toBeNull();
    if (!(arLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected #legal-link to be an HTMLAnchorElement');
    }
    expect(arLink.textContent).toBe(resources.ar.legal.linkLabel);
    expect(arLink.getAttribute('href')).toBe('/v/legal?lang=ar&from=%2Fv%2FvalidToken');
  });

  it('route preview : conserve le lien #legal-link avec le pathname de prévisualisation dans from', async () => {
    mockLoadPreview.mockResolvedValue(mockGraph);

    await startViewer(
      doc,
      { pathname: '/v/preview/tok-preview', search: '' },
      { load: mockLoad, loadPreview: mockLoadPreview, mount: mockMount, navigate: mockNavigate }
    );

    const legalLink = doc.getElementById('legal-link');
    expect(legalLink).not.toBeNull();
    if (!(legalLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected #legal-link to be an HTMLAnchorElement');
    }
    expect(legalLink.textContent).toBe(resources.fr.legal.linkLabel);
    expect(legalLink.getAttribute('href')).toBe('/v/legal?lang=fr&from=%2Fv%2Fpreview%2Ftok-preview');
  });
});
