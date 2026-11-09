import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type Lang } from '@xplor/shared';
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
              totpEnabled: true,
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

describe('obligation 2FA pour les administrateurs (M8 F-90)', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    document.documentElement.setAttribute('lang', 'fr');
    document.documentElement.setAttribute('dir', 'ltr');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('un ADMIN sans 2FA qui ouvre /users est redirigé vers /account/security et voit le bandeau', async () => {
    window.history.replaceState(null, '', '/users');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'u-admin-no-2fa',
                email: 'admin@xplor.test',
                name: 'Admin Sans 2FA',
                role: Role.ADMIN,
                uiLang: 'fr',
                csrfToken: 'csrf-tok',
                totpEnabled: false,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    render(<App />);

    const alertBanner = await screen.findByText(
      resources.fr.auth.twoFactorAdminAlert,
    );
    expect(alertBanner).toBeTruthy();
    expect(window.location.pathname).toBe('/account/security');
    expect(
      await screen.findByRole('heading', {
        name: resources.fr.page.accountSecurity.title,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: resources.fr.page.users.title })).toBeNull();
  });

  it('un ADMIN avec 2FA accède à /users sans bandeau', async () => {
    window.history.replaceState(null, '', '/users');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'u-admin-2fa',
                email: 'admin@xplor.test',
                name: 'Admin Avec 2FA',
                role: Role.ADMIN,
                uiLang: 'fr',
                csrfToken: 'csrf-tok',
                totpEnabled: true,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/admin/users')) {
          return Promise.resolve(
            new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: resources.fr.page.users.title,
      }),
    ).toBeTruthy();
    expect(window.location.pathname).toBe('/users');
    expect(screen.queryByText(resources.fr.auth.twoFactorAdminAlert)).toBeNull();
  });

  it("un EDITOR sans 2FA n'est pas redirigé et n'a pas de bandeau", async () => {
    window.history.replaceState(null, '', '/users');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'u-editor-no-2fa',
                email: 'editor@xplor.test',
                name: 'Editor Sans 2FA',
                role: Role.EDITOR,
                uiLang: 'fr',
                csrfToken: 'csrf-tok',
                totpEnabled: false,
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/admin/users')) {
          return Promise.resolve(
            new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: resources.fr.page.users.title,
      }),
    ).toBeTruthy();
    expect(window.location.pathname).toBe('/users');
    expect(screen.queryByText(resources.fr.auth.twoFactorAdminAlert)).toBeNull();
  });
});

