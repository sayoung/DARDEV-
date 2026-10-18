import { describe, expect, it } from 'vitest';

import {
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
