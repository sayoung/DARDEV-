import { ForgotPasswordRequestSchema } from '@xplor/shared';
import { useState, type MouseEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { forgotPassword } from '../api/client.js';
import { hrefFor, navigate } from '../router.js';

type ForgotErrorKey = 'auth.forgot.invalidEmail' | 'auth.errors.request';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<ForgotErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const email = readField(new FormData(event.currentTarget), 'email');
    const parsed = ForgotPasswordRequestSchema.safeParse({ email });
    setErrorKey(null);
    if (!parsed.success) {
      setErrorKey('auth.forgot.invalidEmail');
      return;
    }
    setPending(true);
    void forgotPassword(parsed.data).then(
      () => {
        setSent(true);
        setPending(false);
      },
      () => {
        setErrorKey('auth.errors.request');
        setPending(false);
      },
    );
  }

  if (sent) {
    return (
      <section className="auth-form" aria-labelledby="forgot-title">
        <h2 id="forgot-title">{t('auth.forgot.title')}</h2>
        <p className="auth-status" role="status">
          {t('auth.forgot.sent')}
        </p>
        <a className="auth-link" href={hrefFor('/')} onClick={goToLogin}>
          {t('auth.forgot.back')}
        </a>
      </section>
    );
  }

  return (
    <form className="auth-form" aria-labelledby="forgot-title" onSubmit={onSubmit}>
      <h2 id="forgot-title">{t('auth.forgot.title')}</h2>
      {errorKey !== null ? (
        <p className="auth-alert" role="alert">
          {t(errorKey)}
        </p>
      ) : null}
      <div className="auth-field">
        <label htmlFor="forgot-email">{t('auth.forgot.email')}</label>
        <input id="forgot-email" name="email" type="email" autoComplete="username" required />
      </div>
      <button type="submit" disabled={pending}>
        {t('auth.forgot.submit')}
      </button>
      <a className="auth-link" href={hrefFor('/')} onClick={goToLogin}>
        {t('auth.forgot.back')}
      </a>
    </form>
  );
}

function goToLogin(event: MouseEvent<HTMLAnchorElement>): void {
  if (isModifiedClick(event)) {
    return;
  }
  event.preventDefault();
  navigate('/');
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0;
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
