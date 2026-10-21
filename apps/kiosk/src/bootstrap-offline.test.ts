import {
  KioskManifestSchema,
  TourGraphSchema,
  type KioskManifest,
  type KioskManifestCategory,
  type KioskManifestTour,
  type TourGraph,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrapKiosk, type KioskBootstrapInstance } from './bootstrap.js';
import {
  loadCredentials,
  type KioskCredentials,
  type Storage,
} from './credentials.js';
import { loadManifest } from './manifest-cache.js';
import type { MountViewerFn, ViewerInstance } from './render-tour.js';
import type { CacheEntryLike, CacheStorageLike } from './tour-cache.js';

class FakeLocalStorage implements Storage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    const value = this.map.get(key);
    return typeof value === 'string' ? value : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.map.keys());
    const key = keys[index];
    return typeof key === 'string' ? key : null;
  }
}

class FakeCacheEntry implements CacheEntryLike {
  private readonly map = new Map<string, unknown>();

  put(url: string, response: unknown): Promise<void> {
    this.map.set(url, response);
    return Promise.resolve();
  }

  delete(url: string): Promise<boolean> {
    return Promise.resolve(this.map.delete(url));
  }

  keys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.map.keys()));
  }

  match(url: string): Promise<unknown> {
    return Promise.resolve(this.map.get(url));
  }
}

class FakeCacheStorage implements CacheStorageLike {
  public readonly caches = new Map<string, FakeCacheEntry>();

  open(name: string): Promise<FakeCacheEntry> {
    let cache = this.caches.get(name);
    if (cache === undefined) {
      cache = new FakeCacheEntry();
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }
}

const testCategory: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000010',
  name: { fr: 'Monuments', ar: 'معالم', en: 'Monuments' },
  icon: 'landmark',
  color: '#6958A5',
};

const testTour: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000100',
  contentVersion: 1,
  sizeBytes: 150000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000100',
  categoryId: testCategory.id,
};

