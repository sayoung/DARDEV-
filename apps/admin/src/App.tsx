import { LANGS, type Lang } from '@xplor/shared';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from './auth/AuthProvider.js';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.js';
import { HomePage } from './auth/HomePage.js';
import { LoginPage } from './auth/LoginPage.js';
import { SetPasswordPage } from './auth/SetPasswordPage.js';
import { i18n } from './i18n.js';
import { applyDocumentLang, LANG_STORAGE_KEY, resolveLang } from './lang.js';
import { useAppLocation, type Notice } from './router.js';

export function App() {
  return (
    <AuthProvider>
      <AdminShell />
    </AuthProvider>
  );
}

const SUCCESS_MESSAGE = {
  reset: 'auth.setPassword.successReset',
  invite: 'auth.setPassword.successInvite',
} as const satisfies Record<
  Notice,
  'auth.setPassword.successReset' | 'auth.setPassword.successInvite'
>;

function AdminShell() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route, notice } = useAppLocation();
  const [lang, setLang] = useState<Lang>(() =>
    resolveLang(window.location.search, localStorage.getItem(LANG_STORAGE_KEY)),
  );

  useLayoutEffect(() => {
    applyDocumentLang(lang, document);
    document.title = t('common.appName');
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [lang, t]);

  function choose(next: Lang): void {
    localStorage.setItem(LANG_STORAGE_KEY, next);
    setLang(next);
  }

  return (
    <main aria-busy={auth.state.status === 'loading'}>
      <h1>{t('common.appName')}</h1>
      <nav aria-label={t('common.language.label')}>
        <ul className="language-list">
          {LANGS.map((code) => (
            <li key={code}>
              <button
                type="button"
                lang={code}
                aria-pressed={code === lang}
                onClick={() => {
                  choose(code);
                }}
              >
                {t(`common.language.${code}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {route.name === 'forgot' ? <ForgotPasswordPage /> : null}
      {route.name === 'reset' ? <SetPasswordPage kind="reset" token={route.token} /> : null}
      {route.name === 'invite' ? <SetPasswordPage kind="invite" token={route.token} /> : null}
      {route.name === 'session' && notice !== null && auth.state.status === 'anonymous' ? (
        <p className="auth-status" role="status">
          {t(SUCCESS_MESSAGE[notice])}
        </p>
      ) : null}
      {route.name === 'session' && auth.state.status === 'authenticated' ? <HomePage /> : null}
      {route.name === 'session' && auth.state.status === 'anonymous' ? <LoginPage /> : null}
    </main>
  );
}
