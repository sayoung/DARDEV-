import { resources } from '@xplor/i18n';
import { describe, expect, it } from 'vitest';

import { mount } from './mount.js';

describe('langue du document', () => {
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
});
