import type {
  KioskHeartbeatRequest,
  KioskManifest,
} from '@xplor/shared';

import {
  fetchManifest,
  sendHeartbeat,
  KioskApiError,
} from './api/kiosk-api.js';
import type { AppAction, AppState } from './app-state.js';
import type { KioskCredentials } from './credentials.js';
import type {
  BuildHeartbeatInput,
  StorageEstimateProvider,
} from './heartbeat.js';
import {
  runSync,
  type SyncCache,
} from './sync-runner.js';

export const DEFAULT_MANIFEST_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_STORED_ERRORS = 50;

export interface KioskLoopsApi {
  fetchManifest: (token: string) => Promise<KioskManifest>;
  sendHeartbeat: (
    token: string,
    body: KioskHeartbeatRequest,
  ) => Promise<unknown>;
}

export type CredentialsProvider =
  | KioskCredentials
  | (() => KioskCredentials | null);

export interface KioskLoopsState {
  dispatch(action: AppAction): void;
  getState?(): AppState;
}

export type KioskLoopsSyncFn = (
  manifest: KioskManifest,
) => Promise<unknown>;

export interface KioskLoopsSyncObject {
  runSync?(
    deps: { manifest: KioskManifest; cache?: SyncCache } | KioskManifest,
  ): Promise<unknown>;
  cache?: SyncCache;
}

export type KioskLoopsSync = KioskLoopsSyncFn | KioskLoopsSyncObject;

export type BuildHeartbeatFn = (
  input: BuildHeartbeatInput,
) => Promise<KioskHeartbeatRequest> | KioskHeartbeatRequest;

export type SetIntervalFn = (callback: () => void, delayMs: number) => unknown;

export type ClearIntervalFn = (handle: unknown) => void;

export interface StartKioskLoopsOptions {
  api: KioskLoopsApi;
  credentials: CredentialsProvider;
  state: KioskLoopsState;
  sync: KioskLoopsSync;
  buildHeartbeat: BuildHeartbeatFn;
  setInterval?: SetIntervalFn;
  clearInterval?: ClearIntervalFn;
  appVersion?: string;
  storage?: StorageEstimateProvider;
  manifestIntervalMs?: number;
  heartbeatIntervalMs?: number;
}

export interface KioskLoopsControl {
  stop(): void;
  syncNow(): Promise<void>;
  ready?: Promise<void>;
}

export function createKioskLoopsApi(options: {
  fetchFn?: typeof fetch;
  baseUrl: string;
}): KioskLoopsApi {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const baseUrl = options.baseUrl;
  return {
    fetchManifest: (token: string) => fetchManifest(fetchFn, baseUrl, token),
    sendHeartbeat: (token: string, body: KioskHeartbeatRequest) =>
      sendHeartbeat(fetchFn, baseUrl, token, body),
  };
}

function resolveToken(credentials: CredentialsProvider): string | null {
  if (typeof credentials === 'function') {
    const creds = credentials();
    return creds !== null && typeof creds.token === 'string' && creds.token.length > 0
      ? creds.token
      : null;
  }
  return typeof credentials.token === 'string' && credentials.token.length > 0
    ? credentials.token
    : null;
}

function isKioskDisabledError(error: unknown): boolean {
  if (error instanceof KioskApiError) {
    return error.code === 'KIOSK_DISABLED';
  }
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && error.code === 'KIOSK_DISABLED') {
      return true;
    }
    if ('status' in error && error.status === 403) {
      return true;
    }
  }
  return false;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'Unknown error';
}

async function executeSync(
  sync: KioskLoopsSync,
  manifest: KioskManifest,
): Promise<unknown> {
  if (typeof sync === 'function') {
    return sync(manifest);
  }
  if ('cache' in sync && sync.cache !== undefined) {
    if ('runSync' in sync && typeof sync.runSync === 'function') {
      return sync.runSync({ manifest, cache: sync.cache });
    }
    return runSync({ manifest, cache: sync.cache });
  }
  if ('runSync' in sync && typeof sync.runSync === 'function') {
    return sync.runSync({ manifest });
  }
  return undefined;
}

/**
 * Démarre les boucles d'arrière-plan du kiosque (M5 F-60 / F-65) :
 * - Au démarrage puis toutes les 15 minutes : lecture du manifeste (API-02),
 *   dispatch de `MANIFEST_LOADED` et appel de la synchronisation hors-ligne (`runSync`).
 * - Toutes les 5 minutes : envoi du heartbeat (API-03, `buildHeartbeat`).
 * - En cas d'erreur `KIOSK_DISABLED` (KioskApiError 403) : dispatch de `DISABLED`.
 * - En cas d'erreur réseau : le manifeste en cache reste utilisé et l'erreur
 *   est notée dans `recentErrors` pour le prochain heartbeat.
 * - Renvoie `{ stop, syncNow }` où `syncNow()` permet de forcer la synchronisation immédiatement.
 */
