import { cleanup, render, screen } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../i18n.js';
import { AuditPage } from './AuditPage.js';

describe('AuditPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/audit');
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche le titre et le sous-titre de la page', () => {
    render(<AuditPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: resources.fr.page.audit.title }),
    ).toBeDefined();
    expect(screen.getByText(resources.fr.page.audit.subtitle)).toBeDefined();
  });
});
