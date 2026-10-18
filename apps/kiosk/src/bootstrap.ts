import { resources } from '@xplor/i18n';
import {
  TourGraphSchema,
  type KioskManifest,
  type Lang,
  type TourGraph,
} from '@xplor/shared';
import {
  fetchTourGraph,
  mountViewer as coreMountViewer,
} from '@xplor/viewer-core';

import { resolveApiUrl } from './api-url.js';
import { createAppState, type AppState, type AppStore } from './app-state.js';
import {
  createAppView,
  type AppView,
  type AppViewDeps,
  type RenderTourCallback,
  type RenderTourHandle,
} from './app-view.js';
import {
  createKioskLoopsApi,
  startKioskLoops,
  type ClearIntervalFn,
  type KioskLoopsControl,
  type SetIntervalFn,
} from './boot-loop.js';
import {
  loadCredentials,
  type KioskCredentials,
  type Storage,
} from './credentials.js';
import { enrollKiosk, resetEnrollment } from './enroll-flow.js';
import {
  buildHeartbeat,
  type StorageEstimateProvider,
} from './heartbeat.js';
import {
  wireInteractions,
  type InteractionWiring,
} from './interaction-wiring.js';
import {
  installKioskLockdown,
  type KioskLockdownInstance,
} from './kiosk-lockdown.js';
import {
  createApiPinVerifier,
  type MaintenancePinVerifier,
} from './maintenance-pin.js';
import { applyDocumentLanguage, resolveLang } from './mount.js';
import { registerServiceWorker } from './register-sw.js';
import type { ConfirmFn } from './render-maintenance-status.js';
import { renderScreen } from './render-screen.js';
import {
  renderTour,
  type LoadTourFn,
  type MountViewerFn,
  type ViewerInstance,
} from './render-tour.js';
import {
  createTourCache,
  getTourCacheName,
  type CacheEntryLike,
  type CacheStorageLike,
  type TourCache,
  type UrlsForTour,
} from './tour-cache.js';
import { createTourCacheIndex } from './tour-cache-index.js';

export interface BootstrapKioskOptions {
  apiUrl?: string;
  lang?: Lang;
  manifest?: KioskManifest | null;
  storage?: Storage;
  fetchFn?: typeof fetch;
  cacheStorage?: CacheStorageLike;
  urlsForTour?: UrlsForTour;
  setInterval?: SetIntervalFn;
  clearInterval?: ClearIntervalFn;
  setTimeout?: (callback: () => void, delayMs: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  storageEstimateProvider?: StorageEstimateProvider;
  appVersion?: string;
  root?: HTMLElement;
  renderTour?: RenderTourCallback;
  mountViewer?: MountViewerFn;
  loadTour?: LoadTourFn;
  getAttractTourUrl?: (state: AppState) => string | null;
  verifyMaintenancePin?: MaintenancePinVerifier;
  confirmFn?: ConfirmFn;
  navigator?: unknown;
  registerServiceWorker?: (nav: unknown) => Promise<unknown>;
}

interface ResponseWithJson {
  json(): Promise<unknown>;
  clone?: () => unknown;
}

function isResponseWithJson(value: unknown): value is ResponseWithJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'json' in value && typeof value.json === 'function';
}

async function extractTourGraphFromResponse(
  response: unknown,
): Promise<TourGraph | null> {
  if (isResponseWithJson(response)) {
    try {
      const candidate =
        typeof response.clone === 'function' ? response.clone() : response;
      const target = isResponseWithJson(candidate) ? candidate : response;
      const data = await target.json();
      const parsed = TourGraphSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      // Ignorer l'erreur et tenter le parsing direct
    }
  }

  const directParsed = TourGraphSchema.safeParse(response);
  if (directParsed.success) {
    return directParsed.data;
  }

  return null;
}

