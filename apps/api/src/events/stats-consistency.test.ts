import { describe, expect, it } from 'vitest';

import {
  checkStatsConsistency,
  type StatsConsistencyInput,
} from './stats-consistency.js';

describe('checkStatsConsistency (M7 F-81 / F-82)', () => {
  it('cas cohérent : valide un jeu de données où toutes les sommes correspondent', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 50,
        VR: 30,
        WEB: 20,
      },
      byLanguage: {
        fr: 60,
        ar: 25,
        en: 15,
      },
      hotels: [
        { id: 'hotel-a', total: 40 },
        { id: 'hotel-b', total: 35 },
      ],
      globalTotal: 100,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('cas cohérent : valide lorsque tous les événements ont un hôtel et que la somme est égale au total global', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 50,
        VR: 30,
        WEB: 20,
      },
      byLanguage: {
        fr: 70,
        ar: 20,
        en: 10,
      },
      hotels: [
        { id: 'hotel-a', total: 60 },
        { id: 'hotel-b', total: 40 },
      ],
      globalTotal: 100,
      allEventsHaveHotel: true,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('écart canal : détecte lorsque la somme des canaux est différente du total', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 40,
        VR: 30,
        WEB: 20, // Somme = 90 (attendu 100)
      },
      byLanguage: {
        fr: 60,
        ar: 25,
        en: 15,
      },
      hotels: [
        { id: 'hotel-a', total: 50 },
        { id: 'hotel-b', total: 30 },
      ],
      globalTotal: 100,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Écart canal');
    expect(result.errors[0]).toContain('90');
    expect(result.errors[0]).toContain('100');
  });

  it('écart langue : détecte lorsque la somme des langues est différente du total', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 50,
        VR: 30,
        WEB: 20,
      },
      byLanguage: {
        fr: 50,
        ar: 25,
        en: 15, // Somme = 90 (attendu 100)
      },
      hotels: [
        { id: 'hotel-a', total: 50 },
        { id: 'hotel-b', total: 30 },
      ],
      globalTotal: 100,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Écart langue');
    expect(result.errors[0]).toContain('90');
    expect(result.errors[0]).toContain('100');
  });

  it('écart hôtel : détecte lorsque la somme des totaux par hôtel dépasse le total global', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 50,
        VR: 30,
        WEB: 20,
      },
      byLanguage: {
        fr: 60,
        ar: 25,
        en: 15,
      },
      hotels: [
        { id: 'hotel-a', total: 60 },
        { id: 'hotel-b', total: 50 }, // Somme = 110 > 100
      ],
      globalTotal: 100,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Écart hôtel');
    expect(result.errors[0]).toContain('110');
    expect(result.errors[0]).toContain('100');
  });

  it('écart hôtel : détecte lorsque tous les événements ont un hôtel mais la somme ne correspond pas au total global', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        KIOSK: 50,
        VR: 30,
        WEB: 20,
      },
      byLanguage: {
        fr: 60,
        ar: 25,
        en: 15,
      },
      hotels: [
        { id: 'hotel-a', total: 40 },
        { id: 'hotel-b', total: 30 }, // Somme = 70 (attendu 100)
      ],
      globalTotal: 100,
      allEventsHaveHotel: true,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Écart hôtel');
    expect(result.errors[0]).toContain('70');
    expect(result.errors[0]).toContain('100');
  });

  it('écart hôtel : respecte l option allEventsHaveHotel transmise en second argument', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        WEB: 100,
      },
      byLanguage: {
        fr: 100,
      },
      hotels: [
        { id: 'hotel-a', total: 40 },
      ],
      globalTotal: 100,
    };

    // Sans option : somme <= globalTotal (40 <= 100) -> valide
    const resultLoose = checkStatsConsistency(input);
    expect(resultLoose.ok).toBe(true);

    // Avec option allEventsHaveHotel=true : somme == globalTotal (40 différent de 100) -> écart
    const resultStrict = checkStatsConsistency(input, { allEventsHaveHotel: true });
    expect(resultStrict.ok).toBe(false);
    expect(resultStrict.errors[0]).toContain('Écart hôtel');
  });

  it('jeu vide : valide lorsque toutes les métriques sont à zéro', () => {
    const input: StatsConsistencyInput = {
      total: 0,
      byChannel: {},
      byLanguage: {},
      hotels: [],
      globalTotal: 0,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('jeu vide : valide également avec allEventsHaveHotel=true', () => {
    const input: StatsConsistencyInput = {
      total: 0,
      byChannel: {},
      byLanguage: {},
      hotels: [],
      globalTotal: 0,
      allEventsHaveHotel: true,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('cumul d écarts : signale simultanément les écarts sur canal, langue et hôtel', () => {
    const input: StatsConsistencyInput = {
      total: 100,
      byChannel: {
        WEB: 80, // 80 (attendu 100)
      },
      byLanguage: {
        fr: 75, // 75 (attendu 100)
      },
      hotels: [
        { id: 'hotel-a', total: 80 },
        { id: 'hotel-b', total: 50 }, // 130 > 100
      ],
      globalTotal: 100,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.some((e) => e.includes('canal'))).toBe(true);
    expect(result.errors.some((e) => e.includes('langue'))).toBe(true);
    expect(result.errors.some((e) => e.includes('hôtel'))).toBe(true);
  });

  it('validation des données : rejette une entrée avec des valeurs numériques invalides', () => {
    const input: StatsConsistencyInput = {
      total: -10,
      byChannel: {},
      byLanguage: {},
      hotels: [],
      globalTotal: 0,
    };

    const result = checkStatsConsistency(input);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Données invalides');
  });
});
