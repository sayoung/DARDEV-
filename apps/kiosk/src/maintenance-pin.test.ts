import { describe, expect, it } from 'vitest';

import {
  verifyPinAgainstHash,
  verifyPinWithContract,
  type MaintenancePinVerifier,
  type MaintenancePinVerifierContract,
  type SubtleDigestCrypto,
} from './maintenance-pin.js';

// SHA-256("1234") = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"
const VALID_PIN = '1234';
const VALID_HASH_HEX = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
const INVALID_PIN = '9999';

describe('maintenance-pin : verifyPinAgainstHash (Web Crypto)', () => {
  it('bon PIN : valide avec succès le code correspondant au hash hexadécimal', async () => {
    const result = await verifyPinAgainstHash(VALID_PIN, VALID_HASH_HEX);
    expect(result).toBe(true);
  });

  it('bon PIN : accepte un hash avec préfixe sha256:', async () => {
    const prefixedHash = `sha256:${VALID_HASH_HEX}`;
    const result = await verifyPinAgainstHash(VALID_PIN, prefixedHash);
    expect(result).toBe(true);
  });

  it('bon PIN : insensible à la casse du hash hexadécimal', async () => {
    const uppercaseHash = VALID_HASH_HEX.toUpperCase();
    const result = await verifyPinAgainstHash(VALID_PIN, uppercaseHash);
    expect(result).toBe(true);
  });

  it('bon PIN : gère les espaces superflus autour du PIN et du hash', async () => {
    const result = await verifyPinAgainstHash(`  ${VALID_PIN}  `, `  ${VALID_HASH_HEX}  `);
    expect(result).toBe(true);
  });

  it('mauvais PIN : rejette un code PIN incorrect', async () => {
    const result = await verifyPinAgainstHash(INVALID_PIN, VALID_HASH_HEX);
    expect(result).toBe(false);
  });

  it('mauvais PIN : rejette lorsque le hash est altéré d’un caractère', async () => {
    const alteredHash = `${VALID_HASH_HEX.slice(0, -1)}0`;
    const result = await verifyPinAgainstHash(VALID_PIN, alteredHash);
    expect(result).toBe(false);
  });

  it('mauvais PIN : rejette un hash de mauvaise longueur', async () => {
    const shortHash = '03ac674216f3e15c';
    const result = await verifyPinAgainstHash(VALID_PIN, shortHash);
    expect(result).toBe(false);
  });

  it('hash absent : rejette quand le hash est null', async () => {
    const result = await verifyPinAgainstHash(VALID_PIN, null);
    expect(result).toBe(false);
  });

  it('hash absent : rejette quand le hash est undefined', async () => {
    const result = await verifyPinAgainstHash(VALID_PIN, undefined);
    expect(result).toBe(false);
  });

  it('hash absent : rejette quand le hash est une chaîne vide ou uniquement des espaces', async () => {
    expect(await verifyPinAgainstHash(VALID_PIN, '')).toBe(false);
    expect(await verifyPinAgainstHash(VALID_PIN, '   ')).toBe(false);
  });

  it('pin absent ou vide : rejette quand le PIN est vide ou uniquement des espaces', async () => {
    expect(await verifyPinAgainstHash('', VALID_HASH_HEX)).toBe(false);
    expect(await verifyPinAgainstHash('   ', VALID_HASH_HEX)).toBe(false);
  });

  it('crypto indisponible ou erreur : gère un digest qui échoue sans lever d’exception', async () => {
    const failingCrypto: SubtleDigestCrypto = {
      digest: () => Promise.reject(new Error('Erreur matérielle WebCrypto')),
    };
    const result = await verifyPinAgainstHash(VALID_PIN, VALID_HASH_HEX, failingCrypto);
    expect(result).toBe(false);
  });
});

describe('maintenance-pin : contrat MaintenancePinVerifier (API / délégataire)', () => {
  it('bon PIN : valide avec une fonction respectant le contrat', async () => {
    let called = false;
    const fnVerifier: MaintenancePinVerifier = (pin, hash) => {
      called = true;
      return Promise.resolve(pin === '4321' && hash === 'api-hash-value');
    };

    const result = await verifyPinWithContract(fnVerifier, '4321', 'api-hash-value');
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('bon PIN : valide avec un objet implémentant MaintenancePinVerifierContract', async () => {
    const objectVerifier: MaintenancePinVerifierContract = {
      verify: (pin, hash) => Promise.resolve(pin === '4321' && hash === 'api-hash-value'),
    };

    const result = await verifyPinWithContract(objectVerifier, '4321', 'api-hash-value');
    expect(result).toBe(true);
  });

  it('mauvais PIN : rejette avec le contrat', async () => {
    const fnVerifier: MaintenancePinVerifier = (pin, hash) =>
      Promise.resolve(pin === '4321' && hash === 'api-hash-value');

    const result = await verifyPinWithContract(fnVerifier, '0000', 'api-hash-value');
    expect(result).toBe(false);
  });

  it('hash absent : rejette immédiatement sans appeler le contrat quand hash est null', async () => {
    let delegateCalled = false;
    const fnVerifier: MaintenancePinVerifier = () => {
      delegateCalled = true;
      return Promise.resolve(true);
    };

    const result = await verifyPinWithContract(fnVerifier, '1234', null);
    expect(result).toBe(false);
    expect(delegateCalled).toBe(false);
  });

  it('hash absent : rejette immédiatement sans appeler le contrat quand hash est undefined', async () => {
    let delegateCalled = false;
    const fnVerifier: MaintenancePinVerifier = () => {
      delegateCalled = true;
      return Promise.resolve(true);
    };

    const result = await verifyPinWithContract(fnVerifier, '1234', undefined);
    expect(result).toBe(false);
    expect(delegateCalled).toBe(false);
  });

  it('hash absent : rejette immédiatement quand le hash est vide', async () => {
    let delegateCalled = false;
    const fnVerifier: MaintenancePinVerifier = () => {
      delegateCalled = true;
      return Promise.resolve(true);
    };

    const result = await verifyPinWithContract(fnVerifier, '1234', '   ');
    expect(result).toBe(false);
    expect(delegateCalled).toBe(false);
  });

  it('pin vide : rejette sans appeler le contrat quand le PIN est vide', async () => {
    let delegateCalled = false;
    const fnVerifier: MaintenancePinVerifier = () => {
      delegateCalled = true;
      return Promise.resolve(true);
    };

    const result = await verifyPinWithContract(fnVerifier, '  ', 'some-hash');
    expect(result).toBe(false);
    expect(delegateCalled).toBe(false);
  });

  it('erreur contrat : intercepte les rejets sans propager d’exception', async () => {
    const rejectingVerifier: MaintenancePinVerifier = () =>
      Promise.reject(new Error('Réseau indisponible'));

    const result = await verifyPinWithContract(rejectingVerifier, '1234', 'some-hash');
    expect(result).toBe(false);
  });
});
