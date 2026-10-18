import { resources } from '@xplor/i18n';
import {
  KioskManifestSchema,
  type KioskManifest,
  type KioskManifestCategory,
  type KioskManifestTour,
} from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveApiUrl } from './api-url.js';
import { bootstrapKiosk, type KioskBootstrapInstance } from './bootstrap.js';
import {
  loadCredentials,
  saveCredentials,
  type KioskCredentials,
  type Storage,
} from './credentials.js';

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
});
