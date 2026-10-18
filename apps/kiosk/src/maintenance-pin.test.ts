import { describe, expect, it, vi } from 'vitest';

import { KioskApiError } from './api/kiosk-api.js';
import {
  createApiPinVerifier,
  createCachedPinVerifier,
  verifyPinWithContract,
  type MaintenancePinCache,
  type MaintenancePinVerifier,
  type MaintenancePinVerifierContract,
} from './maintenance-pin.js';

describe('maintenance-pin : vérification via contrat API (F-67 / D-123)', () => {
  it('bon PIN : valide avec succès le code PIN via une fonction respectant le contrat', async () => {
    let calledWith = '';
    const fnVerifier: MaintenancePinVerifier = (pin) => {
      calledWith = pin;
      return Promise.resolve(pin === '1234');
    };

    const result = await verifyPinWithContract(fnVerifier, '1234');
    expect(result).toBe(true);
    expect(calledWith).toBe('1234');
  });

  it('bon PIN : valide avec succès via un objet implémentant MaintenancePinVerifierContract', async () => {
    const objectVerifier: MaintenancePinVerifierContract = {
      verify: (pin) => Promise.resolve(pin === '1234'),
    };

    const result = await verifyPinWithContract(objectVerifier, '1234');
    expect(result).toBe(true);
  });

  it('mauvais PIN : rejette un code PIN incorrect', async () => {
    const fnVerifier: MaintenancePinVerifier = (pin) => Promise.resolve(pin === '1234');

    const result = await verifyPinWithContract(fnVerifier, '9999');
    expect(result).toBe(false);
  });

  it('vérification indisponible-absente : rejette quand le vérificateur est null ou undefined', async () => {
    expect(await verifyPinWithContract(null, '1234')).toBe(false);
    expect(await verifyPinWithContract(undefined, '1234')).toBe(false);
  });

  it('vérification indisponible-absente : rejette sans lever d’exception quand le vérificateur échoue', async () => {
    const rejectingVerifier: MaintenancePinVerifier = () =>
      Promise.reject(new Error('Réseau API indisponible'));

    const result = await verifyPinWithContract(rejectingVerifier, '1234');
    expect(result).toBe(false);
  });

  it('vérification indisponible-absente : rejette sans appeler le vérificateur quand le PIN est vide', async () => {
    let called = false;
    const fnVerifier: MaintenancePinVerifier = () => {
      called = true;
      return Promise.resolve(true);
    };

    expect(await verifyPinWithContract(fnVerifier, '')).toBe(false);
    expect(await verifyPinWithContract(fnVerifier, '   ')).toBe(false);
    expect(called).toBe(false);
  });
});

