import { describe, expect, it, vi } from 'vitest';

import {
  isServiceWorkerNavigator,
  registerServiceWorker,
  type ServiceWorkerRegistrationLike,
} from './register-sw.js';

describe('registerServiceWorker (M5 F-62)', () => {
  it('enregistre le service worker par défaut (/sw.js) avec succès', async () => {
    const fakeRegistration: ServiceWorkerRegistrationLike = { scope: '/' };
    const registerMock = vi.fn().mockResolvedValue(fakeRegistration);
    const fakeNav = {
      serviceWorker: {
        register: registerMock,
      },
    };

    const result = await registerServiceWorker(fakeNav);

    expect(registerMock).toHaveBeenCalledWith('/sw.js');
    expect(result).toBe(fakeRegistration);
  });

  it('permet de spécifier un chemin de script personnalisé', async () => {
    const fakeRegistration: ServiceWorkerRegistrationLike = { scope: '/custom' };
    const registerMock = vi.fn().mockResolvedValue(fakeRegistration);
    const fakeNav = {
      serviceWorker: {
        register: registerMock,
      },
    };

    const result = await registerServiceWorker(fakeNav, '/custom-sw.js');

    expect(registerMock).toHaveBeenCalledWith('/custom-sw.js');
    expect(result).toBe(fakeRegistration);
  });

  it('gère l’échec d’enregistrement sans lever d’exception et renvoie null', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registerMock = vi
      .fn()
      .mockRejectedValue(new Error('SecurityError: Insecure context'));
    const fakeNav = {
      serviceWorker: {
        register: registerMock,
      },
    };

    const result = await registerServiceWorker(fakeNav);

    expect(registerMock).toHaveBeenCalledWith('/sw.js');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('renvoie null si navigator est null ou non-objet', async () => {
    expect(await registerServiceWorker(null)).toBeNull();
    expect(await registerServiceWorker(undefined)).toBeNull();
    expect(await registerServiceWorker('not-an-object')).toBeNull();
    expect(await registerServiceWorker(42)).toBeNull();
  });

  it('renvoie null si serviceWorker n’est pas présent dans navigator', async () => {
    const fakeNavWithoutSw = {
      userAgent: 'Mozilla/5.0 FakeBrowser',
    };

    const result = await registerServiceWorker(fakeNavWithoutSw);

    expect(result).toBeNull();
  });

  it('renvoie null si serviceWorker n’est pas un objet ou ne possède pas la méthode register', async () => {
    expect(await registerServiceWorker({ serviceWorker: null })).toBeNull();
    expect(await registerServiceWorker({ serviceWorker: true })).toBeNull();
    expect(await registerServiceWorker({ serviceWorker: {} })).toBeNull();
    expect(
      await registerServiceWorker({
        serviceWorker: { register: 'not-a-function' },
      }),
    ).toBeNull();
  });

  describe('isServiceWorkerNavigator', () => {
    it('renvoie true pour un objet navigateur conforme', () => {
      const validNav = {
        serviceWorker: {
          register: () => Promise.resolve({ scope: '/' }),
        },
      };
      expect(isServiceWorkerNavigator(validNav)).toBe(true);
    });

    it('renvoie false pour des valeurs invalides ou incomplètes', () => {
      expect(isServiceWorkerNavigator(null)).toBe(false);
      expect(isServiceWorkerNavigator(undefined)).toBe(false);
      expect(isServiceWorkerNavigator({})).toBe(false);
      expect(isServiceWorkerNavigator({ serviceWorker: null })).toBe(false);
      expect(isServiceWorkerNavigator({ serviceWorker: {} })).toBe(false);
    });
  });
});
