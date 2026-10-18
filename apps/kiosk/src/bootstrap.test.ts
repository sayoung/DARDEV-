import { resources } from '@xplor/i18n';
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

const validCredentials: KioskCredentials = {
  kioskId: '01990000-0000-7000-8000-000000000001',
  token: 'valid-secret-token-1234',
};

describe('bootstrapKiosk (M5 F-60 assemblage 2/4)', () => {
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

  it('sans identifiants → démarre à l’écran ENROLL avec champ et bouton de validation', () => {
    expect(loadCredentials(fakeStorage)).toBeNull();

    activeInstance = bootstrapKiosk(window, document);

    const state = activeInstance.state.getState();
    expect(state.enrolled).toBe(false);
    expect(state.screen).toBe('ENROLL');
    expect(state.lang).toBe('fr');

    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.title).toBe(resources.fr.common.appName);

    const input = document.getElementById('kiosk-enroll-code');
    const form = document.querySelector('form');
    const submitBtn = document.querySelector('button[data-testid="kiosk-enroll-submit"]');
    const errorDiv = document.getElementById('kiosk-enroll-error');

    expect(input instanceof HTMLInputElement).toBe(true);
    expect(form instanceof HTMLFormElement).toBe(true);
    expect(submitBtn instanceof HTMLButtonElement).toBe(true);
    expect(errorDiv instanceof HTMLDivElement).toBe(true);

    if (errorDiv instanceof HTMLDivElement) {
      expect(errorDiv.hidden).toBe(true);
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

  it('onEnroll appelle enrollKiosk avec resolveApiUrl(import.meta.env), enregistre les identifiants et dispatche ENROLLED', async () => {
    const expectedBaseUrl = resolveApiUrl(import.meta.env);
    let capturedUrl = '';

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      capturedUrl = url;

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

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    window.fetch = fetchMock;

    activeInstance = bootstrapKiosk(window, document);
    expect(activeInstance.state.getState().screen).toBe('ENROLL');

    const input = document.getElementById('kiosk-enroll-code');
    const form = document.querySelector('form');

    expect(input instanceof HTMLInputElement).toBe(true);
    expect(form instanceof HTMLFormElement).toBe(true);

    if (input instanceof HTMLInputElement && form instanceof HTMLFormElement) {
      input.value = 'ABCDEF12';
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await vi.waitFor(() => {
        expect(loadCredentials(fakeStorage)).not.toBeNull();
      });

      const creds = loadCredentials(fakeStorage);
      expect(creds?.kioskId).toBe(validCredentials.kioskId);
      expect(creds?.token).toBe(validCredentials.token);

      expect(capturedUrl).toBe(`${expectedBaseUrl}/api/v1/kiosk/enroll`);
      expect(activeInstance.state.getState().enrolled).toBe(true);
      expect(activeInstance.state.getState().screen).toBe('LOADING');
    }
  });

  it('onEnroll en cas d’échec affiche l’erreur traduite et reste sur ENROLL sans sauvegarder d’identifiants', async () => {
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

    expect(input instanceof HTMLInputElement).toBe(true);
    expect(form instanceof HTMLFormElement).toBe(true);
    expect(errorDiv instanceof HTMLDivElement).toBe(true);
    expect(submitBtn instanceof HTMLButtonElement).toBe(true);

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
      expect(activeInstance.state.getState().enrolled).toBe(false);
      expect(activeInstance.state.getState().screen).toBe('ENROLL');
    }
  });

  it('« Réenrôler » appelle resetEnrollment, supprime les identifiants et réaffiche l’écran ENROLL', async () => {
    saveCredentials(fakeStorage, validCredentials);
    expect(loadCredentials(fakeStorage)).not.toBeNull();

    activeInstance = bootstrapKiosk(window, document);
    expect(activeInstance.state.getState().enrolled).toBe(true);

    await activeInstance.resetEnrollment();

    expect(loadCredentials(fakeStorage)).toBeNull();
    expect(reloadCalledCount).toBe(1);

    const input = document.getElementById('kiosk-enroll-code');
    expect(input instanceof HTMLInputElement).toBe(true);
  });

  it('dispose() résilie les abonnements sans erreur', () => {
    activeInstance = bootstrapKiosk(window, document);
    expect(() => {
      activeInstance?.dispose();
    }).not.toThrow();
  });
});