const validManifest: KioskManifest = KioskManifestSchema.parse({
  manifestVersion: '1.0.0',
  kiosk: {
    id: '01990000-0000-7000-8000-000000000001',
    label: 'Kiosk Hall',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_SCREEN',
  },
  hotel: {
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Hôtel Rabat',
    logoUrl: null,
    brandColor: '#6958A5',
    languages: ['fr', 'ar', 'en'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: {
    featuredTourId: testTour.id,
    attractTourIds: [testTour.id],
    tours: [testTour],
  },
  categories: [testCategory],
});

const testCredentials: KioskCredentials = {
  kioskId: '01990000-0000-7000-8000-000000000001',
  token: 'valid-secret-token-1234',
};

const testTourGraph: TourGraph = TourGraphSchema.parse({
  id: testTour.id,
  contentVersion: testTour.contentVersion,
  lang: 'fr',
  title: 'Visite des Oudayas',
  summary: 'Une superbe visite pour tester la coupure réseau',
  city: 'Rabat',
  categories: ['Monuments'],
  coverUrl: 'https://media.test/tours/tour-1/cover.jpg',
  practicalInfo: 'Ouvert tous les jours.',
  location: { lat: 34.02, lng: -6.83 },
  startSceneId: 'scene-1',
  scenes: [
    {
      id: 'scene-1',
      title: 'Entrée principale',
      caption: 'La porte Bab',
      thumb: 'https://media.test/tours/tour-1/scenes/scene-1/thumb.jpg',
      narrationUrl: 'https://media.test/tours/tour-1/scenes/scene-1/narration.mp3',
      ambientUrl: 'https://media.test/tours/tour-1/scenes/scene-1/ambient.mp3',
      panorama: {
        preview: 'https://media.test/tours/tour-1/scenes/scene-1/preview.jpg',
        web: 'https://media.test/tours/tour-1/scenes/scene-1/web.jpg',
        tiles: {
          width: 8192,
          baseUrl:
            'https://media.test/tours/tour-1/scenes/scene-1/tiles/{col}_{row}.jpg',
          cols: 2,
          rows: 1,
        },
      },
      initialView: { yaw: 0.1, pitch: -0.05, zoom: 50 },
      hotspots: [],
    },
  ],
  linkedTours: [],
});

describe('M5 F-62 Démo 2 : fonctionnement kiosque avec réseau coupé (offline)', () => {
  let activeInstance: KioskBootstrapInstance | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    if (activeInstance !== null) {
      activeInstance.dispose();
      activeInstance = null;
    }
    vi.restoreAllMocks();
  });

  it('scénario complet bout en bout : enrôlement → synchronisation et mise en cache → coupure réseau → redémarrage sur manifeste en cache → visite montée depuis le cache sans appel réseau abouti', async () => {
    const testApiUrl = 'http://api.kiosk.test';
    const fakeStorage = new FakeLocalStorage();
    const fakeCacheStorage = new FakeCacheStorage();

    const destroyViewerSpy = vi.fn();
    const fakeViewer: ViewerInstance = {
      destroy: destroyViewerSpy,
    };
    const mountViewerMock: MountViewerFn = vi.fn(() => fakeViewer);

    let isNetworkOnline = true;
    const networkCallHistory: {
      url: string;
      online: boolean;
      succeeded: boolean;
    }[] = [];

    const fakeFetch: typeof fetch = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (!isNetworkOnline) {
          networkCallHistory.push({ url, online: false, succeeded: false });
          return Promise.reject(
            new TypeError(`Failed to fetch: network offline for ${url}`),
          );
        }

        networkCallHistory.push({ url, online: true, succeeded: true });

        if (url.includes('/api/v1/kiosk/enroll')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                kioskId: testCredentials.kioskId,
                token: testCredentials.token,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }

        if (url.includes('/api/v1/kiosk/manifest')) {
          return Promise.resolve(
            new Response(JSON.stringify(validManifest), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        if (url.includes(`/api/v1/public/tours/${testTour.id}`)) {
          return Promise.resolve(
            new Response(JSON.stringify(testTourGraph), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        if (url.includes(testTour.url)) {
          return Promise.resolve(
            new Response(JSON.stringify(testTourGraph), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        return Promise.resolve(
          new Response('asset-content', {
            status: 200,
            headers: { 'Content-Type': 'application/octet-stream' },
          }),
        );
      });

    // Étape 1 : Premier démarrage — Kiosque non enrôlé, écran ENROLL affiché
    activeInstance = bootstrapKiosk(window, document, {
      apiUrl: testApiUrl,
      storage: fakeStorage,
      cacheStorage: fakeCacheStorage,
      fetchFn: fakeFetch,
      mountViewer: mountViewerMock,
    });

    expect(activeInstance.state.getState().enrolled).toBe(false);
    expect(activeInstance.state.getState().screen).toBe('ENROLL');
    expect(loadCredentials(fakeStorage)).toBeNull();
    expect(loadManifest(fakeStorage)).toBeNull();

    // Étape 2 : Enrôlement via le formulaire
    const enrollInput = document.getElementById('kiosk-enroll-code');
    const enrollForm = document.querySelector('form');

    expect(enrollInput).toBeInstanceOf(HTMLInputElement);
    expect(enrollForm).toBeInstanceOf(HTMLFormElement);

    if (
      enrollInput instanceof HTMLInputElement &&
      enrollForm instanceof HTMLFormElement
    ) {
      enrollInput.value = 'ABCDEF12';
      enrollForm.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    }

    await vi.waitFor(() => {
      expect(loadCredentials(fakeStorage)).not.toBeNull();
    });

    const enrolledCreds = loadCredentials(fakeStorage);
    expect(enrolledCreds).not.toBeNull();
    if (enrolledCreds !== null) {
      expect(enrolledCreds.kioskId).toBe(testCredentials.kioskId);
      expect(enrolledCreds.token).toBe(testCredentials.token);
    }

    // Étape 3 : Manifeste synchronisé et visite téléchargée en cache
    const onlineLoops = activeInstance.getLoops();
    expect(onlineLoops).not.toBeNull();
    if (onlineLoops !== null && onlineLoops.ready !== undefined) {
      await onlineLoops.ready;
    }

    expect(activeInstance.state.getState().enrolled).toBe(true);
    expect(activeInstance.state.getState().manifest).toEqual(validManifest);
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(document.querySelector('.kiosk-home')).not.toBeNull();

    // Vérifie que le manifeste a bien été persisté dans le stockage
    const storedManifest = loadManifest(fakeStorage);
    expect(storedManifest).not.toBeNull();
    expect(storedManifest).toEqual(validManifest);

    // Vérifie que la visite a été téléchargée et validée dans le CacheStorage
    const prodCache = fakeCacheStorage.caches.get(`tour-${testTour.id}`);
    expect(prodCache).toBeDefined();
    if (prodCache !== undefined) {
      const cachedKeys = await prodCache.keys();
      expect(cachedKeys.length).toBeGreaterThan(0);
      expect(cachedKeys).toContain(testTour.url);
    }

    const successfulOnlineCalls = networkCallHistory.filter(
      (entry) => entry.online && entry.succeeded,
    );
    expect(successfulOnlineCalls.length).toBeGreaterThan(0);

    // Étape 4 : Le fetch factice passe en erreur réseau pour toutes les requêtes (coupure totale)
    isNetworkOnline = false;

    // Étape 5 : Redémarrage de bootstrapKiosk avec le même storage (et cacheStorage) sans option manifest
    activeInstance.dispose();
    activeInstance = null;

    const appRoot = document.getElementById('app');
    if (appRoot instanceof HTMLElement) {
      appRoot.replaceChildren();
    }

    activeInstance = bootstrapKiosk(window, document, {
      apiUrl: testApiUrl,
      storage: fakeStorage,
      cacheStorage: fakeCacheStorage,
      fetchFn: fakeFetch,
      mountViewer: mountViewerMock,
    });

    // L'écran HOME s'affiche immédiatement à partir du manifeste restauré depuis le stockage
    expect(activeInstance.state.getState().enrolled).toBe(true);
    expect(activeInstance.state.getState().manifest).toEqual(validManifest);
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(document.querySelector('.kiosk-home')).not.toBeNull();
    expect(document.querySelector('.kiosk-tour-view')).toBeNull();

    // La tentative de synchronisation réseau en arrière-plan échoue silencieusement
    const offlineLoops = activeInstance.getLoops();
    if (offlineLoops !== null && offlineLoops.ready !== undefined) {
      await offlineLoops.ready;
    }
    expect(activeInstance.state.getState().screen).toBe('HOME');

    // Étape 6 : L'ouverture de la visite monte la visionneuse factice avec les données du cache
    const featuredTourBtn = document.querySelector(
      'button[data-testid="featured-tour-button"]',
    );
    expect(featuredTourBtn).toBeInstanceOf(HTMLButtonElement);

    if (featuredTourBtn instanceof HTMLButtonElement) {
      featuredTourBtn.click();
    }

    expect(activeInstance.state.getState().screen).toBe('TOUR');
    expect(activeInstance.state.getState().tourId).toBe(testTour.id);

    const tourView = document.querySelector('.kiosk-tour-view');
    expect(tourView).not.toBeNull();

    const viewerContainer = document.querySelector(
      '[data-testid="kiosk-tour-viewer"]',
    );
    expect(viewerContainer).toBeInstanceOf(HTMLDivElement);

    // La visionneuse factice est montée avec le graphe de la visite extrait du cache hors-ligne
    await vi.waitFor(() => {
      expect(mountViewerMock).toHaveBeenCalledTimes(1);
    });

    if (viewerContainer instanceof HTMLDivElement) {
      const mountCall = vi.mocked(mountViewerMock).mock.calls[0];
      expect(mountCall?.[0]).toBe(viewerContainer);
      expect(mountCall?.[1]).toMatchObject({ id: testTour.id, title: testTourGraph.title });
      expect(mountCall?.[2]?.onSceneChange).toBeTypeOf('function');
      expect(mountCall?.[2]?.onHotspotClick).toBeTypeOf('function');
    }

    // Étape 7 : Vérifie qu'aucun appel réseau n'a abouti pendant la phase hors-ligne
    const offlineCalls = networkCallHistory.filter((entry) => !entry.online);
    const offlineSuccesses = offlineCalls.filter((entry) => entry.succeeded);
    expect(offlineCalls.length).toBeGreaterThan(0);
    expect(offlineSuccesses.length).toBe(0);

    // Étape 8 : Navigation retour vers HOME et nettoyage de la visionneuse
    const backBtn = document.querySelector(
      'button[data-testid="kiosk-tour-back-btn"]',
    );
    expect(backBtn).toBeInstanceOf(HTMLButtonElement);
    if (backBtn instanceof HTMLButtonElement) {
      backBtn.click();
    }

    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(destroyViewerSpy).toHaveBeenCalledTimes(1);
  });
});
