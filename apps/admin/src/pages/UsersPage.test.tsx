import { cleanup, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../i18n.js';
import { UsersPage } from './UsersPage.js';

describe('UsersPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/users');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche le titre et le sous-titre de la page', () => {
    render(<UsersPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: resources.fr.page.users.title }),
    ).toBeDefined();
    expect(screen.getByText(resources.fr.page.users.subtitle)).toBeDefined();
  });
});
