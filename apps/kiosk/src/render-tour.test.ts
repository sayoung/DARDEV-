import { resources } from '@xplor/i18n';
import type { TourGraph } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderTour, type MountViewerFn } from './render-tour.js';

function createMockTourGraph(id: string = 'tour-1'): TourGraph {
  return {
    id,
    contentVersion: 1,
    lang: 'fr',
    title: 'Visite Virtuelle Test',
    summary: 'Résumé de la visite test',
    city: 'Rabat',
    categories: ['cat-1'],
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
          preview: 'https://example.com/preview.jpg',
          web: 'https://example.com/web.jpg',
          tiles: {
            width: 512,
            cols: 2,
            rows: 1,
            baseUrl: 'https://example.com/tiles',
          },
        },
        initialView: {
          yaw: 0,
          pitch: 0,
          zoom: 1,
        },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'https://example.com/thumb.jpg',
        hotspots: [],
      },
    ],
    linkedTours: [],
  };
}

describe('renderTour (F-62/F-61)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  describe('Montée de la visionneuse', () => {
    it('monte la visionneuse factice sur les données de loadTour(tourId)', async () => {
      const graph = createMockTourGraph('tour-123');
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      renderTour(document, root, {
        tourId: 'tour-123',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      expect(loadTour).toHaveBeenCalledWith('tour-123');
      expect(root.getAttribute('lang')).toBe('fr');
      expect(root.getAttribute('dir')).toBe('ltr');
      expect(root.className).toBe('kiosk-tour-view');

      const viewerContainer = root.querySelector(
        '[data-testid="kiosk-tour-viewer"]',
      );
      expect(viewerContainer).toBeInstanceOf(HTMLDivElement);

      const statusEl = root.querySelector('.kiosk-tour-status');
      expect(statusEl).toBeInstanceOf(HTMLDivElement);
      if (statusEl instanceof HTMLDivElement) {
        expect(statusEl.textContent).toBe(resources.fr.viewer.loading);
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(mountViewer).toHaveBeenCalledTimes(1);
      if (viewerContainer instanceof HTMLDivElement) {
        expect(mountViewer).toHaveBeenCalledWith(viewerContainer, graph);
        expect(viewerContainer.getAttribute('aria-label')).toBe(graph.title);
      }

      if (statusEl instanceof HTMLDivElement) {
        expect(statusEl.hidden).toBe(true);
      }
    });

    it('relaye les événements statistiques de la visite, scène, hotspot et narration', async () => {
      const graph = createMockTourGraph('tour-stats');
      const scene = graph.scenes[0];
      if (!scene) throw new Error('scene missing');
      scene.narrationUrl = 'narration.mp3';
      const audio = document.createElement('audio');
      audio.play = vi.fn().mockResolvedValue(undefined);
      audio.pause = vi.fn();
      let callbacks: Parameters<MountViewerFn>[2] | undefined;
      const mountViewer = vi.fn<MountViewerFn>((_container, _graph, options) => {
        callbacks = options;
        return { destroy: vi.fn() };
      });
      const onTourOpen = vi.fn();
      const onSceneChange = vi.fn();
      const onHotspotClick = vi.fn();
      const onAudioPlay = vi.fn();

      renderTour(document, root, {
        tourId: graph.id,
        lang: 'fr',
        onClose: vi.fn(),
        loadTour: () => graph,
        mountViewer,
        audioFactory: () => audio,
        onTourOpen,
        onSceneChange,
        onHotspotClick,
        onAudioPlay,
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(onTourOpen).toHaveBeenCalledExactlyOnceWith(graph.id);
      callbacks?.onSceneChange?.('scene-2');
      callbacks?.onHotspotClick?.('hotspot-1');
      expect(onSceneChange).toHaveBeenCalledWith(graph.id, 'scene-2');
      expect(onHotspotClick).toHaveBeenCalledWith(graph.id, 'scene-2', 'hotspot-1');

      callbacks?.onSceneChange?.(graph.startSceneId);
      (root.querySelector('[data-testid="kiosk-tour-audio-btn"]') as HTMLButtonElement).click();
      await Promise.resolve();
      expect(onAudioPlay).toHaveBeenCalledWith(graph.id, graph.startSceneId);
    });

    it('affiche le bouton Retour avec la clé i18n et supporte RTL', () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: vi.fn(),
      }));

      renderTour(document, root, {
        tourId: 'tour-ar',
        lang: 'ar',
        onClose: vi.fn(),
        loadTour,
        mountViewer,
      });

      expect(root.getAttribute('lang')).toBe('ar');
      expect(root.getAttribute('dir')).toBe('rtl');

      const backBtn = root.querySelector('[data-testid="kiosk-tour-back-btn"]');
      expect(backBtn).toBeInstanceOf(HTMLButtonElement);
      if (backBtn instanceof HTMLButtonElement) {
        expect(backBtn.textContent).toBe(resources.ar.viewer.back);
        expect(backBtn.getAttribute('aria-label')).toBe(
          resources.ar.viewer.back,
        );
        expect(backBtn.disabled).toBe(false);
      }
    });
  });

  describe('Clic sur Retour', () => {
    it('détruit la visionneuse et déclenche onClose lors du clic sur Retour', async () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      renderTour(document, root, {
        tourId: 'tour-click',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(destroyViewer).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      const backBtn = root.querySelector('[data-testid="kiosk-tour-back-btn"]');
      expect(backBtn).toBeInstanceOf(HTMLButtonElement);
      if (backBtn instanceof HTMLButtonElement) {
        backBtn.click();
        expect(backBtn.disabled).toBe(true);
      }

      expect(destroyViewer).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      // Clic répété : ne rappelle pas onClose ni destroy
      if (backBtn instanceof HTMLButtonElement) {
        backBtn.click();
      }
      expect(destroyViewer).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy() externe', () => {
    it('détruit la visionneuse sans appeler onClose et est idempotent', async () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      const handle = renderTour(document, root, {
        tourId: 'tour-ext',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      handle.destroy();

      expect(destroyViewer).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();

      // Deuxième appel de destroy() : idempotent
      handle.destroy();
      expect(destroyViewer).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('ne monte pas la visionneuse si destroy() est appelé pendant le chargement', async () => {
      let resolveTour: (graph: TourGraph) => void = () => {};
      const loadTour = vi.fn(
        () =>
          new Promise<TourGraph>((resolve) => {
            resolveTour = resolve;
          }),
      );
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      const handle = renderTour(document, root, {
        tourId: 'tour-pending',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      expect(mountViewer).not.toHaveBeenCalled();

      handle.destroy();

      resolveTour(createMockTourGraph('tour-pending'));

      await Promise.resolve();
      await Promise.resolve();

      expect(mountViewer).not.toHaveBeenCalled();
      expect(destroyViewer).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Touche Échap (Escape)', () => {
    it('déclenche onClose et détruit la visionneuse lors de l’appui sur Échap', async () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      renderTour(document, root, {
        tourId: 'tour-escape',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      document.dispatchEvent(enterEvent);
      expect(onClose).not.toHaveBeenCalled();
      expect(destroyViewer).not.toHaveBeenCalled();

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(destroyViewer).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('retire l’écouteur Échap après destroy() externe', async () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      const handle = renderTour(document, root, {
        tourId: 'tour-escape-removed',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      handle.destroy();

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(onClose).not.toHaveBeenCalled();
      expect(destroyViewer).toHaveBeenCalledTimes(1);
    });

    it('retire l’écouteur Échap après un premier clic Retour', async () => {
      const loadTour = vi.fn((tourId: string) => Promise.resolve(createMockTourGraph(tourId)));
      const destroyViewer = vi.fn();
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: destroyViewer,
      }));
      const onClose = vi.fn();

      renderTour(document, root, {
        tourId: 'tour-escape-after-back',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      const backBtn = root.querySelector('[data-testid="kiosk-tour-back-btn"]');
      expect(backBtn).toBeInstanceOf(HTMLButtonElement);
      if (backBtn instanceof HTMLButtonElement) {
        backBtn.click();
      }

      expect(onClose).toHaveBeenCalledTimes(1);

      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(destroyViewer).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gestion des erreurs de chargement', () => {
    it('affiche le message d’erreur notFound si TourNotFoundError est levée', async () => {
      class TourNotFoundError extends Error {
        constructor() {
          super('Tour not found');
          this.name = 'TourNotFoundError';
        }
      }

      const loadTour = vi.fn(() => Promise.reject(new TourNotFoundError()));
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: vi.fn(),
      }));
      const onClose = vi.fn();

      renderTour(document, root, {
        tourId: 'missing-tour',
        lang: 'fr',
        onClose,
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      const statusEl = root.querySelector('.kiosk-tour-status');
      expect(statusEl).toBeInstanceOf(HTMLDivElement);
      if (statusEl instanceof HTMLDivElement) {
        expect(statusEl.hidden).toBe(false);
        expect(statusEl.textContent).toBe(resources.fr.viewer.notFound);
      }

      expect(mountViewer).not.toHaveBeenCalled();

      // Le bouton retour permet de fermer même en cas d'erreur
      const backBtn = root.querySelector('[data-testid="kiosk-tour-back-btn"]');
      expect(backBtn).toBeInstanceOf(HTMLButtonElement);
      if (backBtn instanceof HTMLButtonElement) {
        backBtn.click();
      }
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('affiche le message d’erreur loadError si une erreur générique survient', async () => {
      const loadTour = vi.fn(() => Promise.reject(new Error('Network error')));
      const mountViewer: MountViewerFn = vi.fn(() => ({
        destroy: vi.fn(),
      }));

      renderTour(document, root, {
        tourId: 'error-tour',
        lang: 'fr',
        onClose: vi.fn(),
        loadTour,
        mountViewer,
      });

      await Promise.resolve();
      await Promise.resolve();

      const statusEl = root.querySelector('.kiosk-tour-status');
      expect(statusEl).toBeInstanceOf(HTMLDivElement);
      if (statusEl instanceof HTMLDivElement) {
        expect(statusEl.hidden).toBe(false);
        expect(statusEl.textContent).toBe(resources.fr.viewer.loadError);
      }
    });
  });
});
