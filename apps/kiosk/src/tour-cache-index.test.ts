import { describe, expect, it } from 'vitest';

import {
  createTourCacheIndex,
  DEFAULT_TOUR_CACHE_INDEX_KEY,
  type Storage,
} from './tour-cache-index.js';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('tour-cache-index', () => {
  it('renvoie un objet vide quand aucun index n’est stocké', async () => {
    const storage = new MemoryStorage();
    const index = createTourCacheIndex(storage);

    const versions = await index.versions();

    expect(versions).toEqual({});
  });

  describe('ajout (set)', () => {
    it('enregistre une visite et sa version sous la clé par défaut', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('00000000-0000-4000-8000-000000000001', 1);

      expect(await index.versions()).toEqual({
        '00000000-0000-4000-8000-000000000001': 1,
      });
      expect(storage.getItem(DEFAULT_TOUR_CACHE_INDEX_KEY)).toBe(
        JSON.stringify({
          '00000000-0000-4000-8000-000000000001': 1,
        }),
      );
    });

    it('permet d’ajouter plusieurs visites et de mettre à jour une version existante', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('tour-alpha', 1);
      await index.set('tour-beta', 2);
      expect(await index.versions()).toEqual({
        'tour-alpha': 1,
        'tour-beta': 2,
      });

      await index.set('tour-alpha', 3);
      expect(await index.versions()).toEqual({
        'tour-alpha': 3,
        'tour-beta': 2,
      });
    });

    it('refuse d’ajouter une visite avec un identifiant vide', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await expect(index.set('', 1)).rejects.toThrow();
      expect(await index.versions()).toEqual({});
    });

    it('refuse d’ajouter une version non entière', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await expect(index.set('tour-alpha', 1.5)).rejects.toThrow();
      expect(await index.versions()).toEqual({});
    });
  });

  describe('retrait (remove)', () => {
    it('retire une visite existante tout en conservant les autres', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('tour-alpha', 1);
      await index.set('tour-beta', 2);
      await index.set('tour-gamma', 3);

      await index.remove('tour-beta');

      expect(await index.versions()).toEqual({
        'tour-alpha': 1,
        'tour-gamma': 3,
      });
      expect(storage.getItem(DEFAULT_TOUR_CACHE_INDEX_KEY)).toBe(
        JSON.stringify({
          'tour-alpha': 1,
          'tour-gamma': 3,
        }),
      );
    });

    it('permet de retirer la dernière visite enregistrée', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('tour-unique', 1);
      await index.remove('tour-unique');

      expect(await index.versions()).toEqual({});
      expect(storage.getItem(DEFAULT_TOUR_CACHE_INDEX_KEY)).toBe(JSON.stringify({}));
    });

    it('ignore le retrait d’une visite qui n’est pas présente dans l’index', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('tour-alpha', 1);
      await index.remove('tour-inconnu');

      expect(await index.versions()).toEqual({
        'tour-alpha': 1,
      });
    });

    it('refuse de retirer avec un identifiant vide', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await expect(index.remove('')).rejects.toThrow();
    });
  });

  describe('JSON corrompu', () => {
    it.each([
      '{ chaine json invalide',
      'null',
      '123',
      '"simple-chaine"',
      'true',
      'false',
      '[1, 2, 3]',
      JSON.stringify({ 'tour-alpha': 'version-string' }),
      JSON.stringify({ 'tour-alpha': 1.5 }),
      JSON.stringify({ 'tour-alpha': null }),
      JSON.stringify({ '': 1 }),
    ])('renvoie un objet vide pour une valeur corrompue ou invalide : %s', async (valeurCorrompue) => {
      const storage = new MemoryStorage();
      storage.setItem(DEFAULT_TOUR_CACHE_INDEX_KEY, valeurCorrompue);

      const index = createTourCacheIndex(storage);
      const versions = await index.versions();

      expect(versions).toEqual({});
    });

    it('permet d’écrire à nouveau sainement après avoir rencontré une valeur corrompue', async () => {
      const storage = new MemoryStorage();
      storage.setItem(DEFAULT_TOUR_CACHE_INDEX_KEY, '{ json cassé');

      const index = createTourCacheIndex(storage);
      expect(await index.versions()).toEqual({});

      await index.set('tour-reparee', 4);
      expect(await index.versions()).toEqual({
        'tour-reparee': 4,
      });
      expect(storage.getItem(DEFAULT_TOUR_CACHE_INDEX_KEY)).toBe(
        JSON.stringify({ 'tour-reparee': 4 }),
      );
    });
  });

  describe('clé personnalisée et isolation', () => {
    it('utilise la clé de stockage fournie en paramètre', async () => {
      const storage = new MemoryStorage();
      const customKey = 'ma.cle.kiosk.versions';
      const index = createTourCacheIndex(storage, customKey);

      await index.set('tour-specifique', 10);

      expect(storage.getItem(DEFAULT_TOUR_CACHE_INDEX_KEY)).toBeNull();
      expect(storage.getItem(customKey)).toBe(
        JSON.stringify({ 'tour-specifique': 10 }),
      );
      expect(await index.versions()).toEqual({
        'tour-specifique': 10,
      });
    });

    it('ne modifie pas l’état interne lors de la mutation de l’objet renvoyé par versions()', async () => {
      const storage = new MemoryStorage();
      const index = createTourCacheIndex(storage);

      await index.set('tour-alpha', 1);

      const premiereLecture = await index.versions();
      delete premiereLecture['tour-alpha'];

      const secondeLecture = await index.versions();
      expect(secondeLecture).toEqual({
        'tour-alpha': 1,
      });
    });
  });
});
