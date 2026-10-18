import { resources } from '@xplor/i18n';
import { describe, expect, it } from 'vitest';

import {
  applyDocumentLang,
  applyDocumentLanguage,
  mount,
  resolveLang,
} from './mount.js';

describe('langue du document (mount.ts)', () => {
  it('pose lang=ar et dir=rtl pour ?lang=ar', () => {
    mount('?lang=ar', document);
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.title).toBe(resources.ar.common.appName);
    expect(document.getElementById('app-name')?.textContent).toBe(resources.ar.common.appName);
  });

  it('utilise le français et ltr sans paramètre lang', () => {
    mount('', document);
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.getElementById('app-name')?.textContent).toBe(resources.fr.common.appName);
  });

  it('resolveLang extrait la langue supportée ou replie sur fr par défaut', () => {
    expect(resolveLang('?lang=ar')).toBe('ar');
    expect(resolveLang('?lang=en')).toBe('en');
    expect(resolveLang('?lang=fr')).toBe('fr');
    expect(resolveLang('?lang=inconnue')).toBe('fr');
    expect(resolveLang('')).toBe('fr');
  });

  it('applyDocumentLanguage applique lang, dir et document.title', () => {
    applyDocumentLanguage(document, 'ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.title).toBe(resources.ar.common.appName);

    applyDocumentLanguage(document, 'fr');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.title).toBe(resources.fr.common.appName);

    applyDocumentLanguage(document, 'en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.title).toBe(resources.en.common.appName);
  });

  it('applyDocumentLang est un alias fonctionnel de applyDocumentLanguage', () => {
    applyDocumentLang(document, 'ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.title).toBe(resources.ar.common.appName);
  });
});