export interface KioskBootstrapInstance {
  readonly state: AppStore;
  readonly view: AppView;
  readonly wiring: InteractionWiring;
  readonly tourCache: TourCache;
  readonly lockdown: KioskLockdownInstance;
  getLoops: () => KioskLoopsControl | null;
  syncNow: () => Promise<void>;
  resetEnrollment: () => Promise<void>;
  dispose: () => void;
}

function resolveKioskApiUrl(customUrl?: string): string {
  if (typeof customUrl === 'string' && customUrl.trim().length > 0) {
    return resolveApiUrl({ VITE_API_URL: customUrl });
  }
  return resolveApiUrl(import.meta.env);
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

function wrapCacheStorage(nativeCaches: CacheStorage): CacheStorageLike {
  return {
    async open(name: string): Promise<CacheEntryLike> {
      const cache = await nativeCaches.open(name);
      return {
        async put(url: string, response: unknown): Promise<void> {
          if (typeof Response !== 'undefined' && response instanceof Response) {
            await cache.put(url, response);
          }
        },
        async delete(url: string): Promise<boolean> {
          return cache.delete(url);
        },
        async keys(): Promise<string[]> {
          const requests = await cache.keys();
          return requests.map((req) => req.url);
        },
        async match(url: string): Promise<unknown> {
          return cache.match(url);
        },
      };
    },
    async delete(name: string): Promise<boolean> {
      return nativeCaches.delete(name);
    },
  };
}

function resolveCacheStorage(
  win: Window,
  custom?: CacheStorageLike,
): CacheStorageLike {
  if (custom !== undefined) {
    return custom;
  }
  if ('caches' in win && typeof win.caches === 'object') {
    return wrapCacheStorage(win.caches);
  }
  return {
    open(): Promise<CacheEntryLike> {
      return Promise.resolve({
        put(): Promise<void> {
          return Promise.resolve();
        },
        delete(): Promise<boolean> {
          return Promise.resolve(false);
        },
        keys(): Promise<string[]> {
          return Promise.resolve([]);
        },
        match(): Promise<unknown> {
          return Promise.resolve(undefined);
        },
      });
    },
    delete(): Promise<boolean> {
      return Promise.resolve(false);
    },
  };
}

function resolveFetchFn(win: Window, custom?: typeof fetch): typeof fetch {
  if (typeof custom === 'function') {
    return custom;
  }
  if ('fetch' in win && typeof win.fetch === 'function') {
    return win.fetch.bind(win);
  }
  return globalThis.fetch;
}

/**
 * Assemblage et démarrage de l'application kiosque Xplor (F-60 / F-62 / F-65 / F-67).
 *
 * 1. Initialise le stockage local et charge les identifiants éventuels (loadCredentials).
 * 2. Si loadCredentials renvoie null, l'écran initial est ENROLL.
 * 3. Initialise le store d'état applicatif (createAppState).
 * 4. Crée le cache hors-ligne des visites (createTourCache).
 * 5. Câble les interactions globales et la détection d'inactivité (wireInteractions).
 * 6. Instancie la vue orchestratrice (createAppView).
 * 7. Si le kiosque est déjà enrôlé, démarre les boucles d'arrière-plan (startKioskLoops).
 * 8. En cas d'enrôlement (onEnroll), dispatche ENROLLED puis démarre les boucles d'arrière-plan.
 * 9. Le bouton « Forcer la synchro » appelle syncNow.
 * 10. « Réenrôler » arrête les boucles si possible, appelle resetEnrollment puis recharge l'écran ENROLL.
 */
export function bootstrapKiosk(
  win: Window,
  doc: Document,
  options?: BootstrapKioskOptions,
): KioskBootstrapInstance {
  const storage: Storage = options?.storage ?? win.localStorage;
  const apiUrl = resolveKioskApiUrl(options?.apiUrl);
  const fetchFn = resolveFetchFn(win, options?.fetchFn);
  const cacheStorage = resolveCacheStorage(win, options?.cacheStorage);

  const initialCredentials: KioskCredentials | null = loadCredentials(storage);
  const enrolled = initialCredentials !== null;

  const search = win.location.search;
  const initialLang: Lang = options?.lang ?? resolveLang(search);

  applyDocumentLanguage(doc, initialLang);

  const root = resolveRoot(doc, options?.root);

  const state = createAppState({
    lang: initialLang,
    enrolled,
    manifest: options?.manifest ?? null,
  });

  const tourCacheIndex = createTourCacheIndex(storage);
  const defaultUrlsForTour: UrlsForTour = (tourId: string): string[] => {
    const manifest = state.getState().manifest;
    if (manifest !== null) {
      for (const tour of manifest.selection.tours) {
        if (tour.id === tourId && typeof tour.url === 'string' && tour.url.length > 0) {
          return [tour.url];
        }
      }
    }
    return [];
  };
  const urlsForTour = options?.urlsForTour ?? defaultUrlsForTour;

  const tourCache = createTourCache({
    index: tourCacheIndex,
    cacheStorage,
    fetchFn,
    urlsForTour,
  });

  const loopsApi = createKioskLoopsApi({
    fetchFn,
    baseUrl: apiUrl,
  });

  const setIntervalFn: SetIntervalFn =
    options?.setInterval ??
    ((callback: () => void, delayMs: number): unknown => {
      return win.setInterval(callback, delayMs);
    });

  const clearIntervalFn: ClearIntervalFn =
    options?.clearInterval ??
    ((handle: unknown): void => {
      if (typeof handle === 'number') {
        win.clearInterval(handle);
      }
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

  let loopsControl: KioskLoopsControl | null = null;

  function startLoops(): KioskLoopsControl {
    if (loopsControl !== null) {
      return loopsControl;
    }
    loopsControl = startKioskLoops({
      api: loopsApi,
      credentials: () => loadCredentials(storage),
      state,
      sync: { cache: tourCache },
      buildHeartbeat,
      setInterval: setIntervalFn,
      clearInterval: clearIntervalFn,
      storage: options?.storageEstimateProvider,
      appVersion: options?.appVersion,
    });
    return loopsControl;
  }

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
    startLoops();
  };

  const handleForceSync = async (): Promise<void> => {
    if (loopsControl !== null) {
      await loopsControl.syncNow();
    }
  };

  let currentTourHandle: RenderTourHandle | null = null;

  const handleReenroll = (): Promise<void> => {
    if (currentTourHandle !== null) {
      currentTourHandle.destroy();
      currentTourHandle = null;
    }
    if (loopsControl !== null) {
      loopsControl.stop();
      loopsControl = null;
    }
    resetEnrollment(storage);
    if (typeof win.location.reload === 'function') {
      win.location.reload();
    }
    renderScreen(doc, root, 'ENROLL', state.getState().lang, {
      onEnroll: handleEnroll,
    });
    return Promise.resolve();
  };

  const verifyMaintenancePin: MaintenancePinVerifier = async (
    pin: string,
  ): Promise<boolean> => {
    if (options?.verifyMaintenancePin !== undefined) {
      return options.verifyMaintenancePin(pin);
    }
    const currentCreds = loadCredentials(storage);
    if (currentCreds === null) {
      return false;
    }
    const verifier = createApiPinVerifier({
      fetchFn,
      baseUrl: apiUrl,
      token: currentCreds.token,
    });
    return verifier(pin);
  };

  const defaultMountViewer: MountViewerFn =
    options?.mountViewer ??
    ((container: HTMLElement, graph: TourGraph): ViewerInstance => {
      if (typeof ShadowRoot === 'undefined') {
        return { destroy(): void {} };
      }
      try {
        return coreMountViewer(container, graph);
      } catch {
        return { destroy(): void {} };
      }
    });

  const defaultLoadTour: LoadTourFn =
    options?.loadTour ??
    (async (tourId: string): Promise<TourGraph> => {
      const currentLang = state.getState().lang;
      const tourClientBaseUrl = apiUrl.endsWith('/api/v1')
        ? apiUrl
        : `${apiUrl}/api/v1`;

      try {
        return await fetchTourGraph(
          tourClientBaseUrl,
          tourId,
          currentLang,
          fetchFn,
        );
      } catch (error: unknown) {
        // Repli sur le cache
        try {
          const cacheName = getTourCacheName(tourId);
          const cache = await cacheStorage.open(cacheName);
          const urls = await urlsForTour(tourId);

          if (typeof cache.match === 'function') {
            for (const url of urls) {
              const matched = await cache.match(url);
              if (matched !== undefined) {
                const graph = await extractTourGraphFromResponse(matched);
                if (graph !== null) {
                  return graph;
                }
              }
            }

            const keys = await cache.keys();
            for (const key of keys) {
              const matched = await cache.match(key);
              if (matched !== undefined) {
                const graph = await extractTourGraphFromResponse(matched);
                if (graph !== null) {
                  return graph;
                }
              }
            }
          }
        } catch {
          // Si la lecture du cache échoue, on propage l'erreur d'origine
        }

        throw error;
      }
    });

  const actualRenderTour: RenderTourCallback = (
    tourRoot: HTMLElement,
    tourId: string,
    onBack?: () => void,
  ): RenderTourHandle | undefined => {
    if (currentTourHandle !== null) {
      currentTourHandle.destroy();
      currentTourHandle = null;
    }

    const handle =
      options?.renderTour !== undefined
        ? options.renderTour(tourRoot, tourId, onBack)
        : renderTour(doc, tourRoot, {
            tourId,
            lang: state.getState().lang,
            onClose: (): void => {
              if (onBack !== undefined) {
                onBack();
              }
            },
            loadTour: defaultLoadTour,
            mountViewer: defaultMountViewer,
          });

    currentTourHandle = handle ?? null;
    return handle;
  };

  const appViewDeps: AppViewDeps = {
    onEnroll: handleEnroll,
    onForceSync: handleForceSync,
    onReenroll: handleReenroll,
    verifyMaintenancePin,
    renderTour: actualRenderTour,
    getAttractTourUrl: options?.getAttractTourUrl,
    confirmFn: options?.confirmFn,
    appVersion: options?.appVersion,
  };

  const view = createAppView({
    doc,
    root,
    state,
    deps: appViewDeps,
  });

  let previousScreen = state.getState().screen;
  const unsubscribeTour = state.subscribe((nextState) => {
    if (previousScreen === 'TOUR' && nextState.screen !== 'TOUR') {
      if (currentTourHandle !== null) {
        currentTourHandle.destroy();
        currentTourHandle = null;
      }
    }
    previousScreen = nextState.screen;
  });

  const wiring = wireInteractions({
    doc,
    state,
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
  });

  const lockdown = installKioskLockdown(doc);

  const nav: unknown = options?.navigator ?? win.navigator;
  if (typeof nav === 'object' && nav !== null && 'serviceWorker' in nav) {
    const registerFn = options?.registerServiceWorker ?? registerServiceWorker;
    void registerFn(nav);
  }

  if (enrolled) {
    startLoops();
  }

  const dispose = (): void => {
    unsubscribeTour();
    if (currentTourHandle !== null) {
      currentTourHandle.destroy();
      currentTourHandle = null;
    }
    if (loopsControl !== null) {
      loopsControl.stop();
      loopsControl = null;
    }
    lockdown.dispose();
    wiring.dispose();
    view.dispose();
  };

  return {
    state,
    view,
    wiring,
    tourCache,
    lockdown,
    getLoops: () => loopsControl,
    syncNow: handleForceSync,
    resetEnrollment: handleReenroll,
    dispose,
  };
}
