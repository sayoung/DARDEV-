import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchCurrentUser, login, login2fa } from '../api/client.js';
import { i18n } from '../i18n.js';
import { AuthProvider, useAuth } from './AuthProvider.js';
import { TwoFactorStep } from './TwoFactorStep.js';

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    fetchCurrentUser: vi.fn(),
    login: vi.fn(),
    login2fa: vi.fn(),
  };
});

const mockProfile: MeResponse = {
  id: 'u-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-123',
  totpEnabled: false,
};

function AuthStatusConsumer() {
  const { state } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{state.status}</span>
    </div>
  );
}

function renderTwoFactorStep() {
  return render(
    <AuthProvider>
      <TwoFactorStep />
      <AuthStatusConsumer />
    </AuthProvider>,
  );
}

describe('TwoFactorStep', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    vi.mocked(fetchCurrentUser).mockReset();
    vi.mocked(login).mockReset();
    vi.mocked(login2fa).mockReset();
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error('unauthenticated'));
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche le formulaire avec les attributs d’accessibilité et de saisie attendus', async () => {
    renderTwoFactorStep();

    expect(await screen.findByRole('heading', { name: resources.fr.auth.twoFactor.title })).toBeTruthy();
    const input = screen.getByLabelText(resources.fr.auth.twoFactor.code);
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('maxlength')).toBe('6');
    expect(input.getAttribute('required')).not.toBeNull();
    expect(input.getAttribute('aria-required')).toBe('true');

    const button = screen.getByRole('button', { name: resources.fr.auth.twoFactor.verify });
    expect(button).toBeTruthy();
    expect(button.getAttribute('type')).toBe('submit');
  });

  it('sur code valide, appelle verifyTwoFactor et passe à l’état authentifié', async () => {
    vi.mocked(login2fa).mockResolvedValue(mockProfile);
    renderTwoFactorStep();

    const input = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(input, { target: { value: '654321' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.twoFactor.title }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });
    expect(vi.mocked(login2fa)).toHaveBeenCalledWith('654321');
  });

  it('sur erreur 401 ApiError, affiche auth.twoFactor.invalidCode', async () => {
    vi.mocked(login2fa).mockRejectedValue(new ApiError(401, 'INVALID_CODE'));
    renderTwoFactorStep();

    const input = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(input, { target: { value: '000000' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.twoFactor.title }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.twoFactor.invalidCode);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('sur erreur autre que 401, affiche auth.errors.request', async () => {
    vi.mocked(login2fa).mockRejectedValue(new Error('Network error'));
    renderTwoFactorStep();

    const input = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(input, { target: { value: '111111' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.twoFactor.title }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.errors.request);
  });
});
