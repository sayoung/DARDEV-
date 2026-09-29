import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.js';
import { i18n } from './i18n.js';
import { LANG_STORAGE_KEY } from './lang.js';

function buttonFor(code: Lang): HTMLElement {
  const names = new Set<string>([
    resources.fr.common.language[code],
    resources.ar.common.language[code],
    resources.en.common.language[code],
  ]);
  return screen.getByRole('button', {
    name: (accessibleName) => names.has(accessibleName),
  });
}

describe('langue du back-office', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('?lang=ar donne dir=rtl et lang=ar', () => {
    window.history.replaceState(null, '', '/?lang=ar');
    render(<App />);
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('le changement de langue met à jour dir', () => {
    window.history.replaceState(null, '', '/?lang=ar');
    render(<App />);
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    fireEvent.click(buttonFor('en'));

    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });
});
