import { resources } from '@xplor/i18n';
import {
  KioskManifestSchema,
  KioskPinVerifyRequestSchema,
  TourGraphSchema,
  type KioskManifest,
  type KioskManifestCategory,
  type KioskManifestTour,
  type TourGraph,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveApiUrl } from './api-url.js';
import type { RenderTourCallback, RenderTourHandle } from './app-view.js';
import { bootstrapKiosk, type KioskBootstrapInstance } from './bootstrap.js';
import {
  loadCredentials,
  saveCredentials,
  type KioskCredentials,
  type Storage,
} from './credentials.js';
import { KIOSK_PIN_CACHE_KEY } from './pin-cache.js';
import type { CacheEntryLike, CacheStorageLike } from './tour-cache.js';
import type {
  MountViewerFn,
  ViewerInstance,
} from './render-tour.js';
import { collectUrlsFromTourGraph } from './urls-for-tour.js';

class FakeTimers {
  time = 0;
  nextId = 0;
  readonly timers = new Map<number, { at: number; callback: () => void }>();

  readonly now = (): number => this.time;

  readonly setTimeout = (callback: () => void, delayMs: number): number => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.time + delayMs, callback });
    return id;
  };

  readonly clearTimeout = (handle: unknown): void => {
    if (typeof handle === 'number') {
      this.timers.delete(handle);
    }
  };

  advanceBy(milliseconds: number): void {
    const target = this.time + milliseconds;
    for (;;) {
      const candidates = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at);
      const next = candidates[0];
      if (next === undefined) {
        break;
      }

      const [id, timer] = next;
      this.timers.delete(id);
      this.time = timer.at;
      timer.callback();
    }
    this.time = target;
  }
}

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

const validCredentials: KioskCredentials = {
  kioskId: '01990000-0000-7000-8000-000000000001',
  token: 'valid-secret-token-1234',
};

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

const testTourGraph: TourGraph = TourGraphSchema.parse({
  id: testTour.id,
  contentVersion: testTour.contentVersion,
  lang: 'fr',
  title: 'Visite de démonstration',
  summary: 'Une superbe visite pour tester la collecte des URLs',
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
      panorama: {
        preview: 'https://media.test/tours/tour-1/scene-1/preview.jpg',
        web: 'https://media.test/tours/tour-1/scene-1/web.jpg',
        tiles: {
          width: 8192,
          cols: 1,
          rows: 1,
          baseUrl: 'https://media.test/tours/tour-1/scene-1/tiles/{col}_{row}.jpg',
        },
      },
      initialView: { yaw: 0.1, pitch: -0.05, zoom: 50 },
      narrationUrl: 'https://media.test/tours/tour-1/scene-1/narration.mp3',
      ambientUrl: 'https://media.test/shared/wind.mp3',
      thumb: 'https://media.test/tours/tour-1/scene-1/thumb.jpg',
      hotspots: [],
    },
  ],
  linkedTours: [],
});

