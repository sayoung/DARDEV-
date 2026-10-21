import { dir, resources } from '@xplor/i18n';
import type { Lang, TourGraph } from '@xplor/shared';

export interface ViewerInstance {
  destroy(): void;
}

export type MountViewerFn = (
  container: HTMLElement,
  graph: TourGraph,
  options?: {
    onSceneChange?: (sceneId: string) => void;
    onHotspotClick?: (hotspotId: string) => void;
  },
) => ViewerInstance;

export type LoadTourFn = (tourId: string) => Promise<TourGraph> | TourGraph;

export interface RenderTourOptions {
  tourId: string;
  lang: Lang;
  onClose: () => void;
  loadTour: LoadTourFn;
  mountViewer: MountViewerFn;
  onTourOpen?: (tourId: string) => void;
  onSceneChange?: (tourId: string, sceneId: string) => void;
  onHotspotClick?: (tourId: string, sceneId: string, hotspotId: string) => void;
  onAudioPlay?: (tourId: string, sceneId: string) => void;
  audioFactory?: (url: string) => HTMLAudioElement;
}

export interface RenderTourHandle {
  destroy(): void;
}

/**
 * Rendu et cycle de vie d'une visite 360° sur le kiosque (F-62 / F-61).
 *
 * Fonctionnalités :
 * - Monte la visionneuse Photo Sphere Viewer via la fonction injectée `mountViewer`.
 * - Récupère la visite via la fonction injectée `loadTour`.
 * - Ajoute un bouton « Retour » accessible pour fermer la visite et revenir à l'accueil.
 * - Écoute la touche « Échap » (Escape) pour déclencher la fermeture.
 * - Le clic sur Retour ou l'appui sur Échap détruit la visionneuse et appelle `onClose`.
 * - Le handle `destroy()` externe détruit la visionneuse, retire l'écouteur `keydown`,
 *   n'appelle pas `onClose` et est idempotent.
 * - Protège contre les doubles actions (désactivation immédiate du bouton Retour).
 * - Affiche un indicateur de chargement et des messages d'erreur traduits (i18n).
 */
