import { LANGS, type Lang } from '@xplor/shared';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { i18n } from './i18n.js';
import { applyDocumentLang, LANG_STORAGE_KEY, resolveLang } from './lang.js';

export function App() {
  const { t } = useTranslation();
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
    <main>
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
    </main>
  );
}
