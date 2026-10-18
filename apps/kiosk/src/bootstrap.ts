import { dir, resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';

import { resolveApiUrl } from './api-url.js';
import { createAppState, type AppStore } from './app-state.js';
import {
  createAppView,
  type AppView,
  type AppViewDeps,
} from './app-view.js';
import {
  loadCredentials,
  type KioskCredentials,
  type Storage,
} from './credentials.js';
import { enrollKiosk, resetEnrollment } from './enroll-flow.js';
import {
  wireInteractions,
  type InteractionWiring,
} from './interaction-wiring.js';
import type { MaintenancePinVerifier } from './maintenance-pin.js';
import { resolveLang } from './mount.js';
import type { ConfirmFn } from './render-maintenance-status.js';
import { renderScreen } from './render-screen.js';

export interface BootstrapKioskOptions {
  apiUrl?: string;
  lang?: Lang;
  storage?: Storage;
  fetchFn?: typeof fetch;
  root?: HTMLElement;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  verifyMaintenancePin?: MaintenancePinVerifier;
  confirmFn?: ConfirmFn;
  appVersion?: string;
}

export interface KioskBootstrapInstance {
  readonly state: AppStore;
  readonly view: AppView;
  readonly wiring: InteractionWiring;
  resetEnrollment: () => Promise<void>;
  dispose: () => void;
}

function resolveRoot(doc: Document, customRoot?: HTMLElement): HTMLElement {
  if (customRoot !== undefined) {
    return customRoot;
  }
  const existingApp = doc.getElementById('app');
  if (existingApp !== null) {
    return existingApp;
  }
  const newApp = doc.createElement('div');
  newApp.id = 'app';
  doc.body.appendChild(newApp);
  return newApp;
}

function resolveFetchFn(win: Window, custom?: typeof fetch): typeof fetch {
  if (typeof custom === 'function') {
    return custom;
  }
  if (typeof win.fetch === 'function') {
    return win.fetch.bind(win);
  }
  return globalThis.fetch;
}

/**
 * Assemblage et démarrage minimal du kiosque Xplor (M5 F-60 assemblage 2/4).
 *
 * 1. Initialise le stockage local et charge les identifiants éventuels (loadCredentials).
 * 2. Si loadCredentials renvoie null, l'état initial est à l'écran ENROLL.
 * 3. Initialise le store d'état applicatif (createAppState).
 * 4. Câble les interactions globales et la détection d'inactivité (wireInteractions).
 * 5. Instancie la vue orchestratrice (createAppView).
 * 6. En cas d'enrôlement (onEnroll), appelle enrollKiosk avec l'URL de resolveApiUrl(import.meta.env)
 *    puis dispatche ENROLLED.
 * 7. En cas de réenrôlement (« Réenrôler »), appelle resetEnrollment puis réaffiche l'écran ENROLL.
 */
export function bootstrapKiosk(
  win: Window,
  doc: Document,
  options?: BootstrapKioskOptions,
): KioskBootstrapInstance {
  const storage: Storage = options?.storage ?? win.localStorage;
  const apiUrl = options?.apiUrl ?? resolveApiUrl(import.meta.env);
  const fetchFn = resolveFetchFn(win, options?.fetchFn);

  const initialCredentials: KioskCredentials | null = loadCredentials(storage);
  const enrolled = initialCredentials !== null;

  const search = win.location.search;
  const initialLang: Lang = options?.lang ?? resolveLang(search);

  doc.documentElement.setAttribute('lang', initialLang);
  doc.documentElement.setAttribute('dir', dir(initialLang));
  doc.title = resources[initialLang].common.appName;

  const root = resolveRoot(doc, options?.root);

  const state = createAppState({
    lang: initialLang,
    enrolled,
    manifest: null,
  });

  const handleEnroll = async (code: string): Promise<void> => {
    const enrollResult = await enrollKiosk({
      code,
      fetchFn,
      baseUrl: apiUrl,
      storage,
    });

    if (!enrollResult.ok) {
      const currentLang = state.getState().lang;
      const message =
        enrollResult.reason === 'INVALID_CODE'
          ? resources[currentLang].kiosk.enroll.invalidCode
          : resources[currentLang].common.error.generic;
      throw new Error(message);
    }

    state.dispatch({ type: 'ENROLLED' });
  };

  const handleReenroll = (): Promise<void> => {
    resetEnrollment(storage);
    win.location.reload();
    renderScreen(doc, root, 'ENROLL', state.getState().lang, {
      onEnroll: handleEnroll,
    });
    return Promise.resolve();
  };

  const appViewDeps: AppViewDeps = {
    onEnroll: handleEnroll,
    onReenroll: handleReenroll,
    verifyMaintenancePin: options?.verifyMaintenancePin,
    confirmFn: options?.confirmFn,
    appVersion: options?.appVersion,
  };

  const view = createAppView({
    doc,
    root,
    state,
    deps: appViewDeps,
  });

  const setTimeoutFn =
    options?.setTimeout ??
    ((callback: () => void, delayMs: number): unknown => {
      return win.setTimeout(callback, delayMs);
    });

  const clearTimeoutFn =
    options?.clearTimeout ??
    ((handle: unknown): void => {
      if (typeof handle === 'number') {
        win.clearTimeout(handle);
      }
    });

  const wiring = wireInteractions({
    doc,
    state,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
  });

  const dispose = (): void => {
    wiring.dispose();
    view.dispose();
  };

  return {
    state,
    view,
    wiring,
    resetEnrollment: handleReenroll,
    dispose,
  };
}
