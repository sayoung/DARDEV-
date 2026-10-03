import { LANGS, type Lang, type Role } from '@xplor/shared';
import { type MouseEvent, type ReactNode, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ROLE_LABEL = {
  ADMIN: 'auth.role.ADMIN',
  EDITOR: 'auth.role.EDITOR',
  HOTEL_MANAGER: 'auth.role.HOTEL_MANAGER',
  PARTNER: 'auth.role.PARTNER',
} as const satisfies Record<Role, `auth.role.${Role}`>;

import xplorLogoWhite from '../assets/brand/xplor-logo-white.svg';
import { useAuth } from '../auth/AuthProvider.js';
import { i18n } from '../i18n.js';
import { LANG_STORAGE_KEY, applyDocumentLang, resolveLang } from '../lang.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();

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

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, path: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) {
      return;
    }
    event.preventDefault();
    navigate(path);
  }

  const isHomeActive = route.name === 'home';

  const isToursActive =
    route.name === 'tours' ||
    route.name === 'tour-new' ||
    route.name === 'tour-detail' ||
    route.name === 'scene-detail' ||
    route.name === 'hotspots' ||
    route.name === 'hotspot-new' ||
    route.name === 'hotspot-detail';

  const isCitiesActive = route.name === 'cities';
  const isCategoriesActive = route.name === 'categories';

  if (auth.state.status !== 'authenticated') {
    return (
      <main aria-busy={auth.state.status === 'loading'}>
        <div className="flex justify-end p-4">
          <nav aria-label={t('common.language.label')}>
            <ul className="flex gap-2">
              {LANGS.map((code) => (
                <li key={code}>
                  <Button
                    type="button"
                    variant={code === lang ? 'default' : 'outline'}
                    size="sm"
                    lang={code}
                    aria-pressed={code === lang}
                    onClick={() => { choose(code); }}
                  >
                    {t(`common.language.${code}`)}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="w-full md:w-64 bg-primary text-primary-foreground flex flex-col">
        <div className="p-6">
          <img src={xplorLogoWhite} alt={t('common.appName')} className="h-8" />
        </div>
        <nav aria-label={t('nav.label')} className="flex-1 px-4 py-6">
          <ul className="flex flex-row flex-wrap md:flex-col gap-2">
            <li>
              <a
                href={hrefFor('/')}
                aria-current={isHomeActive ? 'page' : undefined}
                onClick={(e) => { handleNavClick(e, '/'); }}
                className={`block px-4 py-2 rounded-md transition-colors ${isHomeActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
              >
                {t('nav.home')}
              </a>
            </li>
            <li>
              <a
                href={hrefFor('/tours')}
                aria-current={isToursActive ? 'page' : undefined}
                onClick={(e) => { handleNavClick(e, '/tours'); }}
                className={`block px-4 py-2 rounded-md transition-colors ${isToursActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
              >
                {t('nav.tours')}
              </a>
            </li>
            <li>
              <a
                href={hrefFor('/cities')}
                aria-current={isCitiesActive ? 'page' : undefined}
                onClick={(e) => { handleNavClick(e, '/cities'); }}
                className={`block px-4 py-2 rounded-md transition-colors ${isCitiesActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
              >
                {t('nav.cities')}
              </a>
            </li>
            <li>
              <a
                href={hrefFor('/categories')}
                aria-current={isCategoriesActive ? 'page' : undefined}
                onClick={(e) => { handleNavClick(e, '/categories'); }}
                className={`block px-4 py-2 rounded-md transition-colors ${isCategoriesActive ? 'bg-white/20 font-bold' : 'hover:bg-white/10'}`}
              >
                {t('nav.categories')}
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col bg-background">
        <header className="bg-card border-b border-border px-6 py-4 flex justify-between items-center">
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <nav aria-label={t('common.language.label')}>
              <ul className="flex gap-2">
                {LANGS.map((code) => (
                  <li key={code}>
                    <Button
                      type="button"
                      variant={code === lang ? 'default' : 'outline'}
                      size="sm"
                      lang={code}
                      aria-pressed={code === lang}
                      onClick={() => { choose(code); }}
                    >
                      {t(`common.language.${code}`)}
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-4 border-s border-border ps-4">
              <span className="text-sm font-medium">{auth.state.profile.name}</span>
              <Badge variant="secondary">{t(ROLE_LABEL[auth.state.profile.role])}</Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => { void auth.logout(); }}>
                {t('auth.logout')}
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6" aria-busy={false}>
          {children}
        </main>
      </div>
    </div>
  );
}