export function renderTour(
  doc: Document,
  root: HTMLElement,
  options: RenderTourOptions,
): RenderTourHandle {
  const { tourId, lang, onClose, loadTour, mountViewer } = options;

  const direction = dir(lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);
  root.className = 'kiosk-tour-view';
  root.replaceChildren();

  let isDestroyed = false;
  let viewerInstance: ViewerInstance | null = null;

  const viewerContainer = doc.createElement('div');
  viewerContainer.className = 'kiosk-tour-viewer';
  viewerContainer.setAttribute('data-testid', 'kiosk-tour-viewer');
  viewerContainer.setAttribute('role', 'region');
  viewerContainer.setAttribute('aria-label', resources[lang].kiosk.home.explore);

  const statusEl = doc.createElement('div');
  statusEl.className = 'kiosk-tour-status';
  statusEl.setAttribute('role', 'status');
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.textContent = resources[lang].viewer.loading;

  const backButton = doc.createElement('button');
  backButton.type = 'button';
  backButton.className = 'kiosk-tour-back-btn';
  backButton.setAttribute('data-testid', 'kiosk-tour-back-btn');
  backButton.setAttribute('aria-label', resources[lang].viewer.back);
  backButton.textContent = resources[lang].viewer.back;

  const audioButton = doc.createElement('button');
  audioButton.type = 'button';
  audioButton.className = 'kiosk-tour-audio-btn';
  audioButton.setAttribute('data-testid', 'kiosk-tour-audio-btn');
  audioButton.setAttribute('aria-label', resources[lang].viewer.play);
  audioButton.textContent = '▶';
  audioButton.hidden = true;

  let narrationAudio: HTMLAudioElement | null = null;
  let currentSceneId: string | null = null;
  const setAudioScene = (graph: TourGraph, sceneId: string): void => {
    if (narrationAudio !== null) {
      narrationAudio.removeEventListener('ended', handleAudioEnded);
      narrationAudio.pause();
      narrationAudio.src = '';
      narrationAudio = null;
    }
    currentSceneId = sceneId;
    const scene = graph.scenes.find((candidate) => candidate.id === sceneId);
    if (scene?.narrationUrl) {
      narrationAudio = options.audioFactory?.(scene.narrationUrl) ?? doc.createElement('audio');
      narrationAudio.src = scene.narrationUrl;
      narrationAudio.addEventListener('ended', handleAudioEnded);
      audioButton.hidden = false;
      audioButton.setAttribute('aria-label', resources[lang].viewer.play);
      audioButton.textContent = '▶';
    } else {
      audioButton.hidden = true;
    }
  };

  const handleAudioClick = (): void => {
    if (narrationAudio === null || currentSceneId === null) return;
    if (!narrationAudio.paused) {
      narrationAudio.pause();
      audioButton.setAttribute('aria-label', resources[lang].viewer.play);
      audioButton.textContent = '▶';
      return;
    }
    narrationAudio.play().then(() => {
      if (isDestroyed) return;
      audioButton.setAttribute('aria-label', resources[lang].viewer.pause);
      audioButton.textContent = '⏸';
      options.onAudioPlay?.(tourId, currentSceneId ?? '');
    }).catch(() => {
      audioButton.setAttribute('aria-label', resources[lang].viewer.play);
      audioButton.textContent = '▶';
    });
  };

  const handleAudioEnded = (): void => {
    audioButton.setAttribute('aria-label', resources[lang].viewer.play);
    audioButton.textContent = '▶';
  };
  audioButton.addEventListener('click', handleAudioClick);

  root.appendChild(viewerContainer);
  root.appendChild(statusEl);
  root.appendChild(audioButton);
  root.appendChild(backButton);

  function cleanup(): void {
    doc.removeEventListener('keydown', handleKeyDown);
    audioButton.removeEventListener('click', handleAudioClick);
    if (narrationAudio !== null) {
      narrationAudio.removeEventListener('ended', handleAudioEnded);
      narrationAudio.pause();
      narrationAudio.src = '';
      narrationAudio = null;
    }
    if (viewerInstance !== null) {
      viewerInstance.destroy();
      viewerInstance = null;
    }
  }

  function handleClose(): void {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    backButton.disabled = true;
    cleanup();
    onClose();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }

  doc.addEventListener('keydown', handleKeyDown);

  backButton.addEventListener('click', () => {
    handleClose();
  });

  const tourPromiseOrValue = loadTour(tourId);
  const tourPromise =
    tourPromiseOrValue instanceof Promise
      ? tourPromiseOrValue
      : Promise.resolve(tourPromiseOrValue);

  tourPromise
    .then((graph: TourGraph) => {
      if (isDestroyed) {
        return;
      }
      statusEl.hidden = true;
      viewerContainer.setAttribute('aria-label', graph.title);
      currentSceneId = graph.startSceneId;
      setAudioScene(graph, currentSceneId);
      options.onTourOpen?.(graph.id);
      const viewerCallbacks = {
        onSceneChange: (sceneId: string) => {
          currentSceneId = sceneId;
          setAudioScene(graph, sceneId);
          options.onSceneChange?.(graph.id, sceneId);
        },
        onHotspotClick: (hotspotId: string) => {
          if (currentSceneId === null) return;
          options.onHotspotClick?.(graph.id, currentSceneId, hotspotId);
        },
      };
      viewerInstance = options.onSceneChange !== undefined || options.onHotspotClick !== undefined
        ? mountViewer(viewerContainer, graph, viewerCallbacks)
        : mountViewer(viewerContainer, graph);
    })
    .catch((error: unknown) => {
      if (isDestroyed) {
        return;
      }
      statusEl.hidden = false;
      if (error instanceof Error && error.name === 'TourNotFoundError') {
        statusEl.textContent = resources[lang].viewer.notFound;
      } else {
        statusEl.textContent = resources[lang].viewer.loadError;
      }
    });

  return {
    destroy(): void {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;
      backButton.disabled = true;
      cleanup();
    },
  };
}