export function startKioskLoops(
  options: StartKioskLoopsOptions,
): KioskLoopsControl {
  const {
    api,
    credentials,
    state,
    sync,
    buildHeartbeat: buildHeartbeatFn,
    appVersion = '1.0.0',
    manifestIntervalMs = DEFAULT_MANIFEST_SYNC_INTERVAL_MS,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  } = options;

  const loopState = {
    stopped: false,
  };

  function isStopped(): boolean {
    return loopState.stopped;
  }

  let currentSyncPromise: Promise<void> | null = null;
  let currentHeartbeatPromise: Promise<void> | null = null;
  let syncedManifestVersion: string | null = null;
  let recentErrors: string[] = [];

  const setIntervalFn: SetIntervalFn =
    options.setInterval ??
    ((callback: () => void, delayMs: number): unknown => {
      return globalThis.setInterval(callback, delayMs);
    });

  const clearIntervalFn: ClearIntervalFn =
    options.clearInterval ??
    ((handle: unknown): void => {
      if (typeof handle === 'number') {
        globalThis.clearInterval(handle);
      }
    });

  function recordRecentError(error: unknown): void {
    const message = getErrorMessage(error);
    recentErrors.push(message);
    if (recentErrors.length > MAX_STORED_ERRORS) {
      recentErrors = recentErrors.slice(-MAX_STORED_ERRORS);
    }
  }

  function getSyncedManifestVersion(): string | null {
    if (syncedManifestVersion !== null) {
      return syncedManifestVersion;
    }
    if (typeof state.getState === 'function') {
      const currentState = state.getState();
      if (currentState.manifest !== null) {
        return currentState.manifest.manifestVersion;
      }
    }
    return null;
  }

  async function syncNow(): Promise<void> {
    if (isStopped()) {
      return;
    }
    if (currentSyncPromise !== null) {
      return currentSyncPromise;
    }

    currentSyncPromise = (async (): Promise<void> => {
      try {
        const token = resolveToken(credentials);
        if (token === null || isStopped()) {
          return;
        }

        let manifest: KioskManifest;
        try {
          manifest = await api.fetchManifest(token);
        } catch (fetchError) {
          if (isStopped()) {
            return;
          }
          if (isKioskDisabledError(fetchError)) {
            state.dispatch({ type: 'DISABLED' });
            return;
          }
          // Une erreur réseau est ignorée : le manifeste en cache reste utilisé et l'erreur est notée pour le prochain heartbeat.
          recordRecentError(fetchError);
          return;
        }

        if (isStopped()) {
          return;
        }

        state.dispatch({ type: 'MANIFEST_LOADED', manifest });
        syncedManifestVersion = manifest.manifestVersion;

        try {
          await executeSync(sync, manifest);
        } catch (syncError) {
          if (isStopped()) {
            return;
          }
          recordRecentError(syncError);
        }
      } finally {
        currentSyncPromise = null;
      }
    })();

    return currentSyncPromise;
  }

  async function sendHeartbeatNow(): Promise<void> {
    if (isStopped()) {
      return;
    }
    if (currentHeartbeatPromise !== null) {
      return currentHeartbeatPromise;
    }

    currentHeartbeatPromise = (async (): Promise<void> => {
      try {
        const token = resolveToken(credentials);
        if (token === null || isStopped()) {
          return;
        }

        const errorsToSend = [...recentErrors];
        try {
          const payload = await buildHeartbeatFn({
            appVersion,
            syncedManifestVersion: getSyncedManifestVersion(),
            storage: options.storage,
            recentErrors: errorsToSend,
          });

          if (isStopped()) {
            return;
          }

          const response = await api.sendHeartbeat(token, payload);

          if (isStopped()) {
            return;
          }

          recentErrors = recentErrors.slice(errorsToSend.length);

          if (
            typeof response === 'object' &&
            response !== null &&
            'forceSync' in response &&
            response.forceSync === true
          ) {
            void syncNow();
          }
        } catch (error) {
          if (isStopped()) {
            return;
          }
          if (isKioskDisabledError(error)) {
            state.dispatch({ type: 'DISABLED' });
            return;
          }
          recordRecentError(error);
        }
      } finally {
        currentHeartbeatPromise = null;
      }
    })();

    return currentHeartbeatPromise;
  }

  const manifestTimerHandle = setIntervalFn(() => {
    void syncNow();
  }, manifestIntervalMs);

  const heartbeatTimerHandle = setIntervalFn(() => {
    void sendHeartbeatNow();
  }, heartbeatIntervalMs);

  const initialSync = syncNow();

  function stop(): void {
    if (loopState.stopped) {
      return;
    }
    loopState.stopped = true;
    clearIntervalFn(manifestTimerHandle);
    clearIntervalFn(heartbeatTimerHandle);
  }

  return {
    stop,
    syncNow,
    ready: initialSync,
  };
}
