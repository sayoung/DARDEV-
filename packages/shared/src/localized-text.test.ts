import { describe, expect, it } from 'vitest';

import { LocalizedTextSchema, localize, localizedText } from './localized-text.js';

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

describe('localizedText', () => {
  it('limite fr, ar et en quand max est fourni', () => {
    const schema = localizedText({ max: 500 });
    const within = 'ا'.repeat(500);
    expect(schema.safeParse({ fr: 'a'.repeat(500), ar: within, en: 'a'.repeat(500) }).success).toBe(
      true,
    );
    expect(schema.safeParse({ fr: 'ok', ar: '' }).success).toBe(true);
    expect(schema.safeParse({ fr: 'a'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ fr: 'ok', ar: 'ا'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ fr: 'ok', en: 'a'.repeat(501) }).success).toBe(false);
  });

  it('sans max, accepte un texte plus long que 500 caractères', () => {
    expect(localizedText().safeParse({ fr: 'a'.repeat(501) }).success).toBe(true);
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
