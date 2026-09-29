import type { LoginRequest, MeResponse } from '@xplor/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchCurrentUser, login as requestLogin, logout as requestLogout } from '../api/client.js';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; profile: MeResponse };

type AuthContextValue = {
  state: AuthState;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    return () => {
      active = false;
    };
  }, []);

  const value: AuthContextValue = {
    state,
    login: (input) => {
      return requestLogin(input).then((profile) => {
        setState({ status: 'authenticated', profile });
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
