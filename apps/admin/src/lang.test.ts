import { describe, expect, it } from 'vitest';

import { resolveLang } from './lang.js';

describe('resolveLang', () => {
  it('lit ?lang= avant le stockage, puis le français', () => {
    expect(resolveLang('?lang=ar', 'en')).toBe('ar');
    expect(resolveLang('', 'en')).toBe('en');
    expect(resolveLang('', null)).toBe('fr');
    expect(resolveLang('?lang=de', 'ar')).toBe('ar');
    expect(resolveLang('?lang=de', null)).toBe('fr');
  });
});
