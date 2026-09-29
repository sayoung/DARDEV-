import { CategoryCreateSchema, CityCreateSchema } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { SEED_CATEGORIES, SEED_CITIES } from './seed-catalog.js';

describe('seed catalogue', () => {
  it('décrit quatre villes en français, arabe et anglais', () => {
    expect(SEED_CITIES.map((city) => city.name.fr)).toEqual(['Rabat', 'Salé', 'Kénitra', 'Témara']);
    const ids = new Set<string>();
    for (const city of SEED_CITIES) {
      expect(CityCreateSchema.parse(city)).toEqual({
        name: city.name,
        region: city.region,
        lat: city.lat,
        lng: city.lng,
      });
      expect(city.name.ar ?? '').not.toBe('');
      expect(city.name.en ?? '').not.toBe('');
      ids.add(city.id);
    }
    expect(ids.size).toBe(SEED_CITIES.length);
  });

  it('décrit six catégories en français, arabe et anglais', () => {
    expect(SEED_CATEGORIES.map((category) => category.name.fr)).toEqual([
      'Monuments',
      'Médina',
      'Plages',
      'Gastronomie',
      'Nature',
      'Artisanat',
    ]);
    const ids = new Set<string>();
    for (const category of SEED_CATEGORIES) {
      expect(CategoryCreateSchema.parse(category)).toEqual({
        name: category.name,
        icon: category.icon,
        color: category.color,
        weight: category.weight,
      });
      expect(category.name.ar ?? '').not.toBe('');
      expect(category.name.en ?? '').not.toBe('');
      ids.add(category.id);
    }
    expect(ids.size).toBe(SEED_CATEGORIES.length);
  });
});
