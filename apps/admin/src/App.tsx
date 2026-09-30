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
import { useAppLocation, type Notice, hrefFor, navigate } from './router.js';

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

  const isPublicRoute = route.name === 'forgot' || route.name === 'reset' || route.name === 'invite';
  const isAuthenticatedRoute = !isPublicRoute;
  const isAnonymous = auth.state.status === 'anonymous';
  const isAuthenticated = auth.state.status === 'authenticated';

  return (
    <main aria-busy={auth.state.status === 'loading'}>
      <h1>{t('common.appName')}</h1>
      
      {isAuthenticated && (
        <nav aria-label={t('common.appName')}>
          <ul className="nav-list">
            <li>
              <a
                href={hrefFor('/tours')}
                aria-current={route.name === 'tours' || route.name === 'tour-new' || route.name === 'tour-detail' ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); navigate('/tours'); }}
              >
                {t('nav.tours')}
              </a>
            </li>
            <li>
              <a
                href={hrefFor('/cities')}
                aria-current={route.name === 'cities' ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); navigate('/cities'); }}
              >
                {t('nav.cities')}
              </a>
            </li>
            <li>
              <a
                href={hrefFor('/categories')}
                aria-current={route.name === 'categories' ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); navigate('/categories'); }}
              >
                {t('nav.categories')}
              </a>
            </li>
          </ul>
        </nav>
      )}

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
      
      {isAuthenticatedRoute && isAnonymous && notice !== null ? (
        <p className="auth-status" role="status">
          {t(SUCCESS_MESSAGE[notice])}
        </p>
      ) : null}

      {isAuthenticatedRoute && isAnonymous ? <LoginPage /> : null}

      {isAuthenticated && route.name === 'home' ? <HomePage /> : null}
      {isAuthenticated && route.name === 'cities' ? <h2>{t('page.cities.title')}</h2> : null}
      {isAuthenticated && route.name === 'categories' ? <h2>{t('page.categories.title')}</h2> : null}
      {isAuthenticated && route.name === 'tours' ? <h2>{t('page.tours.title')}</h2> : null}
      {isAuthenticated && route.name === 'tour-new' ? <h2>{t('page.tourNew.title')}</h2> : null}
      {isAuthenticated && route.name === 'tour-detail' ? <h2>{t('page.tourDetail.title')}</h2> : null}

    </main>
  );
}
