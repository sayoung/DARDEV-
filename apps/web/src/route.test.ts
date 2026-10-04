import { describe, expect, it } from 'vitest';

import { parseShareToken, resolveLang } from './route.js';

describe('parseShareToken', () => {
  it('accepte /v/{token}', () => {
    expect(parseShareToken('/v/abcdef123')).toBe('abcdef123');
    expect(parseShareToken('/v/a')).toBe('a');
    expect(parseShareToken('/v/A-b_C-09')).toBe('A-b_C-09');
  });

  it('accepte /v/{token}/ avec un slash final', () => {
    expect(parseShareToken('/v/abcdef123/')).toBe('abcdef123');
  });

  it('retourne null pour la racine /', () => {
    expect(parseShareToken('/')).toBeNull();
  });

  it('retourne null pour /v/', () => {
    expect(parseShareToken('/v/')).toBeNull();
  });

  it('retourne null pour des chemins plus profonds comme /v/a/b', () => {
    expect(parseShareToken('/v/a/b')).toBeNull();
    expect(parseShareToken('/v/a/b/')).toBeNull();
  });

  it('retourne null pour les caractères interdits', () => {
    expect(parseShareToken('/v/abc!def')).toBeNull();
    expect(parseShareToken('/v/abc def')).toBeNull();
    expect(parseShareToken('/v/abc=def')).toBeNull();
  });

  it('retourne null pour les tokens trop longs (23 caractères ou plus)', () => {
    const token22 = 'a'.repeat(22);
    expect(parseShareToken(`/v/${token22}`)).toBe(token22);
    
    const token23 = 'a'.repeat(23);
    expect(parseShareToken(`/v/${token23}`)).toBeNull();
  });
});

describe('resolveLang', () => {
  it('retourne la langue demandée si supportée', () => {
    expect(resolveLang('?lang=ar')).toBe('ar');
    expect(resolveLang('?lang=en')).toBe('en');
    expect(resolveLang('?lang=fr')).toBe('fr');
  });

  it('retourne fr par défaut si non supportée ou absente', () => {
    expect(resolveLang('')).toBe('fr');
    expect(resolveLang('?lang=')).toBe('fr');
    expect(resolveLang('?lang=es')).toBe('fr');
    expect(resolveLang('?other=ar')).toBe('fr');
  });
});
