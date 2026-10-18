import { describe, expect, it, vi } from 'vitest';

import {
  createApiPinVerifier,
  verifyPinWithContract,
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

  it('renvoie false en cas d’erreur réseau sans lever d’exception', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    const result = await verifier('1234');
    expect(result).toBe(false);
  });

  it.each([
    [401, 'non autorisé (jeton invalide)'],
    [403, 'kiosque désactivé'],
    [500, 'erreur interne du serveur'],
  ])('renvoie false en cas d’erreur HTTP %i (%s) sans lever d’exception', async (status) => {
    const fetchFn = fetchMock(new Response(null, { status }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    const result = await verifier('1234');
    expect(result).toBe(false);
  });

  it('renvoie false sans lever d’exception lorsque la réponse de l’API est malformée', async () => {
    const fetchFn = fetchMock(jsonResponse({ unexpected: 'payload' }));
    const verifier = createApiPinVerifier({ baseUrl, token, fetchFn });

    const result = await verifier('1234');
    expect(result).toBe(false);
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
