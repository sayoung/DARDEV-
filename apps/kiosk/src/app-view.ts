import type { AppState, AppStore } from './app-state.js';
import { renderScreen, type OnEnrollCallback } from './render-screen.js';

export interface AppViewDeps {
  onEnroll?: OnEnrollCallback;
}

export interface CreateAppViewOptions {
  doc: Document;
  root: HTMLElement;
  state: AppStore;
  deps?: AppViewDeps;
}

export interface AppView {
  dispose(): void;
  destroy(): void;
}

/**
 * Vue orchestratrice de l'application kiosque (F-60 / F-61).
 *
 * Étape 1/3 (squelette d'app-view) :
 * - S'abonne au store et restitue l'affichage courant puis réagit à chaque mise à jour.
 * - Vide `root` avant d'appeler la fonction de rendu.
 * - Délègue les écrans ENROLL, LOADING et UNAVAILABLE à `renderScreen`.
 * - Assure un repli sûr (root vidé) pour les autres écrans en attendant les étapes suivantes.
 * - Renvoie un objet exposant `dispose()` qui résilie l'abonnement et arrête les rendus.
 */
export function createAppView({
  doc,
  root,
  state,
  deps,
}: CreateAppViewOptions): AppView {
  function renderCurrent(currentState: AppState): void {
    root.replaceChildren();

    switch (currentState.screen) {
      case 'ENROLL': {
        const onEnroll = deps?.onEnroll;
        renderScreen(
          doc,
          root,
          'ENROLL',
          currentState.lang,
          onEnroll !== undefined ? { onEnroll } : undefined,
        );
        break;
      }

      case 'LOADING': {
        renderScreen(doc, root, 'LOADING', currentState.lang);
        break;
      }

      case 'UNAVAILABLE': {
        renderScreen(doc, root, 'UNAVAILABLE', currentState.lang);
        break;
      }

      default: {
        root.replaceChildren();
        root.className = '';
        break;
      }
    }
  }

  const unsubscribe = state.subscribe((nextState) => {
    renderCurrent(nextState);
  });

  renderCurrent(state.getState());

  let disposed = false;
  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribe();
  };

  return {
    dispose,
    destroy: dispose,
  };
}
