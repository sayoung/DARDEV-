import { PasswordSchema } from '@xplor/shared';
import { useState, type MouseEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { acceptInvite, ApiError, resetPassword } from '../api/client.js';
import { hrefFor, navigate, type Notice } from '../router.js';

type SetPasswordErrorKey =
  | 'auth.setPassword.mismatch'
  | 'auth.errors.TOKEN_INVALID'
  | 'auth.errors.PASSWORD_TOO_COMMON'
  | 'auth.errors.PASSWORD_INVALID'
  | 'auth.errors.request';

const TITLE_KEY = {
  reset: 'auth.setPassword.titleReset',
  invite: 'auth.setPassword.titleInvite',
} as const satisfies Record<Notice, string>;

export function SetPasswordPage({ kind, token }: { kind: Notice; token: string }) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<SetPasswordErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const password = readField(data, 'password');
    const confirmation = readField(data, 'confirm');
    setErrorKey(null);
    if (password !== confirmation) {
      setErrorKey('auth.setPassword.mismatch');
      return;
    }
    if (!PasswordSchema.safeParse(password).success) {
      setErrorKey('auth.errors.PASSWORD_INVALID');
      return;
    }
    const submit = kind === 'reset' ? resetPassword : acceptInvite;
    setPending(true);
    void submit({ token, password }).then(
      () => {
        navigate('/', kind);
      },
      (error: unknown) => {
        setErrorKey(setPasswordErrorKey(error));
        setPending(false);
      },
    );
  }

  return (
    <form className="auth-form" aria-labelledby="set-password-title" onSubmit={onSubmit}>
      <h2 id="set-password-title">{t(TITLE_KEY[kind])}</h2>
      {errorKey !== null ? (
        <p className="auth-alert" role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      <div className="auth-field">
        <label htmlFor="set-password">{t('auth.setPassword.password')}</label>
        <input
          id="set-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="auth-field">
        <label htmlFor="set-password-confirm">{t('auth.setPassword.confirm')}</label>
        <input
          id="set-password-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <button type="submit" disabled={pending}>
        {t('auth.setPassword.submit')}
      </button>
      <a className="auth-link" href={hrefFor('/')} onClick={goToLogin}>
        {t('auth.setPassword.back')}
      </a>
    </form>
  );
}

function goToLogin(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) {
    return;
  }
  event.preventDefault();
  navigate('/');
}

function setPasswordErrorKey(error: unknown): SetPasswordErrorKey {
  if (error instanceof ApiError && error.status === 400) {
    if (error.code === 'TOKEN_INVALID') {
      return 'auth.errors.TOKEN_INVALID';
    }
    if (error.code === 'PASSWORD_TOO_COMMON') {
      return 'auth.errors.PASSWORD_TOO_COMMON';
    }
    if (error.code === 'PASSWORD_INVALID') {
      return 'auth.errors.PASSWORD_INVALID';
    }
  }
  return 'auth.errors.request';
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
