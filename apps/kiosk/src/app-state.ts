import type { KioskManifest, Lang } from '@xplor/shared';

import { resolveScreen } from './screen-state.js';

export type AppScreen =
  | 'ENROLL'
  | 'LOADING'
  | 'HOME'
  | 'UNAVAILABLE'
  | 'ATTRACT'
  | 'MAINTENANCE_PIN'
  | 'MAINTENANCE'
  | 'TOUR';

export type ScreenState = AppScreen;
export type KioskScreen = AppScreen;

export interface AppState {
  screen: AppScreen;
  manifest: KioskManifest | null;
  categoryId: string | null;
  lang: Lang;
  tourId: string | null;
  enrolled: boolean;
  disabled: boolean;
}

export interface ManifestLoadedAction {
  type: 'MANIFEST_LOADED';
  manifest: KioskManifest;
}

export interface EnrolledAction {
  type: 'ENROLLED';
  manifest?: KioskManifest | null;
}

export interface DisabledAction {
  type: 'DISABLED';
  disabled?: boolean;
}

export interface SelectTourAction {
  type: 'SELECT_TOUR';
  tourId: string;
}

export interface SelectCategoryAction {
  type: 'SELECT_CATEGORY';
  categoryId: string | null;
}

export interface SelectLangAction {
  type: 'SELECT_LANG';
  lang: Lang;
}

export interface IdleAction {
  type: 'IDLE';
}

export interface WakeAction {
  type: 'WAKE';
}

export interface OpenMaintenanceAction {
  type: 'OPEN_MAINTENANCE';
}

export interface UnlockAction {
  type: 'UNLOCK';
}

export interface CloseMaintenanceAction {
  type: 'CLOSE_MAINTENANCE';
}

export interface BackHomeAction {
  type: 'BACK_HOME';
}

export type AppAction =
  | ManifestLoadedAction
  | EnrolledAction
  | DisabledAction
  | SelectTourAction
  | SelectCategoryAction
  | SelectLangAction
  | IdleAction
  | WakeAction
  | OpenMaintenanceAction
  | UnlockAction
  | CloseMaintenanceAction
  | BackHomeAction;

export type AppStateListener = (state: AppState) => void;
export type Unsubscribe = () => void;

export interface AppStore {
  getState(): AppState;
  subscribe(listener: AppStateListener): Unsubscribe;
  dispatch(action: AppAction): void;
}

export interface CreateAppStateOptions {
  lang?: Lang;
  manifest?: KioskManifest | null;
  categoryId?: string | null;
  tourId?: string | null;
  enrolled?: boolean;
  disabled?: boolean;
  screen?: AppScreen;
}

/**
 * Fonction pure de réduction de l'état applicatif du kiosque (F-60 / F-61).
 *
 * Réutilise resolveScreen pour recalculer les écrans de base (ENROLL, UNAVAILABLE, LOADING, HOME).
 */
export function reduce(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'MANIFEST_LOADED': {
      const manifest = action.manifest;
      const baseScreen = resolveScreen({
        manifest,
        disabled: state.disabled,
        enrolled: state.enrolled,
      });

      const isBaseScreen =
        state.screen === 'ENROLL' ||
        state.screen === 'LOADING' ||
        state.screen === 'HOME' ||
        state.screen === 'UNAVAILABLE';

      const screen: AppScreen =
        baseScreen === 'UNAVAILABLE' || baseScreen === 'ENROLL' || isBaseScreen
          ? baseScreen
          : state.screen;

      return {
        ...state,
        manifest,
        screen,
        tourId: baseScreen === 'UNAVAILABLE' ? null : state.tourId,
      };
    }

    case 'ENROLLED': {
      const enrolled = true;
      const manifest =
        action.manifest !== undefined ? action.manifest : state.manifest;
      const screen: AppScreen = resolveScreen({
        manifest,
        disabled: state.disabled,
        enrolled,
      });
      return {
        ...state,
        enrolled,
        manifest,
        screen,
      };
    }

    case 'DISABLED': {
      const disabled = action.disabled ?? true;
      const screen: AppScreen = resolveScreen({
        manifest: state.manifest,
        disabled,
        enrolled: state.enrolled,
      });
      return {
        ...state,
        disabled,
        screen: disabled ? 'UNAVAILABLE' : screen,
        tourId: disabled ? null : state.tourId,
      };
    }

    case 'SELECT_TOUR': {
      return {
        ...state,
        screen: 'TOUR',
        tourId: action.tourId,
      };
    }

    case 'SELECT_CATEGORY': {
      return {
        ...state,
        categoryId: action.categoryId,
      };
    }

    case 'SELECT_LANG': {
      return {
        ...state,
        lang: action.lang,
      };
    }

    case 'IDLE': {
      if (
        state.screen === 'MAINTENANCE' ||
        state.screen === 'MAINTENANCE_PIN' ||
        state.screen === 'UNAVAILABLE' ||
        state.screen === 'ENROLL'
      ) {
        return state;
      }
      return {
        ...state,
        screen: 'ATTRACT',
        tourId: null,
      };
    }

    case 'WAKE': {
      const baseScreen: AppScreen = resolveScreen({
        manifest: state.manifest,
        disabled: state.disabled,
        enrolled: state.enrolled,
      });
      return {
        ...state,
        screen: baseScreen,
        tourId: null,
      };
    }

    case 'OPEN_MAINTENANCE': {
      return {
        ...state,
        screen: 'MAINTENANCE_PIN',
      };
    }

    case 'UNLOCK': {
      return {
        ...state,
        screen: 'MAINTENANCE',
      };
    }

    case 'CLOSE_MAINTENANCE': {
      const baseScreen: AppScreen = resolveScreen({
        manifest: state.manifest,
        disabled: state.disabled,
        enrolled: state.enrolled,
      });
      return {
        ...state,
        screen: baseScreen,
        tourId: null,
      };
    }

    case 'BACK_HOME': {
      const baseScreen: AppScreen = resolveScreen({
        manifest: state.manifest,
        disabled: state.disabled,
        enrolled: state.enrolled,
      });
      return {
        ...state,
        screen: baseScreen,
        tourId: null,
      };
    }

    default:
      return state;
  }
}

/**
 * Fabrique du store sans framework pour l'application kiosque (F-60 / F-61).
 *
 * Expose :
 * - getState() : renvoie l'état courant immuable
 * - subscribe(listener) : enregistre un observateur et renvoie une fonction de désabonnement
 * - dispatch(action) : applique la fonction pure reduce et notifie les observateurs
 */
export function createAppState(options: CreateAppStateOptions = {}): AppStore {
  const lang = options.lang ?? 'fr';
  const manifest = options.manifest ?? null;
  const categoryId = options.categoryId ?? null;
  const tourId = options.tourId ?? null;
  const enrolled = options.enrolled ?? false;
  const disabled = options.disabled ?? false;
  const screen: AppScreen =
    options.screen ??
    resolveScreen({
      manifest,
      disabled,
      enrolled,
    });

  let currentState: AppState = {
    screen,
    manifest,
    categoryId,
    lang,
    tourId,
    enrolled,
    disabled,
  };

  const listeners = new Set<AppStateListener>();

  return {
    getState(): AppState {
      return currentState;
    },
    subscribe(listener: AppStateListener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action: AppAction): void {
      currentState = reduce(currentState, action);
      for (const listener of Array.from(listeners)) {
        listener(currentState);
      }
    },
  };
}
