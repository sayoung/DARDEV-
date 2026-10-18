import { dir, resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

export interface RenderAttractOptions {
  tourUrl: string | null;
  lang: Lang;
  onWake: () => void;
}

const attractCleanups = new WeakMap<HTMLElement, () => void>();

/**
 * Rendu DOM plein écran du mode veille du kiosque (F-63).
 *
 * Affiche :
 * - Un conteneur d'arrière-plan pour l'aperçu de la visite tournante (`data-tour-url`).
 * - Un overlay centré affichant le message i18n « Touchez l'écran pour explorer ».
 * - Un écouteur `pointerdown` (ainsi que `click` et clavier accessible) sur tout l'écran appelant `onWake`.
 * - Aucun lien externe ni navigation hors kiosque.
 */
export function renderAttract(
  doc: Document,
  root: HTMLElement,
  { tourUrl, lang, onWake }: RenderAttractOptions,
): void {
  // Nettoyage d'éventuels écouteurs d'un rendu attract précédent sur ce même conteneur racine
  const previousCleanup = attractCleanups.get(root);
  if (previousCleanup !== undefined) {
    previousCleanup();
    attractCleanups.delete(root);
  }

  const direction = dir(lang);
  doc.documentElement.setAttribute('dir', direction);
  doc.documentElement.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);

  root.className = 'kiosk-screen kiosk-screen-attract';
  root.setAttribute('role', 'region');
  root.setAttribute('tabindex', '0');
  root.setAttribute('aria-label', resources[lang].kiosk.touchToExplore);

  root.replaceChildren();

  // Conteneur d'aperçu de la visite
  const preview = doc.createElement('div');
  preview.className = 'kiosk-attract-preview';
  preview.setAttribute('data-testid', 'kiosk-attract-preview');
  if (tourUrl !== null) {
    preview.setAttribute('data-tour-url', tourUrl);
  }
  root.appendChild(preview);

  // Superposition / Message invitant à toucher l'écran
  const overlay = doc.createElement('div');
  overlay.className = 'kiosk-attract-overlay';

  const message = doc.createElement('p');
  message.className = 'kiosk-attract-message';
  message.textContent = resources[lang].kiosk.touchToExplore;
  overlay.appendChild(message);

  root.appendChild(overlay);

  // Gestionnaire d'interaction plein écran pour réveiller le kiosque
  const controller = new AbortController();
  const { signal } = controller;

  const cleanup = (): void => {
    controller.abort();
    attractCleanups.delete(root);
  };

  attractCleanups.set(root, cleanup);

  const handleWake = (): void => {
    cleanup();
    onWake();
  };

  // Écouteurs sur root et ses éléments enfants pour capturer immédiatement l'interaction
  root.addEventListener('pointerdown', handleWake, { signal });
  root.addEventListener('click', handleWake, { signal });
  preview.addEventListener('pointerdown', handleWake, { signal });
  preview.addEventListener('click', handleWake, { signal });
  overlay.addEventListener('pointerdown', handleWake, { signal });
  overlay.addEventListener('click', handleWake, { signal });
  message.addEventListener('pointerdown', handleWake, { signal });
  message.addEventListener('click', handleWake, { signal });

  // Accessibilité clavier
  root.addEventListener(
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        handleWake();
      }
    },
    { signal },
  );
}
