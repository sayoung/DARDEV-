import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import type { Lang } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('?lang=ar donne dir=rtl et lang=ar', async () => {
    window.history.replaceState(null, '', '/?lang=ar');
    render(<App />);
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(
      await screen.findByRole('heading', { name: resources.ar.auth.login.title }),
    ).toBeTruthy();
  });

  it('le changement de langue met à jour dir', async () => {
    window.history.replaceState(null, '', '/?lang=ar');
    render(<App />);
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    fireEvent.click(buttonFor('en'));

    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    expect(
      await screen.findByRole('heading', { name: resources.en.auth.login.title }),
    ).toBeTruthy();
  });

  it('affiche la navigation avec aria-current sur la route active pour une session authentifiée', async () => {
    window.history.replaceState(null, '', '/tours');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'u1',
              email: 'a@a.com',
              name: 'Admin',
              role: 'ADMIN',
              uiLang: 'fr',
              csrfToken: 'tok',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: resources.fr.nav.label });
    expect(nav).toBeTruthy();

    const linkTours = screen.getByRole('link', { name: 'Visites' });
    expect(linkTours.getAttribute('aria-current')).toBe('page');

    const linkCities = screen.getByRole('link', { name: 'Villes' });
    expect(linkCities.getAttribute('aria-current')).toBeNull();
  });
});

