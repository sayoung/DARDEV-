import type { LoginRequest, MeResponse } from '@xplor/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  fetchCurrentUser,
  login as requestLogin,
  login2fa as requestLogin2fa,
  logout as requestLogout,
} from '../api/client.js';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'two-factor' }
  | { status: 'authenticated'; profile: MeResponse };

type AuthContextValue = {
  state: AuthState;
  login: (input: LoginRequest) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function cleanupExpiredNotice(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get('notice') === 'expired') {
    url.searchParams.delete('notice');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void fetchCurrentUser().then(
      (profile) => {
        if (active) {
          setState({ status: 'authenticated', profile });
        }
      },
      () => {
        if (active) {
          setState({ status: 'anonymous' });
        }
      },
    );

    function onSessionExpired() {
      if (active) {
        setState({ status: 'anonymous' });
      }
    }
    window.addEventListener('session-expired', onSessionExpired);

    return () => {
      active = false;
      window.removeEventListener('session-expired', onSessionExpired);
    };
  }, []);

  const value: AuthContextValue = {
    state,
    login: (input) => {
      return requestLogin(input).then((result) => {
        if ('twoFactorRequired' in result) {
          setState({ status: 'two-factor' });
          return;
        }
        setState({ status: 'authenticated', profile: result });
        cleanupExpiredNotice();
      });
    },
    verifyTwoFactor: (code) => {
      return requestLogin2fa(code).then((profile) => {
        setState({ status: 'authenticated', profile });
        cleanupExpiredNotice();
      });
    },
    logout: () => {
      return requestLogout().then(() => {
        setState({ status: 'anonymous' });
      });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