describe('createApiPinVerifier : fabrique de vérificateur connecté à l’API (F-67)', () => {
  const baseUrl = 'https://api.example.test/';
  const token = 'device-token';

  function fetchMock(response: Response): ReturnType<typeof vi.fn<typeof fetch>> {
    return vi.fn<typeof fetch>().mockResolvedValue(response);
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('renvoie true lorsque l’API confirme que le code PIN est valide', async () => {
    const fetchFn = fetchMock(jsonResponse({ valid: true }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    const result = await verifier('1234');
    expect(result).toBe(true);

    const call = fetchFn.mock.calls[0];
    expect(call?.[0]).toBe('https://api.example.test/api/v1/kiosk/maintenance/verify-pin');
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.body).toBe(JSON.stringify({ pin: '1234' }));
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('renvoie false lorsque l’API indique que le code PIN est incorrect', async () => {
    const fetchFn = fetchMock(jsonResponse({ valid: false }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    const result = await verifier('9999');
    expect(result).toBe(false);
  });

  it('propage l’erreur en cas d’erreur réseau', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    await expect(verifier('1234')).rejects.toThrow(KioskApiError);
  });

  it.each([
    [401, 'non autorisé (jeton invalide)'],
    [403, 'kiosque désactivé'],
    [500, 'erreur interne du serveur'],
  ])('propage l’erreur en cas d’erreur HTTP %i (%s)', async (status) => {
    const fetchFn = fetchMock(new Response(null, { status }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    await expect(verifier('1234')).rejects.toThrow(KioskApiError);
  });

  it('propage l’erreur lorsque la réponse de l’API est malformée', async () => {
    const fetchFn = fetchMock(jsonResponse({ unexpected: 'payload' }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    await expect(verifier('1234')).rejects.toThrow(KioskApiError);
  });

  it('renvoie false sans appeler l’API lorsque le format du PIN est invalide', async () => {
    const fetchFn = fetchMock(jsonResponse({ valid: true }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    expect(await verifier('12')).toBe(false);
    expect(await verifier('abcd')).toBe(false);
    expect(await verifier('')).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('s’intègre avec verifyPinWithContract en gérant succès, échec et panne réseau', async () => {
    const fetchOk = fetchMock(jsonResponse({ valid: true }));
    const verifierOk = createApiPinVerifier({ baseUrl, token, fetchFn: fetchOk });
    expect(await verifyPinWithContract(verifierOk, '1234')).toBe(true);

    const fetchWrong = fetchMock(jsonResponse({ valid: false }));
    const verifierWrong = createApiPinVerifier({ baseUrl, token, fetchFn: fetchWrong });
    expect(await verifyPinWithContract(verifierWrong, '9999')).toBe(false);

    const fetchOffline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network offline'));
    const verifierOffline = createApiPinVerifier({ baseUrl, token, fetchFn: fetchOffline });
    expect(await verifyPinWithContract(verifierOffline, '1234')).toBe(false);
  });
});

describe('createCachedPinVerifier : vérificateur avec cache hors-ligne (F-67)', () => {
  it('succès mémorise : appelle online, mémorise le code dans le cache et renvoie true', async () => {
    const online = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(true);
    const remember = vi.fn<(pin: string) => Promise<void>>().mockResolvedValue(undefined);
    const verify = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(false);
    const cache: MaintenancePinCache = { remember, verify };

    const verifier = createCachedPinVerifier({ online, cache });

    const result = await verifier('1234');
    expect(result).toBe(true);
    expect(online).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledWith('1234');
    expect(remember).toHaveBeenCalledTimes(1);
    expect(remember).toHaveBeenCalledWith('1234');
    expect(verify).not.toHaveBeenCalled();
  });

  it('refus ne passe pas par le cache : renvoie false sans mémoriser ni vérifier dans le cache quand online refuse', async () => {
    const online = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(false);
    const remember = vi.fn<(pin: string) => Promise<void>>().mockResolvedValue(undefined);
    const verify = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(true);
    const cache: MaintenancePinCache = { remember, verify };

    const verifier = createCachedPinVerifier({ online, cache });

    const result = await verifier('9999');
    expect(result).toBe(false);
    expect(online).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledWith('9999');
    expect(remember).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('panne réseau bascule sur le cache : bascule sur cache.verify et renvoie true si le cache valide le code', async () => {
    const online = vi.fn<(pin: string) => Promise<boolean>>().mockRejectedValue(
      new KioskApiError('NETWORK', 'Impossible de joindre le serveur kiosque.'),
    );
    const remember = vi.fn<(pin: string) => Promise<void>>().mockResolvedValue(undefined);
    const verify = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(true);
    const cache: MaintenancePinCache = { remember, verify };

    const verifier = createCachedPinVerifier({ online, cache });

    const result = await verifier('1234');
    expect(result).toBe(true);
    expect(online).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledWith('1234');
    expect(remember).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('1234');
  });

  it('panne réseau bascule sur le cache : bascule sur cache.verify et renvoie false si le cache rejette le code', async () => {
    const online = vi.fn<(pin: string) => Promise<boolean>>().mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    const remember = vi.fn<(pin: string) => Promise<void>>().mockResolvedValue(undefined);
    const verify = vi.fn<(pin: string) => Promise<boolean>>().mockResolvedValue(false);
    const cache: MaintenancePinCache = { remember, verify };

    const verifier = createCachedPinVerifier({ online, cache });

    const result = await verifier('0000');
    expect(result).toBe(false);
    expect(online).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledWith('0000');
    expect(remember).not.toHaveBeenCalled();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('0000');
  });

  it('s’intègre avec createApiPinVerifier et un cache pour un scénario complet (en ligne, panne, retour en ligne)', async () => {
    const baseUrl = 'https://api.example.test/';
    const token = 'device-token';

    let isOffline = false;
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      if (isOffline) {
        return Promise.reject(new TypeError('Network offline'));
      }
      const bodyText = typeof init?.body === 'string' ? init.body : '{}';
      const bodyParsed: unknown = JSON.parse(bodyText);
      const isCorrect =
        typeof bodyParsed === 'object' &&
        bodyParsed !== null &&
        'pin' in bodyParsed &&
        bodyParsed.pin === '1234';
      return Promise.resolve(
        new Response(JSON.stringify({ valid: isCorrect }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    let storedPin: string | null = null;
    const cache: MaintenancePinCache = {
      remember: (pin) => {
        storedPin = pin;
        return Promise.resolve();
      },
      verify: (pin) => Promise.resolve(storedPin !== null && storedPin === pin),
    };

    const onlineVerifier = createApiPinVerifier({ baseUrl, token, fetchFn });
    const cachedVerifier = createCachedPinVerifier({ online: onlineVerifier, cache });

    // 1. Succès en ligne : mémorise et valide
    expect(await cachedVerifier('1234')).toBe(true);
    expect(storedPin).toBe('1234');

    // 2. Refus en ligne : ne touche pas au cache et renvoie false
    expect(await cachedVerifier('9999')).toBe(false);
    expect(storedPin).toBe('1234');

    // 3. Panne réseau : bascule sur le cache
    isOffline = true;
    expect(await cachedVerifier('1234')).toBe(true);
    expect(await cachedVerifier('9999')).toBe(false);

    // 4. Intégration avec verifyPinWithContract en mode hors-ligne
    expect(await verifyPinWithContract(cachedVerifier, '1234')).toBe(true);
    expect(await verifyPinWithContract(cachedVerifier, '9999')).toBe(false);
  });
});
