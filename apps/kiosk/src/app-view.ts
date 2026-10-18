import type { Lang } from '@xplor/shared';

import type { AppState, AppStore } from './app-state.js';
import { buildHomeModel } from './home-model.js';
import { renderAttract } from './render-attract.js';
import { renderHome } from './render-home.js';
import {
  renderMaintenancePin,
  type MaintenancePinVerifier,
} from './render-maintenance.js';
import {
  renderMaintenanceStatus,
  type ConfirmFn,
} from './render-maintenance-status.js';
import { renderScreen, type OnEnrollCallback } from './render-screen.js';

export type RenderTourCallback = (
  root: HTMLElement,
  tourId: string,
  onBack?: () => void,
) => void;

export interface AppViewDeps {
  onEnroll?: OnEnrollCallback;
  getAttractTourUrl?: (state: AppState) => string | null;
  verifyPin?: MaintenancePinVerifier;
  verifyMaintenancePin?: MaintenancePinVerifier;
  appVersion?: string;
  syncedManifestVersion?: string | null;
  lastSyncAt?: Date | null;
  failedTours?: string[];
  onForceSync?: () => void | Promise<void>;
  onReenroll?: () => void | Promise<void>;
  confirmFn?: ConfirmFn;
  renderTour?: RenderTourCallback;
  onBackHome?: () => void;
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

function assertUnreachable(value: never): never {
  throw new Error(`Unhandled screen: ${String(value)}`);
}

/**
 * Vue orchestratrice de l'application kiosque (F-60 / F-61).
 *
 * Étape 3/3 (orchestration complète de tous les écrans du kiosque) :
 * - S'abonne au store et restitue l'affichage courant puis réagit à chaque mise à jour.
 * - Vide `root` avant d'appeler la fonction de rendu.
 * - Délègue les écrans ENROLL, LOADING et UNAVAILABLE à `renderScreen`.
 * - Délègue l'écran HOME à `renderHome` avec le modèle issu de `buildHomeModel`.
 * - Relie les interactions de l'écran HOME aux actions `SELECT_TOUR`, `SELECT_CATEGORY` et `SELECT_LANG`.
 * - Délègue l'écran ATTRACT à `renderAttract` et relie le réveil à l'action `WAKE`.
 * - Délègue l'écran MAINTENANCE_PIN à `renderMaintenancePin` (succès -> `UNLOCK`, annulation -> `BACK_HOME`).
 * - Délègue l'écran MAINTENANCE à `renderMaintenanceStatus` (fermeture -> `CLOSE_MAINTENANCE`).
 * - Délègue l'écran TOUR au callback `deps.renderTour(root, tourId, onBack)` (retour -> `BACK_HOME`).
 * - Garantit la couverture exhaustive de l'ensemble des états d'écran (`never`).
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

      case 'MAINTENANCE_PIN': {
        const verify =
          deps?.verifyMaintenancePin ??
          deps?.verifyPin ??
          ((): Promise<boolean> => Promise.resolve(false));

        renderMaintenancePin(doc, root, {
          verify,
          onUnlock(): void {
            state.dispatch({ type: 'UNLOCK' });
          },
          onCancel(): void {
            deps?.onBackHome?.();
            state.dispatch({ type: 'BACK_HOME' });
          },
          lang: currentState.lang,
        });
        break;
      }

      case 'MAINTENANCE': {
        renderMaintenanceStatus(
          doc,
          root,
          {
            appVersion: deps?.appVersion ?? '1.0.0',
            syncedManifestVersion:
              deps?.syncedManifestVersion !== undefined
                ? deps.syncedManifestVersion
                : (currentState.manifest?.manifestVersion ?? null),
            lastSyncAt: deps?.lastSyncAt ?? null,
            failedTours: deps?.failedTours ?? [],
            lang: currentState.lang,
            onForceSync: deps?.onForceSync ?? ((): void => undefined),
            onReenroll: deps?.onReenroll ?? ((): void => undefined),
            onClose(): void {
              state.dispatch({ type: 'CLOSE_MAINTENANCE' });
            },
            confirmFn: deps?.confirmFn,
          },
          deps?.confirmFn,
        );
        break;
      }

      case 'TOUR': {
        root.replaceChildren();
        root.className = '';
        if (currentState.tourId !== null && deps?.renderTour !== undefined) {
          deps.renderTour(root, currentState.tourId, (): void => {
            deps.onBackHome?.();
            state.dispatch({ type: 'BACK_HOME' });
          });
        }
        break;
      }

      default: {
        assertUnreachable(currentState.screen);
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
