import type { Lang } from '@xplor/shared';

import type { AppState, AppStore } from './app-state.js';
import { buildHomeModel } from './home-model.js';
import { renderAttract } from './render-attract.js';
import { renderHome } from './render-home.js';
import { renderScreen, type OnEnrollCallback } from './render-screen.js';

export interface AppViewDeps {
  onEnroll?: OnEnrollCallback;
  getAttractTourUrl?: (state: AppState) => string | null;
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
 * Étape 2/3 (écrans HOME et ATTRACT) :
 * - S'abonne au store et restitue l'affichage courant puis réagit à chaque mise à jour.
 * - Vide `root` avant d'appeler la fonction de rendu.
 * - Délègue les écrans ENROLL, LOADING et UNAVAILABLE à `renderScreen`.
 * - Délègue l'écran HOME à `renderHome` avec le modèle issu de `buildHomeModel`.
 * - Relie les interactions de l'écran HOME aux actions `SELECT_TOUR`, `SELECT_CATEGORY` et `SELECT_LANG`.
 * - Délègue l'écran ATTRACT à `renderAttract` et relie le réveil à l'action `WAKE`.
 * - Assure un repli sûr (root vidé) pour les autres écrans en attendant l'étape 3/3.
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

      case 'HOME': {
        if (currentState.manifest === null) {
          root.replaceChildren();
          root.className = '';
          break;
        }

        const model = buildHomeModel(
          currentState.manifest,
          currentState.lang,
          currentState.categoryId,
        );

        renderHome(
          doc,
          root,
          model,
          {
            onSelectTour(id: string): void {
              state.dispatch({ type: 'SELECT_TOUR', tourId: id });
            },
            onSelectCategory(id: string | null): void {
              state.dispatch({ type: 'SELECT_CATEGORY', categoryId: id });
            },
            onSelectLang(lang: Lang): void {
              state.dispatch({ type: 'SELECT_LANG', lang });
            },
          },
          currentState.lang,
        );
        break;
      }

      case 'ATTRACT': {
        const getAttractTourUrl = deps?.getAttractTourUrl;
        const tourUrl =
          getAttractTourUrl !== undefined ? getAttractTourUrl(currentState) : null;

        renderAttract(doc, root, {
          tourUrl,
          lang: currentState.lang,
          onWake(): void {
            state.dispatch({ type: 'WAKE' });
          },
        });
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
