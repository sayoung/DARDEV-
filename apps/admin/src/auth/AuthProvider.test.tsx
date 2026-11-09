import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Role, type MeResponse } from '@xplor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchCurrentUser, login, login2fa, logout } from '../api/client.js';
import { AuthProvider, useAuth } from './AuthProvider.js';

vi.mock('../api/client.js', () => ({
  fetchCurrentUser: vi.fn(),
  login: vi.fn(),
  login2fa: vi.fn(),
  logout: vi.fn(),
}));

const mockProfile: MeResponse = {
  id: 'u-1',
  email: 'ada@xplor.test',
  name: 'Ada Lovelace',
  role: Role.ADMIN,
  uiLang: 'fr',
  csrfToken: 'csrf-token-123',
  totpEnabled: false,
};

let currentAuth: ReturnType<typeof useAuth> | null = null;

function AuthCapture() {
  currentAuth = useAuth();
  return null;
}

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.state.status}</span>
      {auth.state.status === 'authenticated' && (
        <span data-testid="user-email">{auth.state.profile.email}</span>
      )}
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    currentAuth = null;
    vi.mocked(fetchCurrentUser).mockReset();
    vi.mocked(login).mockReset();
    vi.mocked(login2fa).mockReset();
    vi.mocked(logout).mockReset();
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error('unauthenticated'));
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('login avec twoFactorRequired → état two-factor', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous');
    });

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.login({ email: 'ada@xplor.test', password: 'password123' });
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('two-factor');
    if (currentAuth !== null) {
      expect(currentAuth.state.status).toBe('two-factor');
    }
  });

  it('verifyTwoFactor valide → authenticated et nettoie notice=expired', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    vi.mocked(login2fa).mockResolvedValue(mockProfile);
    window.history.replaceState(null, '', '/?notice=expired');

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous');
    });

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.login({ email: 'ada@xplor.test', password: 'password123' });
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('two-factor');
    expect(window.location.search).toBe('?notice=expired');

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.verifyTwoFactor('123456');
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user-email').textContent).toBe('ada@xplor.test');
    if (currentAuth !== null) {
      expect(currentAuth.state.status).toBe('authenticated');
      if (currentAuth.state.status === 'authenticated') {
        expect(currentAuth.state.profile).toEqual(mockProfile);
      }
    }
    expect(window.location.search).toBe('');
  });

  it('verifyTwoFactor rejeté → l\'erreur est propagée et l\'état reste two-factor', async () => {
    vi.mocked(login).mockResolvedValue({ twoFactorRequired: true });
    const authError = new Error('Code TOTP invalide');
    vi.mocked(login2fa).mockRejectedValue(authError);

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous');
    });

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.login({ email: 'ada@xplor.test', password: 'password123' });
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('two-factor');

    let thrownError: unknown = null;
    await act(async () => {
      if (currentAuth !== null) {
        try {
          await currentAuth.verifyTwoFactor('000000');
        } catch (err: unknown) {
          thrownError = err;
        }
      }
    });

    expect(thrownError).toBe(authError);
    expect(screen.getByTestId('status').textContent).toBe('two-factor');
    if (currentAuth !== null) {
      expect(currentAuth.state.status).toBe('two-factor');
    }
  });

  it('login direct sans 2FA → authenticated et nettoie notice=expired', async () => {
    vi.mocked(login).mockResolvedValue(mockProfile);
    window.history.replaceState(null, '', '/?notice=expired');

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous');
    });

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.login({ email: 'ada@xplor.test', password: 'password123' });
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('user-email').textContent).toBe('ada@xplor.test');
    expect(window.location.search).toBe('');
  });

  it('session-expired événement remet l\'état à anonymous', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(mockProfile);

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    act(() => {
      window.dispatchEvent(new Event('session-expired'));
    });

    expect(screen.getByTestId('status').textContent).toBe('anonymous');
  });

  it('logout remet l\'état à anonymous', async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(mockProfile);
    vi.mocked(logout).mockResolvedValue();

    render(
      <AuthProvider>
        <TestConsumer />
        <AuthCapture />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    await act(async () => {
      if (currentAuth !== null) {
        await currentAuth.logout();
      }
    });

    expect(screen.getByTestId('status').textContent).toBe('anonymous');
  });

  it('useAuth hors AuthProvider lance une erreur', () => {
    expect(() => {
      render(<AuthCapture />);
    }).toThrow('useAuth must be used within AuthProvider');
  });
});
