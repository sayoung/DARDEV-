import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resources } from '@xplor/i18n';
import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchCurrentUser, login, login2fa } from '../api/client.js';
import { i18n } from '../i18n.js';
import { AuthProvider, useAuth } from './AuthProvider.js';
import { LoginPage } from './LoginPage.js';

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
      {state.status === 'authenticated' ? (
        <span data-testid="auth-user">{state.profile.email}</span>
      ) : null}
    </div>
  );
}

function renderLoginFlow() {
  return render(
    <AuthProvider>
      <LoginPage />
      <AuthStatusConsumer />
    </AuthProvider>,
  );
}

describe('LoginPage avec flux 2FA', () => {
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

  it('après un login renvoyant twoFactorRequired, le champ code s’affiche', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    // Formulaire de login initial
    expect(screen.getByLabelText(resources.fr.auth.login.email)).toBeTruthy();
    expect(screen.getByLabelText(resources.fr.auth.login.password)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));

    // Le champ code 2FA s'affiche
    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    expect(codeInput).toBeTruthy();
    expect(codeInput.getAttribute('inputmode')).toBe('numeric');
    expect(codeInput.getAttribute('autocomplete')).toBe('one-time-code');
    expect(codeInput.getAttribute('maxlength')).toBe('6');

    // Le bouton de vérification est présent
    const verifyButton = screen.getByRole('button', { name: resources.fr.auth.twoFactor.verify });
    expect(verifyButton).toBeTruthy();
    expect(screen.getByTestId('auth-status').textContent).toBe('two-factor');
  });

  it('un code valide mène à l’état authentifié', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    vi.mocked(login2fa).mockResolvedValue(mockProfile);

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    const verifyButton = screen.getByRole('button', { name: resources.fr.auth.twoFactor.verify });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });
    expect(screen.getByTestId('auth-user').textContent).toBe('ada@xplor.test');
    expect(vi.mocked(login2fa)).toHaveBeenCalledWith('123456');
  });

  it('un code refusé (401) affiche « Code invalide »', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    vi.mocked(login2fa).mockRejectedValue(new ApiError(401, 'INVALID_CODE'));

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.twoFactor.title }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.twoFactor.invalidCode);
    expect(screen.getByTestId('auth-status').textContent).toBe('two-factor');

    // Le bouton est à nouveau utilisable
    const verifyButton = screen.getByRole('button', { name: resources.fr.auth.twoFactor.verify });
    expect(verifyButton.hasAttribute('disabled')).toBe(false);
  });

  it('une autre erreur réseau/serveur affiche l’erreur générique auth.errors.request', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    vi.mocked(login2fa).mockRejectedValue(new ApiError(500, 'INTERNAL_SERVER_ERROR'));

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.twoFactor.title }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.fr.auth.errors.request);
    expect(screen.getByTestId('auth-status').textContent).toBe('two-factor');
  });

  it('désactive le bouton pendant la vérification du code pour éviter les doubles envois', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });

    const deferred: { resolve?: (value: MeResponse) => void } = {};
    vi.mocked(login2fa).mockImplementation(
      () =>
        new Promise<MeResponse>((resolve) => {
          deferred.resolve = resolve;
        }),
    );

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.fr.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.fr.auth.login.title }));

    const codeInput = await screen.findByLabelText(resources.fr.auth.twoFactor.code);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    const form = screen.getByRole('form', { name: resources.fr.auth.twoFactor.title });
    const verifyButton = screen.getByRole('button', { name: resources.fr.auth.twoFactor.verify });

    fireEvent.submit(form);

    expect(verifyButton.hasAttribute('disabled')).toBe(true);

    // Un deuxième submit pendant l'envoi ne déclenche pas un deuxième appel
    fireEvent.submit(form);
    expect(vi.mocked(login2fa)).toHaveBeenCalledTimes(1);

    deferred.resolve?.(mockProfile);

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
    });
  });

  it('en langue arabe (ar), affiche les libellés traduits en arabe', async () => {
    await i18n.changeLanguage('ar');
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    vi.mocked(login2fa).mockRejectedValue(new ApiError(401, 'INVALID_CODE'));

    renderLoginFlow();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('anonymous');
    });

    fireEvent.change(screen.getByLabelText(resources.ar.auth.login.email), {
      target: { value: 'ada@xplor.test' },
    });
    fireEvent.change(screen.getByLabelText(resources.ar.auth.login.password), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('form', { name: resources.ar.auth.login.title }));

    const codeInput = await screen.findByLabelText(resources.ar.auth.twoFactor.code);
    expect(codeInput).toBeTruthy();

    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.submit(screen.getByRole('form', { name: resources.ar.auth.twoFactor.title }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(resources.ar.auth.twoFactor.invalidCode);
  });
});