describe('bootstrapKiosk (M5 F-60)', () => {
  let fakeStorage: FakeLocalStorage;
  let activeInstance: KioskBootstrapInstance | null = null;
  let reloadCalledCount: number;

  beforeEach(() => {
    fakeStorage = new FakeLocalStorage();
    reloadCalledCount = 0;

    document.documentElement.replaceChildren();
    const head = document.createElement('head');
    const body = document.createElement('body');
    document.documentElement.appendChild(head);
    document.documentElement.appendChild(body);

    const appDiv = document.createElement('div');
    appDiv.id = 'app';
    body.appendChild(appDiv);

    Object.defineProperty(window, 'localStorage', {
      value: fakeStorage,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        reload: () => {
          reloadCalledCount += 1;
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (activeInstance !== null) {
      activeInstance.dispose();
      activeInstance = null;
    }
    vi.restoreAllMocks();
  });

  it('sans identifiants → affiche l’écran ENROLL (loadCredentials renvoie null)', () => {
    expect(loadCredentials(fakeStorage)).toBeNull();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);

    const state = activeInstance.state.getState();
    expect(state.enrolled).toBe(false);
    expect(state.screen).toBe('ENROLL');
    expect(state.lang).toBe('fr');
    expect(activeInstance.getLoops()).toBeNull();

    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.title).toBe(resources.fr.common.appName);

    const input = document.getElementById('kiosk-enroll-code');
    const form = document.querySelector('form');
    const submitBtn = document.querySelector('button[data-testid="kiosk-enroll-submit"]');
    const errorDiv = document.getElementById('kiosk-enroll-error');

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(form).toBeInstanceOf(HTMLFormElement);
    expect(submitBtn).toBeInstanceOf(HTMLButtonElement);
    expect(errorDiv).toBeInstanceOf(HTMLDivElement);

    if (errorDiv instanceof HTMLDivElement) {
      expect(errorDiv.hidden).toBe(true);
    }
    if (submitBtn instanceof HTMLButtonElement) {
      expect(submitBtn.textContent).toBe(resources.fr.kiosk.enroll.submit);
    }
  });

  it('initialise la langue depuis location.search (?lang=ar)', () => {
    Object.defineProperty(window, 'location', {
      value: {
        search: '?lang=ar',
        reload: () => {
          reloadCalledCount += 1;
        },
      },
      configurable: true,
      writable: true,
    });

    activeInstance = bootstrapKiosk(window, document);

    const state = activeInstance.state.getState();
    expect(state.lang).toBe('ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.title).toBe(resources.ar.common.appName);
  });

  it('avec identifiants et manifeste → affiche l’écran HOME', async () => {
    saveCredentials(fakeStorage, validCredentials);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/v1/kiosk/manifest')) {
        return Promise.resolve(
          new Response(JSON.stringify(validManifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);

    expect(activeInstance.state.getState().enrolled).toBe(true);

    const loops = activeInstance.getLoops();
    expect(loops).not.toBeNull();
    if (loops !== null && loops.ready !== undefined) {
      await loops.ready;
    }

    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(activeInstance.state.getState().manifest).not.toBeNull();

    const homeRoot = document.querySelector('.kiosk-home');
    expect(homeRoot).not.toBeNull();
  });

  it('onEnroll appelle enrollKiosk, dispatche ENROLLED et démarre les boucles vers HOME', async () => {
    const expectedBaseUrl = resolveApiUrl(import.meta.env);
    const capturedUrls: string[] = [];

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      capturedUrls.push(url);

      if (url.includes('/api/v1/kiosk/enroll')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              kioskId: validCredentials.kioskId,
              token: validCredentials.token,
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

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);
    expect(activeInstance.getLoops()).toBeNull();
    expect(activeInstance.state.getState().screen).toBe('ENROLL');

    const input = document.getElementById('kiosk-enroll-code');
    const form = document.querySelector('form');

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(form).toBeInstanceOf(HTMLFormElement);

    if (input instanceof HTMLInputElement && form instanceof HTMLFormElement) {
      input.value = 'ABCDEF12';
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await vi.waitFor(() => {
        expect(loadCredentials(fakeStorage)).not.toBeNull();
      });

      const creds = loadCredentials(fakeStorage);
      if (creds !== null) {
        expect(creds.kioskId).toBe(validCredentials.kioskId);
        expect(creds.token).toBe(validCredentials.token);
      }

      expect(capturedUrls).toContain(`${expectedBaseUrl}/api/v1/kiosk/enroll`);
      expect(activeInstance.state.getState().enrolled).toBe(true);

      const loops = activeInstance.getLoops();
      expect(loops).not.toBeNull();
      if (loops !== null && loops.ready !== undefined) {
        await loops.ready;
      }

      await vi.waitFor(() => {
        const currentState = activeInstance?.state.getState();
        expect(currentState?.screen).toBe('HOME');
      });
    }
  });

  it('onEnroll en cas d’échec affiche l’erreur traduite et reste sur ENROLL sans démarrer les boucles', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/v1/kiosk/enroll')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              statusCode: 400,
              message: 'Code invalide',
              code: 'INVALID_CODE',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }

      return Promise.resolve(new Response(null, { status: 500 }));
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);

    const input = document.getElementById('kiosk-enroll-code');
    const form = document.querySelector('form');
    const errorDiv = document.getElementById('kiosk-enroll-error');
    const submitBtn = document.querySelector('button[data-testid="kiosk-enroll-submit"]');

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(form).toBeInstanceOf(HTMLFormElement);
    expect(errorDiv).toBeInstanceOf(HTMLDivElement);
    expect(submitBtn).toBeInstanceOf(HTMLButtonElement);

    if (
      input instanceof HTMLInputElement &&
      form instanceof HTMLFormElement &&
      errorDiv instanceof HTMLDivElement &&
      submitBtn instanceof HTMLButtonElement
    ) {
      input.value = 'BADCODE1';
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await vi.waitFor(() => {
        expect(errorDiv.hidden).toBe(false);
      });

      expect(errorDiv.textContent).toBe(resources.fr.kiosk.enroll.invalidCode);
      expect(submitBtn.disabled).toBe(false);
      expect(loadCredentials(fakeStorage)).toBeNull();
      expect(activeInstance.getLoops()).toBeNull();
      expect(activeInstance.state.getState().enrolled).toBe(false);
      expect(activeInstance.state.getState().screen).toBe('ENROLL');
    }
  });

  it('le bouton « Forcer la synchro » appelle syncNow', async () => {
    saveCredentials(fakeStorage, validCredentials);

    let manifestFetchCount = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/v1/kiosk/manifest')) {
        manifestFetchCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify(validManifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);

    const loops = activeInstance.getLoops();
    if (loops !== null && loops.ready !== undefined) {
      await loops.ready;
    }
    expect(manifestFetchCount).toBe(1);

    await activeInstance.syncNow();
    expect(manifestFetchCount).toBe(2);

    // Vérifie également que le clic sur le bouton de maintenance « Forcer la synchro » appelle syncNow
    activeInstance.state.dispatch({ type: 'OPEN_MAINTENANCE' });
    activeInstance.state.dispatch({ type: 'UNLOCK' });
    expect(activeInstance.state.getState().screen).toBe('MAINTENANCE');

    const forceSyncBtn = document.querySelector('button[data-testid="kiosk-status-force-sync"]');
    expect(forceSyncBtn).toBeInstanceOf(HTMLButtonElement);
    if (forceSyncBtn instanceof HTMLButtonElement) {
      forceSyncBtn.click();
      await vi.waitFor(() => {
        expect(manifestFetchCount).toBe(3);
      });
    }
  });

  it('« Réenrôler » arrête les boucles si possible, appelle resetEnrollment puis recharge l’écran ENROLL', async () => {
    saveCredentials(fakeStorage, validCredentials);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/api/v1/kiosk/manifest')) {
        return Promise.resolve(
          new Response(JSON.stringify(validManifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);
    expect(loadCredentials(fakeStorage)).not.toBeNull();
    expect(activeInstance.getLoops()).not.toBeNull();

    await activeInstance.resetEnrollment();

    expect(loadCredentials(fakeStorage)).toBeNull();
    expect(activeInstance.getLoops()).toBeNull();
    expect(reloadCalledCount).toBe(1);

    const input = document.getElementById('kiosk-enroll-code');
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it('dispose() résilie les abonnements sans erreur', () => {
    activeInstance = bootstrapKiosk(window, document);
    expect(() => {
      activeInstance?.dispose();
    }).not.toThrow();
  });

  it('active le verrouillage F-60 : contextmenu et dragstart sont annulés, liens externes interceptés, et champ d’enrôlement reste utilisable', () => {
    activeInstance = bootstrapKiosk(window, document);

    // 1. contextmenu est annulé sur le document
    const ctxEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(ctxEvent);
    expect(ctxEvent.defaultPrevented).toBe(true);

    // 2. dragstart est annulé sur le document
    const dragEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(dragEvent);
    expect(dragEvent.defaultPrevented).toBe(true);

    // 3. Les liens sortants a[href^=http] sont interceptés
    const externalLink = document.createElement('a');
    externalLink.setAttribute('href', 'https://example.com/external');
    document.body.appendChild(externalLink);

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    externalLink.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);

    // 4. Le champ d'enrôlement reste présent et utilisable
    const input = document.getElementById('kiosk-enroll-code');
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (input instanceof HTMLInputElement) {
      expect(input.disabled).toBe(false);
      input.focus();
      expect(document.activeElement).toBe(input);

      input.value = 'ABCD1234';
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(inputEvent);
      expect(input.value).toBe('ABCD1234');
      expect(inputEvent.defaultPrevented).toBe(false);
    }

    // 5. dispose() désactive le verrouillage
    activeInstance.dispose();
    activeInstance = null;

    const afterCtxEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(afterCtxEvent);
    expect(afterCtxEvent.defaultPrevented).toBe(false);
  });

  it('enregistre le service worker si serviceWorker in navigator', () => {
    const registerMock = vi.fn().mockResolvedValue({ scope: '/' });
    const fakeNav = {
      serviceWorker: {
        register: registerMock,
      },
    };

    activeInstance = bootstrapKiosk(window, document, {
      navigator: fakeNav,
    });

    expect(registerMock).toHaveBeenCalledWith('/sw.js');
  });

  it('n’enregistre pas le service worker si serviceWorker n’est pas dans navigator', () => {
    const registerMock = vi.fn();
    const fakeNav = {
      userAgent: 'LegacyBrowser',
    };

    activeInstance = bootstrapKiosk(window, document, {
      navigator: fakeNav,
      registerServiceWorker: registerMock,
    });

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('n’enregistre pas le service worker si navigator est null ou non-objet', () => {
    const registerMock = vi.fn();

    activeInstance = bootstrapKiosk(window, document, {
      navigator: null,
      registerServiceWorker: registerMock,
    });

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('passage de TOUR vers ATTRACT sans clic Retour appelle destroy() une fois, et Échap n’a plus d’effet ensuite', () => {
    saveCredentials(fakeStorage, validCredentials);
    let handleDestroy: ReturnType<typeof vi.fn> = vi.fn();

    const fakeRenderTour: RenderTourCallback = vi.fn(
      (_root: HTMLElement, _tourId: string, onBack?: () => void): RenderTourHandle => {
        const handleKeyDown = (event: KeyboardEvent): void => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onBack?.();
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        handleDestroy = vi.fn((): void => {
          document.removeEventListener('keydown', handleKeyDown);
        });
        return { destroy: handleDestroy };
      },
    );

    activeInstance = bootstrapKiosk(window, document, {
      manifest: validManifest,
      renderTour: fakeRenderTour,
    });

    activeInstance.state.dispatch({ type: 'SELECT_TOUR', tourId: testTour.id });
    expect(activeInstance.state.getState().screen).toBe('TOUR');
    expect(fakeRenderTour).toHaveBeenCalledTimes(1);
    expect(handleDestroy).not.toHaveBeenCalled();

    activeInstance.state.dispatch({ type: 'IDLE' });
    expect(activeInstance.state.getState().screen).toBe('ATTRACT');
    expect(handleDestroy).toHaveBeenCalledTimes(1);

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(false);
    expect(handleDestroy).toHaveBeenCalledTimes(1);
    expect(activeInstance.state.getState().screen).toBe('ATTRACT');
  });

  it('passage de TOUR vers HOME sans clic Retour appelle destroy() une fois, et Échap n’a plus d’effet ensuite', () => {
    saveCredentials(fakeStorage, validCredentials);
    let handleDestroy: ReturnType<typeof vi.fn> = vi.fn();

    const fakeRenderTour: RenderTourCallback = vi.fn(
      (_root: HTMLElement, _tourId: string, onBack?: () => void): RenderTourHandle => {
        const handleKeyDown = (event: KeyboardEvent): void => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onBack?.();
          }
        };
        document.addEventListener('keydown', handleKeyDown);
        handleDestroy = vi.fn((): void => {
          document.removeEventListener('keydown', handleKeyDown);
        });
        return { destroy: handleDestroy };
      },
    );

    activeInstance = bootstrapKiosk(window, document, {
      manifest: validManifest,
      renderTour: fakeRenderTour,
    });

    activeInstance.state.dispatch({ type: 'SELECT_TOUR', tourId: testTour.id });
    expect(activeInstance.state.getState().screen).toBe('TOUR');
    expect(fakeRenderTour).toHaveBeenCalledTimes(1);
    expect(handleDestroy).not.toHaveBeenCalled();

    activeInstance.state.dispatch({ type: 'BACK_HOME' });
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(handleDestroy).toHaveBeenCalledTimes(1);

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeEvent);

    expect(escapeEvent.defaultPrevented).toBe(false);
    expect(handleDestroy).toHaveBeenCalledTimes(1);
    expect(activeInstance.state.getState().screen).toBe('HOME');
  });

  it('un nouveau rendu de TOUR détruit d’abord le handle précédent', () => {
    saveCredentials(fakeStorage, validCredentials);
    const destroy1 = vi.fn();
    const destroy2 = vi.fn();

    let renderCount = 0;
    const fakeRenderTour: RenderTourCallback = vi.fn(
      (): RenderTourHandle => {
        renderCount += 1;
        if (renderCount === 1) {
          return { destroy: destroy1 };
        }
        expect(destroy1).toHaveBeenCalledTimes(1);
        return { destroy: destroy2 };
      },
    );

    activeInstance = bootstrapKiosk(window, document, {
      manifest: validManifest,
      renderTour: fakeRenderTour,
    });

    activeInstance.state.dispatch({ type: 'SELECT_TOUR', tourId: 'tour-1' });
    expect(activeInstance.state.getState().screen).toBe('TOUR');
    expect(fakeRenderTour).toHaveBeenCalledTimes(1);
    expect(destroy1).not.toHaveBeenCalled();

    activeInstance.state.dispatch({ type: 'SELECT_TOUR', tourId: 'tour-2' });
    expect(destroy1).toHaveBeenCalledTimes(1);
    expect(fakeRenderTour).toHaveBeenCalledTimes(2);
    expect(destroy2).not.toHaveBeenCalled();
  });

  it('sans options.urlsForTour, downloadTour appelle l’API du graphe (?lang=fr puis ?lang=ar) et met en cache les URLs collectées', async () => {
    const fakeCacheStorage = new FakeCacheStorage();
    const testApiUrl = 'http://api.kiosk.test';
    const capturedFetchedUrls: string[] = [];

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      capturedFetchedUrls.push(url);

      if (url.includes(`/api/v1/public/tours/${testTour.id}`)) {
        const lang = url.includes('lang=ar') ? 'ar' : 'fr';
        return Promise.resolve(
          new Response(JSON.stringify({ ...testTourGraph, lang }), {
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

    activeInstance = bootstrapKiosk(window, document, {
      apiUrl: testApiUrl,
      manifest: validManifest,
      cacheStorage: fakeCacheStorage,
      fetchFn: fetchMock,
    });

    // 1. Appel en fr par défaut
    await activeInstance.tourCache.downloadTour(testTour.id);

    const expectedGraphUrlFr = `${testApiUrl}/api/v1/public/tours/${encodeURIComponent(testTour.id)}?lang=fr`;
    expect(capturedFetchedUrls).toContain(expectedGraphUrlFr);

    // 2. Vérifie la mise en cache des URLs collectées
    const expectedCollectedUrls = collectUrlsFromTourGraph(testTourGraph, testTour.url);
    for (const assetUrl of expectedCollectedUrls) {
      expect(capturedFetchedUrls).toContain(assetUrl);
    }

    const stagingCache = fakeCacheStorage.caches.get(`tour-${testTour.id}-staging`);
    expect(stagingCache).toBeDefined();
    if (stagingCache !== undefined) {
      const keys = await stagingCache.keys();
      expect(keys.sort()).toEqual(expectedCollectedUrls.sort());
    }

    // 3. Appel en ar après changement de langue de l'état
    activeInstance.state.dispatch({ type: 'SELECT_LANG', lang: 'ar' });
    expect(activeInstance.state.getState().lang).toBe('ar');

    await activeInstance.tourCache.downloadTour(testTour.id);

    const expectedGraphUrlAr = `${testApiUrl}/api/v1/public/tours/${encodeURIComponent(testTour.id)}?lang=ar`;
    expect(capturedFetchedUrls).toContain(expectedGraphUrlAr);
  });

  it('options.urlsForTour fourni reste prioritaire et n’appelle pas le fetch du graphe', async () => {
    const fakeCacheStorage = new FakeCacheStorage();
    const customAssetUrl = 'https://custom.test/panorama.jpg';
    const customUrlsForTour = vi.fn().mockResolvedValue([customAssetUrl]);
    const capturedFetchedUrls: string[] = [];

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      capturedFetchedUrls.push(url);
      return Promise.resolve(
        new Response('asset-content', {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      );
    });

    activeInstance = bootstrapKiosk(window, document, {
      manifest: validManifest,
      cacheStorage: fakeCacheStorage,
      fetchFn: fetchMock,
      urlsForTour: customUrlsForTour,
    });

    await activeInstance.tourCache.downloadTour(testTour.id);

    expect(customUrlsForTour).toHaveBeenCalledWith(testTour.id);
    expect(capturedFetchedUrls).toEqual([customAssetUrl]);
    expect(capturedFetchedUrls.some((u) => u.includes('/api/v1/public/tours/'))).toBe(false);

    const stagingCache = fakeCacheStorage.caches.get(`tour-${testTour.id}-staging`);
    expect(stagingCache).toBeDefined();
    if (stagingCache !== undefined) {
      const keys = await stagingCache.keys();
      expect(keys).toEqual([customAssetUrl]);
    }
  });

  it('scénario de bout en bout : bootstrap ouvre une visite, la visionneuse factice est montée, Retour la détruit et ramène à HOME', async () => {
    saveCredentials(fakeStorage, validCredentials);

    const destroyViewerSpy = vi.fn();
    const fakeViewer: ViewerInstance = {
      destroy: destroyViewerSpy,
    };
    const mountViewerMock = vi.fn<MountViewerFn>(() => fakeViewer);

    const testApiUrl = 'http://api.kiosk.test';
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes(`/api/v1/public/tours/${testTour.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify(testTourGraph), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
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

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    activeInstance = bootstrapKiosk(window, document, {
      apiUrl: testApiUrl,
      manifest: validManifest,
      fetchFn: fetchMock,
      mountViewer: mountViewerMock,
    });

    const loops = activeInstance.getLoops();
    if (loops !== null && loops.ready !== undefined) {
      await loops.ready;
    }

    // 1. Démarrage sur HOME avec le manifeste chargé
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(document.querySelector('.kiosk-home')).not.toBeNull();
    expect(document.querySelector('.kiosk-tour-view')).toBeNull();

    // 2. L'utilisateur clique sur le bouton explorer de la visite mise en avant
    const featuredBtn = document.querySelector('button[data-testid="featured-tour-button"]');
    expect(featuredBtn).toBeInstanceOf(HTMLButtonElement);
    if (featuredBtn instanceof HTMLButtonElement) {
      featuredBtn.click();
    }

    // 3. L'application bascule sur l'écran TOUR
    expect(activeInstance.state.getState().screen).toBe('TOUR');
    expect(activeInstance.state.getState().tourId).toBe(testTour.id);

    const tourView = document.querySelector('.kiosk-tour-view');
    expect(tourView).not.toBeNull();

    const viewerContainer = document.querySelector('[data-testid="kiosk-tour-viewer"]');
    expect(viewerContainer).toBeInstanceOf(HTMLDivElement);

    const backBtn = document.querySelector('button[data-testid="kiosk-tour-back-btn"]');
    expect(backBtn).toBeInstanceOf(HTMLButtonElement);

    // 4. La visite est chargée depuis l'API et la visionneuse factice est montée
    await vi.waitFor(() => {
      expect(mountViewerMock).toHaveBeenCalledTimes(1);
    });

    if (viewerContainer instanceof HTMLDivElement) {
      const mountArgs = mountViewerMock.mock.calls[0];
      expect(mountArgs?.[0]).toBe(viewerContainer);
      expect(mountArgs?.[1]).toMatchObject({ id: testTour.id, title: testTourGraph.title });
      expect(typeof mountArgs?.[2]?.onSceneChange).toBe('function');
      expect(typeof mountArgs?.[2]?.onHotspotClick).toBe('function');
    }
    expect(destroyViewerSpy).not.toHaveBeenCalled();

    // 5. Clic sur le bouton « Retour »
    if (backBtn instanceof HTMLButtonElement) {
      backBtn.click();
    }

    // 6. La visionneuse factice est détruite et l'application revient à HOME
    expect(destroyViewerSpy).toHaveBeenCalledTimes(1);
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(activeInstance.state.getState().tourId).toBeNull();
    expect(document.querySelector('.kiosk-home')).not.toBeNull();
    expect(document.querySelector('.kiosk-tour-view')).toBeNull();
  });

  it('scénario de bout en bout avec touche Échap : bootstrap ouvre une visite, la visionneuse factice est montée, Échap la détruit et ramène à HOME', async () => {
    saveCredentials(fakeStorage, validCredentials);

    const destroyViewerSpy = vi.fn();
    const fakeViewer: ViewerInstance = {
      destroy: destroyViewerSpy,
    };
    const mountViewerMock: MountViewerFn = vi.fn(() => fakeViewer);

    const testApiUrl = 'http://api.kiosk.test';
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes(`/api/v1/public/tours/${testTour.id}`)) {
        return Promise.resolve(
          new Response(JSON.stringify(testTourGraph), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
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

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    activeInstance = bootstrapKiosk(window, document, {
      apiUrl: testApiUrl,
      manifest: validManifest,
      fetchFn: fetchMock,
      mountViewer: mountViewerMock,
    });

    const loops = activeInstance.getLoops();
    if (loops !== null && loops.ready !== undefined) {
      await loops.ready;
    }

    // 1. Ouvrir la visite via action SELECT_TOUR
    activeInstance.state.dispatch({ type: 'SELECT_TOUR', tourId: testTour.id });
    expect(activeInstance.state.getState().screen).toBe('TOUR');

    // 2. Attendre que la visionneuse factice soit montée
    await vi.waitFor(() => {
      expect(mountViewerMock).toHaveBeenCalledTimes(1);
    });
    expect(destroyViewerSpy).not.toHaveBeenCalled();

    // 3. Déclencher la touche Échap
    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escapeEvent);

    // 4. La visionneuse factice est détruite et retour à HOME
    expect(destroyViewerSpy).toHaveBeenCalledTimes(1);
    expect(activeInstance.state.getState().screen).toBe('HOME');
    expect(activeInstance.state.getState().tourId).toBeNull();
    expect(document.querySelector('.kiosk-home')).not.toBeNull();
    expect(document.querySelector('.kiosk-tour-view')).toBeNull();
  });

  describe('veille et durée d’inactivité configurable (M5 F-63)', () => {
    it('manifeste avec idleTimeoutSeconds=30 : la veille se déclenche après 30 s avec les minuteurs factices', () => {
      saveCredentials(fakeStorage, validCredentials);
      const timers = new FakeTimers();

      const manifestWith30s: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 30,
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: manifestWith30s,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(activeInstance.state.getState().screen).toBe('HOME');

      // À 29,999 s : toujours sur HOME
      timers.advanceBy(29_999);
      expect(activeInstance.state.getState().screen).toBe('HOME');

      // À 30 s : passage en veille (ATTRACT)
      timers.advanceBy(1);
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
    });

    it('met à jour la durée de veille lors d’un changement de manifeste via le store (MANIFEST_LOADED)', () => {
      saveCredentials(fakeStorage, validCredentials);
      const timers = new FakeTimers();

      const initialManifest: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 60,
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: initialManifest,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(activeInstance.state.getState().screen).toBe('HOME');

      // Un nouveau manifeste arrive avec 30 s
      const updatedManifest: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 30,
        },
      };

      activeInstance.state.dispatch({
        type: 'MANIFEST_LOADED',
        manifest: updatedManifest,
      });

      // À 29,999 s depuis la mise à jour : toujours HOME
      timers.advanceBy(29_999);
      expect(activeInstance.state.getState().screen).toBe('HOME');

      // À 30 s : bascule en ATTRACT
      timers.advanceBy(1);
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
    });

    it('ignore les valeurs négatives ou nulles d’idleTimeoutSeconds lors d’un changement de manifeste sans lever d’erreur', () => {
      saveCredentials(fakeStorage, validCredentials);
      const timers = new FakeTimers();

      const initialManifest: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 30,
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: initialManifest,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      // Manifeste avec valeur négative (<= 0)
      const negativeManifest: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: -5,
        },
      };

      expect(() => {
        activeInstance?.state.dispatch({
          type: 'MANIFEST_LOADED',
          manifest: negativeManifest,
        });
      }).not.toThrow();

      // Manifeste avec valeur zéro
      const zeroManifest: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 0,
        },
      };

      expect(() => {
        activeInstance?.state.dispatch({
          type: 'MANIFEST_LOADED',
          manifest: zeroManifest,
        });
      }).not.toThrow();

      // La durée initiale de 30 s reste effective
      timers.advanceBy(29_999);
      expect(activeInstance.state.getState().screen).toBe('HOME');

      timers.advanceBy(1);
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
    });

    it('démarrage sans manifeste puis chargement ultérieur applique la durée configurée (30 s)', () => {
      saveCredentials(fakeStorage, validCredentials);
      const timers = new FakeTimers();

      activeInstance = bootstrapKiosk(window, document, {
        manifest: null,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      // Chargement ultérieur d'un manifeste avec 30 s
      const manifestWith30s: KioskManifest = {
        ...validManifest,
        kiosk: {
          ...validManifest.kiosk,
          idleTimeoutSeconds: 30,
        },
      };

      activeInstance.state.dispatch({
        type: 'MANIFEST_LOADED',
        manifest: manifestWith30s,
      });

      // L'écran est HOME après chargement du manifeste
      expect(activeInstance.state.getState().screen).toBe('HOME');

      timers.advanceBy(29_999);
      expect(activeInstance.state.getState().screen).toBe('HOME');

      timers.advanceBy(1);
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
    });

    it('deux entrées successives en ATTRACT passent à la visite suivante ; manifeste sans attractTourIds donne null', () => {
      saveCredentials(fakeStorage, validCredentials);

      const tourA: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000201',
        contentVersion: 1,
        sizeBytes: 50_000_000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000201',
      };

      const tourB: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000202',
        contentVersion: 2,
        sizeBytes: 60_000_000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000202',
      };

      const manifestWithTwoTours: KioskManifest = {
        ...validManifest,
        selection: {
          ...validManifest.selection,
          attractTourIds: [tourA.id, tourB.id],
          tours: [tourA, tourB],
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: manifestWithTwoTours,
      });

      expect(activeInstance.state.getState().screen).toBe('HOME');

      // 1. Première entrée dans l'écran ATTRACT -> première visite
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      const preview1 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview1).toBeInstanceOf(HTMLDivElement);
      if (preview1 instanceof HTMLDivElement) {
        expect(preview1.getAttribute('data-tour-url')).toBe(tourA.url);
      }

      // Sortie vers HOME
      activeInstance.state.dispatch({ type: 'WAKE' });
      expect(activeInstance.state.getState().screen).toBe('HOME');

      // 2. Deuxième entrée dans l'écran ATTRACT -> visite suivante
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      const preview2 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview2).toBeInstanceOf(HTMLDivElement);
      if (preview2 instanceof HTMLDivElement) {
        expect(preview2.getAttribute('data-tour-url')).toBe(tourB.url);
      }

      // 3. Manifeste sans attractTourIds donne null
      activeInstance.dispose();

      const manifestWithoutAttract: KioskManifest = {
        ...validManifest,
        selection: {
          ...validManifest.selection,
          attractTourIds: [],
          tours: [tourA, tourB],
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: manifestWithoutAttract,
      });

      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      const previewWithoutAttract = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(previewWithoutAttract).toBeInstanceOf(HTMLDivElement);
      if (previewWithoutAttract instanceof HTMLDivElement) {
        expect(previewWithoutAttract.getAttribute('data-tour-url')).toBeNull();
      }
    });

    it('rotation de veille : ignore les liens externes hors domaine et les URLs vides en renvoyant null', () => {
      saveCredentials(fakeStorage, validCredentials);

      const tourExternal: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000203',
        contentVersion: 1,
        sizeBytes: 50_000_000,
        url: 'https://evil.external-domain.com/tour',
      };

      const tourEmpty: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000204',
        contentVersion: 1,
        sizeBytes: 50_000_000,
        url: '   ',
      };

      const manifestWithInvalidUrls: KioskManifest = {
        ...validManifest,
        selection: {
          ...validManifest.selection,
          attractTourIds: [tourExternal.id, tourEmpty.id],
          tours: [tourExternal, tourEmpty],
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: manifestWithInvalidUrls,
      });

      // Première entrée : URL externe -> rejetée (null)
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      const preview1 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview1).toBeInstanceOf(HTMLDivElement);
      if (preview1 instanceof HTMLDivElement) {
        expect(preview1.getAttribute('data-tour-url')).toBeNull();
      }

      // Deuxième entrée : URL vide -> rejetée (null)
      activeInstance.state.dispatch({ type: 'WAKE' });
      activeInstance.state.dispatch({ type: 'IDLE' });
      const preview2 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview2).toBeInstanceOf(HTMLDivElement);
      if (preview2 instanceof HTMLDivElement) {
        expect(preview2.getAttribute('data-tour-url')).toBeNull();
      }
    });

    it('rotation de veille : la rotation est recréée lors du chargement d’un nouveau manifeste (MANIFEST_LOADED)', () => {
      saveCredentials(fakeStorage, validCredentials);

      const tour1: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000211',
        contentVersion: 1,
        sizeBytes: 50_000_000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000211',
      };

      const tour2: KioskManifestTour = {
        id: '01990000-0000-7000-8000-000000000212',
        contentVersion: 1,
        sizeBytes: 50_000_000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000212',
      };

      const initialManifest: KioskManifest = {
        ...validManifest,
        selection: {
          ...validManifest.selection,
          attractTourIds: [tour1.id],
          tours: [tour1],
        },
      };

      activeInstance = bootstrapKiosk(window, document, {
        manifest: initialManifest,
      });

      activeInstance.state.dispatch({ type: 'IDLE' });
      const preview1 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview1).toBeInstanceOf(HTMLDivElement);
      if (preview1 instanceof HTMLDivElement) {
        expect(preview1.getAttribute('data-tour-url')).toBe(tour1.url);
      }

      // Nouveau manifeste avec tour2
      const updatedManifest: KioskManifest = {
        ...validManifest,
        selection: {
          ...validManifest.selection,
          attractTourIds: [tour2.id],
          tours: [tour2],
        },
      };

      activeInstance.state.dispatch({
        type: 'MANIFEST_LOADED',
        manifest: updatedManifest,
      });

      activeInstance.state.dispatch({ type: 'WAKE' });
      activeInstance.state.dispatch({ type: 'IDLE' });

      const preview2 = document.querySelector(
        '[data-testid="kiosk-attract-preview"]',
      );
      expect(preview2).toBeInstanceOf(HTMLDivElement);
      if (preview2 instanceof HTMLDivElement) {
        expect(preview2.getAttribute('data-tour-url')).toBe(tour2.url);
      }
    });
  });

  describe('sessions du kiosque (M5 F-64)', () => {
    it('relie la vie des sessions et les changements de langue au suivi M7', () => {
      saveCredentials(fakeStorage, validCredentials);
      const stats = {
        startSession: vi.fn(), endSession: vi.fn(), openTour: vi.fn(), sceneView: vi.fn(),
        hotspotClick: vi.fn(), audioPlay: vi.fn(), qrShown: vi.fn(), langChange: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined), destroy: vi.fn().mockResolvedValue(undefined),
      };
      activeInstance = bootstrapKiosk(window, document, { manifest: validManifest, stats });

      expect(stats.startSession).toHaveBeenCalledOnce();
      activeInstance.state.dispatch({ type: 'SELECT_LANG', lang: 'ar' });
      expect(stats.langChange).toHaveBeenCalledExactlyOnceWith('ar');
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(stats.endSession).toHaveBeenCalledOnce();
      expect(stats.flush).toHaveBeenCalledOnce();
      activeInstance.dispose();
      expect(stats.destroy).toHaveBeenCalledOnce();
    });

    it('nouvel identifiant à chaque sortie de veille', () => {
      saveCredentials(fakeStorage, validCredentials);

      activeInstance = bootstrapKiosk(window, document, {
        manifest: validManifest,
      });

      expect(activeInstance.state.getState().screen).toBe('HOME');
      const firstSessionId = activeInstance.session.current();
      expect(typeof firstSessionId).toBe('string');
      expect(firstSessionId).not.toBeNull();

      // Passage en veille
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(activeInstance.session.current()).toBeNull();

      // Première sortie de veille (WAKE) -> nouvel identifiant
      activeInstance.state.dispatch({ type: 'WAKE' });
      expect(activeInstance.state.getState().screen).toBe('HOME');
      const secondSessionId = activeInstance.session.current();
      expect(typeof secondSessionId).toBe('string');
      expect(secondSessionId).not.toBeNull();
      expect(secondSessionId).not.toBe(firstSessionId);

      // Nouveau passage en veille
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(activeInstance.session.current()).toBeNull();

      // Deuxième sortie de veille (WAKE) -> encore un nouvel identifiant
      activeInstance.state.dispatch({ type: 'WAKE' });
      expect(activeInstance.state.getState().screen).toBe('HOME');
      const thirdSessionId = activeInstance.session.current();
      expect(typeof thirdSessionId).toBe('string');
      expect(thirdSessionId).not.toBeNull();
      expect(thirdSessionId).not.toBe(secondSessionId);
      expect(thirdSessionId).not.toBe(firstSessionId);
    });

    it('onSessionEnd appelé avec l\'ancien identifiant', () => {
      saveCredentials(fakeStorage, validCredentials);
      const onSessionEnd = vi.fn();

      activeInstance = bootstrapKiosk(window, document, {
        manifest: validManifest,
        onSessionEnd,
      });

      const firstSessionId = activeInstance.session.current();
      expect(typeof firstSessionId).toBe('string');
      expect(onSessionEnd).not.toHaveBeenCalled();

      // Passage en veille -> clôture et notification avec l'identifiant de la session terminée
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(onSessionEnd).toHaveBeenCalledTimes(1);
      expect(onSessionEnd).toHaveBeenCalledWith(firstSessionId);

      // Sortie de veille
      activeInstance.state.dispatch({ type: 'WAKE' });
      const secondSessionId = activeInstance.session.current();
      expect(typeof secondSessionId).toBe('string');
      expect(onSessionEnd).toHaveBeenCalledTimes(1);

      // Second passage en veille -> notification avec le second identifiant
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(onSessionEnd).toHaveBeenCalledTimes(2);
      expect(onSessionEnd).toHaveBeenLastCalledWith(secondSessionId);
    });

    it('aucun identifiant en ATTRACT', () => {
      saveCredentials(fakeStorage, validCredentials);

      activeInstance = bootstrapKiosk(window, document, {
        manifest: validManifest,
      });

      expect(activeInstance.session.current()).not.toBeNull();

      // Passage en veille
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(activeInstance.session.current()).toBeNull();

      // Deuxième action IDLE consécutive : reste null sans effet indésirable
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(activeInstance.session.current()).toBeNull();
    });

    it('démarrage d’une session au premier affichage de HOME lors d’un chargement asynchrone du manifeste', () => {
      saveCredentials(fakeStorage, validCredentials);

      activeInstance = bootstrapKiosk(window, document, {
        manifest: null,
      });

      // Initialement en LOADING : aucune session active
      expect(activeInstance.state.getState().screen).toBe('LOADING');
      expect(activeInstance.session.current()).toBeNull();

      // Chargement du manifeste -> passage à HOME pour la première fois
      activeInstance.state.dispatch({
        type: 'MANIFEST_LOADED',
        manifest: validManifest,
      });

      expect(activeInstance.state.getState().screen).toBe('HOME');
      const sessionId = activeInstance.session.current();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).not.toBeNull();
    });

    it('la session active est conservée lors de la consultation d’une visite puis retour à HOME', () => {
      saveCredentials(fakeStorage, validCredentials);
      const onSessionEnd = vi.fn();

      activeInstance = bootstrapKiosk(window, document, {
        manifest: validManifest,
        onSessionEnd,
      });

      const sessionId = activeInstance.session.current();
      expect(typeof sessionId).toBe('string');

      // Sélection d'une visite -> écran TOUR
      activeInstance.state.dispatch({
        type: 'SELECT_TOUR',
        tourId: testTour.id,
      });
      expect(activeInstance.state.getState().screen).toBe('TOUR');
      expect(activeInstance.session.current()).toBe(sessionId);
      expect(onSessionEnd).not.toHaveBeenCalled();

      // Retour à l'accueil -> écran HOME
      activeInstance.state.dispatch({ type: 'BACK_HOME' });
      expect(activeInstance.state.getState().screen).toBe('HOME');
      expect(activeInstance.session.current()).toBe(sessionId);
      expect(onSessionEnd).not.toHaveBeenCalled();
    });

    it('la session est clôturée lorsque le passage en veille (IDLE) survient depuis l’écran TOUR', () => {
      saveCredentials(fakeStorage, validCredentials);
      const onSessionEnd = vi.fn();

      activeInstance = bootstrapKiosk(window, document, {
        manifest: validManifest,
        onSessionEnd,
      });

      const sessionId = activeInstance.session.current();
      expect(typeof sessionId).toBe('string');

      // Entrée dans une visite
      activeInstance.state.dispatch({
        type: 'SELECT_TOUR',
        tourId: testTour.id,
      });
      expect(activeInstance.state.getState().screen).toBe('TOUR');

      // Inactivité pendant la visite -> passage en ATTRACT
      activeInstance.state.dispatch({ type: 'IDLE' });
      expect(activeInstance.state.getState().screen).toBe('ATTRACT');
      expect(activeInstance.session.current()).toBeNull();
      expect(onSessionEnd).toHaveBeenCalledTimes(1);
      expect(onSessionEnd).toHaveBeenCalledWith(sessionId);
    });

    it('aucune session n’est active en écran ENROLL', () => {
      // Pas d'identifiants
      activeInstance = bootstrapKiosk(window, document, {
        manifest: null,
      });

      expect(activeInstance.state.getState().screen).toBe('ENROLL');
      expect(activeInstance.session.current()).toBeNull();
    });
  });

  describe('PIN technique hors-ligne (M5 F-67)', () => {
    it('PIN validé en ligne puis fetch en erreur réseau : le même PIN est accepté et un autre refusé', async () => {
      saveCredentials(fakeStorage, validCredentials);

      let isOffline = false;
      const fetchFn = vi.fn<typeof fetch>().mockImplementation((input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes('/api/v1/kiosk/manifest')) {
          return Promise.resolve(
            new Response(JSON.stringify(validManifest), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        if (isOffline) {
          return Promise.reject(new TypeError('Network offline'));
        }

        if (url.includes('/api/v1/kiosk/maintenance/verify-pin')) {
          const bodyText = typeof init?.body === 'string' ? init.body : '{}';
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(bodyText);
          } catch {
            parsedBody = null;
          }
          const parseResult = KioskPinVerifyRequestSchema.safeParse(parsedBody);
          const isCorrect = parseResult.success && parseResult.data.pin === '1234';
          return Promise.resolve(
            new Response(JSON.stringify({ valid: isCorrect }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      activeInstance = bootstrapKiosk(window, document, {
        fetchFn,
        manifest: validManifest,
      });

      // 1. PIN validé en ligne -> stocké dans le cache local
      const onlineValid = await activeInstance.verifyMaintenancePin('1234');
      expect(onlineValid).toBe(true);
      expect(fakeStorage.getItem(KIOSK_PIN_CACHE_KEY)).not.toBeNull();

      // 2. Panne réseau
      isOffline = true;

      // 3. Même PIN accepté hors-ligne via le cache local
      const offlineValid = await activeInstance.verifyMaintenancePin('1234');
      expect(offlineValid).toBe(true);

      // 4. Autre PIN refusé hors-ligne
      const offlineWrong = await activeInstance.verifyMaintenancePin('9999');
      expect(offlineWrong).toBe(false);
    });

    it('après réenrôlement le cache de PIN est vidé', async () => {
      saveCredentials(fakeStorage, validCredentials);

      let isOffline = false;
      const fetchFn = vi.fn<typeof fetch>().mockImplementation((input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes('/api/v1/kiosk/manifest')) {
          return Promise.resolve(
            new Response(JSON.stringify(validManifest), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        if (isOffline) {
          return Promise.reject(new TypeError('Network offline'));
        }

        if (url.includes('/api/v1/kiosk/maintenance/verify-pin')) {
          const bodyText = typeof init?.body === 'string' ? init.body : '{}';
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(bodyText);
          } catch {
            parsedBody = null;
          }
          const parseResult = KioskPinVerifyRequestSchema.safeParse(parsedBody);
          const isCorrect = parseResult.success && parseResult.data.pin === '1234';
          return Promise.resolve(
            new Response(JSON.stringify({ valid: isCorrect }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      activeInstance = bootstrapKiosk(window, document, {
        fetchFn,
        manifest: validManifest,
      });

      // PIN validé en ligne -> présent dans le cache
      const onlineValid = await activeInstance.verifyMaintenancePin('1234');
      expect(onlineValid).toBe(true);
      expect(fakeStorage.getItem(KIOSK_PIN_CACHE_KEY)).not.toBeNull();

      // Réenrôlement
      await activeInstance.resetEnrollment();

      // Cache vidé
      expect(fakeStorage.getItem(KIOSK_PIN_CACHE_KEY)).toBeNull();

      // En panne réseau après réenrôlement, l'ancien PIN est refusé
      isOffline = true;
      const offlineAfterReset = await activeInstance.verifyMaintenancePin('1234');
      expect(offlineAfterReset).toBe(false);
    });
  });
});
