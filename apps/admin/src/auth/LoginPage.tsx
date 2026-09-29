import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { isAccountLocked, isInvalidCredentials } from '../api/client.js';
import { useAuth } from './AuthProvider.js';

type LoginErrorKey = 'auth.login.error' | 'auth.login.locked' | 'auth.login.failed';

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = readField(data, 'email');
    const password = readField(data, 'password');
    setErrorKey(null);
    setPending(true);
    void auth.login({ email, password }).catch((error: unknown) => {
      setErrorKey(loginErrorKey(error));
      setPending(false);
    });
  }

  return (
    <form className="auth-form" aria-labelledby="login-title" onSubmit={onSubmit}>
      <h2 id="login-title">{t('auth.login.title')}</h2>
      {errorKey !== null ? (
        <p className="auth-alert" role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      <div className="auth-field">
        <label htmlFor="login-email">{t('auth.login.email')}</label>
        <input id="login-email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="auth-field">
        <label htmlFor="login-password">{t('auth.login.password')}</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" disabled={pending}>
        {t('auth.login.submit')}
      </button>
    </form>
  );
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function loginErrorKey(error: unknown): LoginErrorKey {
  if (isAccountLocked(error)) {
    return 'auth.login.locked';
  }
  if (isInvalidCredentials(error)) {
    return 'auth.login.error';
  }
  return 'auth.login.failed';
}
