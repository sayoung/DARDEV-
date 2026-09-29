import { describe, expect, it } from 'vitest';

import { LocalizedTextSchema, localize } from './localized-text.js';

const french = 'Bonjour';
const arabic = 'مرحبا';

describe('LocalizedTextSchema', () => {
  it('exige un français non vide', () => {
    expect(LocalizedTextSchema.safeParse({ fr: french }).success).toBe(true);
    expect(LocalizedTextSchema.safeParse({ fr: french, ar: arabic }).success).toBe(true);
    expect(LocalizedTextSchema.safeParse({ fr: '' }).success).toBe(false);
    expect(LocalizedTextSchema.safeParse({ ar: arabic }).success).toBe(false);
    expect(LocalizedTextSchema.safeParse({}).success).toBe(false);
  });
});

describe('localize', () => {
  it("se replie sur le français quand l'arabe est absent", () => {
    expect(localize({ fr: french }, 'ar')).toBe(french);
    expect(localize({ fr: french, ar: arabic }, 'ar')).toBe(arabic);
  });

  it('traite une chaîne vide comme absente', () => {
    expect(localize({ fr: french, ar: '' }, 'ar')).toBe(french);
    expect(localize({ fr: french, en: '' }, 'en')).toBe(french);
  });

  it('refuse une langue inconnue', () => {
    expect(() => localize({ fr: french }, 'de')).toThrow(/Unknown language/);
  });
});
