import type {
  KioskHeartbeatRequest,
  KioskHeartbeatResponse,
  KioskManifest,
} from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KioskApiError } from './api/kiosk-api.js';
import { createAppState } from './app-state.js';
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_MANIFEST_SYNC_INTERVAL_MS,
  startKioskLoops,
  createKioskLoopsApi,
  type KioskLoopsApi,
} from './boot-loop.js';
import { buildHeartbeat } from './heartbeat.js';

class FakeIntervalTimers {
  time = 0;
  nextId = 0;
  readonly intervals = new Map<
    number,
    { intervalMs: number; at: number; callback: () => void }
  >();
  readonly clearedHandles: number[] = [];

  readonly now = (): number => this.time;

  readonly setInterval = (callback: () => void, intervalMs: number): number => {
    const id = this.nextId;
    this.nextId += 1;
    this.intervals.set(id, {
      intervalMs,
      at: this.time + intervalMs,
      callback,
    });
    return id;
  };

  readonly clearInterval = (handle: unknown): void => {
    if (typeof handle === 'number') {
      this.clearedHandles.push(handle);
      this.intervals.delete(handle);
    }
  };

  async advanceBy(milliseconds: number): Promise<void> {
    const target = this.time + milliseconds;
    for (;;) {
      const candidates = [...this.intervals.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at);
      const next = candidates[0];
      if (next === undefined) {
        break;
      }

      const [id, timer] = next;
      this.time = timer.at;
      timer.callback();
      await flushMicrotasks();
      if (this.intervals.has(id)) {
        timer.at += timer.intervalMs;
      }
    }
    this.time = target;
    await flushMicrotasks();
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

const mockManifest: KioskManifest = {
  manifestVersion: 'v1.0.0',
  hotel: {
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Hôtel La Tour Hassan Palace',
    logoUrl: 'https://media.xplor.ma/hotels/tour-hassan.png',
    brandColor: '#6958A5',
    languages: ['fr'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  kiosk: {
    id: '01990000-0000-7000-8000-000000000002',
    label: 'Kiosque Réception',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_SCREEN',
  },
  selection: {
    featuredTourId: null,
    attractTourIds: [],
    tours: [
      {
        id: '01990000-0000-7000-8000-000000000003',
        contentVersion: 1,
        sizeBytes: 1024,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000003',
      },
    ],
  },
  categories: [],
};

const mockCredentials = {
  kioskId: '01990000-0000-7000-8000-000000000002',
  token: 'kiosk-secret-token-123',
};

const mockHeartbeatResponse: KioskHeartbeatResponse = {
  forceSync: false,
  serverTime: '2026-10-18T07:00:00.000Z',
};

describe('startKioskLoops (M5 F-60 / F-65)', () => {
  let timers: FakeIntervalTimers;
  let fetchManifestMock: ReturnType<
    typeof vi.fn<(token: string) => Promise<KioskManifest>>
  >;
  let sendHeartbeatMock: ReturnType<
    typeof vi.fn<(token: string, body: KioskHeartbeatRequest) => Promise<unknown>>
  >;
  let api: KioskLoopsApi;
  let syncMock: ReturnType<typeof vi.fn>;
  let buildHeartbeatMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    timers = new FakeIntervalTimers();
    fetchManifestMock = vi
      .fn<(token: string) => Promise<KioskManifest>>()
      .mockResolvedValue(mockManifest);
    sendHeartbeatMock = vi
      .fn<(token: string, body: KioskHeartbeatRequest) => Promise<unknown>>()
      .mockResolvedValue(mockHeartbeatResponse);
    api = {
      fetchManifest: (token: string): Promise<KioskManifest> =>
        fetchManifestMock(token),
      sendHeartbeat: (
        token: string,
        body: KioskHeartbeatRequest,
      ): Promise<unknown> => sendHeartbeatMock(token, body),
    };
    syncMock = vi.fn().mockResolvedValue({
      downloaded: ['01990000-0000-7000-8000-000000000003'],
      removed: [],
      failed: [],
    });
    buildHeartbeatMock = vi.fn().mockImplementation(buildHeartbeat);
  });

  describe('démarrage', () => {
    it('lit le manifeste, dispatche MANIFEST_LOADED et appelle sync au démarrage', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;

      // 1. Appel API pour lire le manifeste avec le jeton
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);
      expect(fetchManifestMock).toHaveBeenCalledWith(mockCredentials.token);

      // 2. Le store a reçu l'action MANIFEST_LOADED et mis à jour son état
      expect(state.getState().manifest).toEqual(mockManifest);
      expect(state.getState().screen).toBe('HOME');

      // 3. Appel de la synchronisation hors-ligne
      expect(syncMock).toHaveBeenCalledTimes(1);
      expect(syncMock).toHaveBeenCalledWith(mockManifest);

      // 4. Les minuteurs périodiques de 15 min et 5 min sont enregistrés
      expect(timers.intervals.size).toBe(2);
      const intervals = [...timers.intervals.values()].map((t) => t.intervalMs);
      expect(intervals).toContain(DEFAULT_MANIFEST_SYNC_INTERVAL_MS);
      expect(intervals).toContain(DEFAULT_HEARTBEAT_INTERVAL_MS);

      // 5. Au démarrage, le heartbeat n'a pas encore été envoyé (attente de 5 min)
      expect(sendHeartbeatMock).not.toHaveBeenCalled();
      expect(buildHeartbeatMock).not.toHaveBeenCalled();

      loops.stop();
    });

    it('gère une fonction de récupération dynamique des identifiants', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: () => mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(fetchManifestMock).toHaveBeenCalledWith(mockCredentials.token);
      loops.stop();
    });

    it('ignore la synchronisation si les identifiants retournent null', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: () => null,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(fetchManifestMock).not.toHaveBeenCalled();
      expect(syncMock).not.toHaveBeenCalled();
      loops.stop();
    });
  });

  describe('tick de 15 min', () => {
    it('lit à nouveau le manifeste et appelle sync toutes les 15 minutes', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);
      expect(syncMock).toHaveBeenCalledTimes(1);

      // Avancement de 14 minutes : pas de nouveau déclenchement de manifeste
      await timers.advanceBy(14 * 60 * 1000);
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);
      expect(syncMock).toHaveBeenCalledTimes(1);

      // Avancement d'1 minute supplémentaire (total 15 min) : tick manifeste !
      await timers.advanceBy(1 * 60 * 1000);
      expect(fetchManifestMock).toHaveBeenCalledTimes(2);
      expect(syncMock).toHaveBeenCalledTimes(2);

      // 15 minutes supplémentaires (total 30 min) : 3e tick
      await timers.advanceBy(15 * 60 * 1000);
      expect(fetchManifestMock).toHaveBeenCalledTimes(3);
      expect(syncMock).toHaveBeenCalledTimes(3);

      loops.stop();
    });

    it('prend en charge un objet sync exposant runSync', async () => {
      const state = createAppState({ manifest: null, enrolled: true });
      const runnerMock = vi.fn().mockResolvedValue({
        downloaded: [],
        removed: [],
        failed: [],
      });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: { runSync: runnerMock },
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(runnerMock).toHaveBeenCalledWith({ manifest: mockManifest });
      loops.stop();
    });
  });

  describe('tick de 5 min', () => {
    it('envoie le heartbeat toutes les 5 minutes avec la version de manifeste synchronisée', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        appVersion: '2.1.0',
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(sendHeartbeatMock).not.toHaveBeenCalled();

      // Avancement de 5 minutes : déclenchement du heartbeat
      await timers.advanceBy(5 * 60 * 1000);

      expect(buildHeartbeatMock).toHaveBeenCalledTimes(1);
      expect(buildHeartbeatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          appVersion: '2.1.0',
          syncedManifestVersion: 'v1.0.0',
          recentErrors: [],
        }),
      );

      expect(sendHeartbeatMock).toHaveBeenCalledTimes(1);
      expect(sendHeartbeatMock).toHaveBeenCalledWith(
        mockCredentials.token,
        expect.objectContaining({
          appVersion: '2.1.0',
          syncedManifestVersion: 'v1.0.0',
          recentErrors: [],
        }),
      );

      // 5 minutes supplémentaires (total 10 min) : 2e heartbeat
      await timers.advanceBy(5 * 60 * 1000);
      expect(sendHeartbeatMock).toHaveBeenCalledTimes(2);

      // 5 minutes supplémentaires (total 15 min) : 3e heartbeat
      await timers.advanceBy(5 * 60 * 1000);
      expect(sendHeartbeatMock).toHaveBeenCalledTimes(3);

      loops.stop();
    });

    it('déclenche syncNow si le serveur répond forceSync: true dans le heartbeat', async () => {
      sendHeartbeatMock.mockResolvedValue({
        forceSync: true,
        serverTime: '2026-10-18T07:05:00.000Z',
      });

      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);

      // Tick de 5 min : le heartbeat renvoie forceSync: true
      await timers.advanceBy(5 * 60 * 1000);

      // syncNow a été déclenché par la réponse forceSync
      expect(fetchManifestMock).toHaveBeenCalledTimes(2);
      expect(syncMock).toHaveBeenCalledTimes(2);

      loops.stop();
    });
  });

  describe('KIOSK_DISABLED', () => {
    it('dispatche DISABLED quand fetchManifest renvoie KIOSK_DISABLED', async () => {
      const disabledError = new KioskApiError(
        'KIOSK_DISABLED',
        'Kiosque désactivé par l’administrateur',
        403,
      );
      fetchManifestMock.mockRejectedValue(disabledError);

      const state = createAppState({ manifest: mockManifest, enrolled: true, disabled: false });
      const dispatchSpy = vi.spyOn(state, 'dispatch');

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;

      // 1. Dispatch DISABLED
      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'DISABLED' });
      expect(state.getState().disabled).toBe(true);
      expect(state.getState().screen).toBe('UNAVAILABLE');

      // 2. sync n'est pas appelé
      expect(syncMock).not.toHaveBeenCalled();

      loops.stop();
    });

    it('dispatche DISABLED quand sendHeartbeat renvoie KIOSK_DISABLED au tick de 5 min', async () => {
      const disabledError = new KioskApiError(
        'KIOSK_DISABLED',
        'Contrat résilié',
        403,
      );
      sendHeartbeatMock.mockRejectedValue(disabledError);

      const state = createAppState({ manifest: null, enrolled: true, disabled: false });
      const dispatchSpy = vi.spyOn(state, 'dispatch');

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'MANIFEST_LOADED',
        manifest: mockManifest,
      });

      // Tick de 5 min : sendHeartbeat échoue en 403 KIOSK_DISABLED
      await timers.advanceBy(5 * 60 * 1000);

      expect(dispatchSpy).toHaveBeenCalledWith({ type: 'DISABLED' });
      expect(state.getState().disabled).toBe(true);
      expect(state.getState().screen).toBe('UNAVAILABLE');

      loops.stop();
    });
  });

  describe('réseau coupé', () => {
    it('ignore l’erreur réseau, conserve le manifeste en cache et note l’erreur pour le prochain heartbeat', async () => {
      const networkError = new KioskApiError(
        'NETWORK',
        'Impossible de joindre le serveur kiosque.',
      );
      fetchManifestMock.mockRejectedValue(networkError);

      const state = createAppState({
        manifest: mockManifest,
        enrolled: true,
        disabled: false,
      });
      const dispatchSpy = vi.spyOn(state, 'dispatch');

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      // L'erreur réseau ne propage aucune exception non gérée
      await expect(loops.ready).resolves.toBeUndefined();

      // Le manifeste en cache dans state reste inchangé et utilisé
      expect(state.getState().manifest).toEqual(mockManifest);
      expect(state.getState().screen).toBe('HOME');
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(syncMock).not.toHaveBeenCalled();

      // Tick de 5 min : envoi du heartbeat qui doit inclure l'erreur notée
      await timers.advanceBy(5 * 60 * 1000);

      expect(buildHeartbeatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          recentErrors: ['Impossible de joindre le serveur kiosque.'],
        }),
      );
      expect(sendHeartbeatMock).toHaveBeenCalledWith(
        mockCredentials.token,
        expect.objectContaining({
          recentErrors: ['Impossible de joindre le serveur kiosque.'],
        }),
      );

      // Tick de 5 min suivant : l'erreur ayant été envoyée, elle est purgée
      await timers.advanceBy(5 * 60 * 1000);
      expect(buildHeartbeatMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          recentErrors: [],
        }),
      );

      loops.stop();
    });

    it('note les erreurs de téléchargement lors de la synchronisation', async () => {
      syncMock.mockRejectedValueOnce(new Error('Échec téléchargement panorama'));

      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;

      // Le manifeste a bien été chargé
      expect(state.getState().manifest).toEqual(mockManifest);

      // Tick de 5 min : l'erreur de sync est transmise dans le heartbeat
      await timers.advanceBy(5 * 60 * 1000);

      expect(buildHeartbeatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          recentErrors: ['Échec téléchargement panorama'],
        }),
      );

      loops.stop();
    });
  });

  describe('stop', () => {
    it('arrête les deux minuteurs et stoppe les appels récurrents', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(timers.clearedHandles).toHaveLength(0);

      // Arrêt des boucles
      loops.stop();

      // Les handles des 2 intervalles sont effacés
      expect(timers.clearedHandles).toHaveLength(2);
      expect(timers.intervals.size).toBe(0);

      // Avancement du temps de 30 minutes
      await timers.advanceBy(30 * 60 * 1000);

      // Aucun appel supplémentaire n'a eu lieu
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);
      expect(syncMock).toHaveBeenCalledTimes(1);
      expect(sendHeartbeatMock).not.toHaveBeenCalled();

      // Appel syncNow après stop() n'effectue rien
      await loops.syncNow();
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);
    });

    it('est idempotent si appelé plusieurs fois', () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      loops.stop();
      loops.stop();
      expect(timers.clearedHandles).toHaveLength(2);
    });
  });

  describe('syncNow (Forcer la synchro)', () => {
    it('déclenche une synchronisation immédiate sur demande', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;
      expect(fetchManifestMock).toHaveBeenCalledTimes(1);

      // Forcer la synchronisation manuellement
      await loops.syncNow();
      expect(fetchManifestMock).toHaveBeenCalledTimes(2);
      expect(syncMock).toHaveBeenCalledTimes(2);

      loops.stop();
    });

    it('mutualise les appels simultanés vers une même promesse', async () => {
      const state = createAppState({ manifest: null, enrolled: true });

      const loops = startKioskLoops({
        api,
        credentials: mockCredentials,
        state,
        sync: syncMock,
        buildHeartbeat: buildHeartbeatMock,
        setInterval: timers.setInterval,
        clearInterval: timers.clearInterval,
      });

      await loops.ready;

      // Deux appels simultanés
      const p1 = loops.syncNow();
      const p2 = loops.syncNow();
      await Promise.all([p1, p2]);

      // fetchManifest n'a été appelé qu'une seule fois de plus (total 2)
      expect(fetchManifestMock).toHaveBeenCalledTimes(2);

      loops.stop();
    });
  });

  describe('createKioskLoopsApi', () => {
    it('adapte les fonctions de kiosk-api avec baseUrl et fetchFn', async () => {
      const fetchFn = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/kiosk/manifest')) {
          return Promise.resolve(new Response(JSON.stringify(mockManifest), { status: 200 }));
        }
        if (url.includes('/api/v1/kiosk/heartbeat')) {
          return Promise.resolve(new Response(JSON.stringify(mockHeartbeatResponse), { status: 200 }));
        }
        return Promise.reject(new Error(`Unhandled: ${url}`));
      });

      const adapterApi = createKioskLoopsApi({
        baseUrl: 'https://api.xplor.ma',
        fetchFn,
      });

      const manifest = await adapterApi.fetchManifest('token-test');
      expect(manifest.manifestVersion).toBe('v1.0.0');

      const heartbeatBody: KioskHeartbeatRequest = {
        appVersion: '1.0.0',
        syncedManifestVersion: 'v1.0.0',
        storageFreeMb: 100,
        recentErrors: [],
      };
      const heartbeatRes = await adapterApi.sendHeartbeat('token-test', heartbeatBody);
      expect(heartbeatRes).toEqual(mockHeartbeatResponse);
    });
  });
});
