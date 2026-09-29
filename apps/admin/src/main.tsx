import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { i18n } from './i18n.js';
import { applyDocumentLang, LANG_STORAGE_KEY, resolveLang } from './lang.js';

const lang = resolveLang(window.location.search, localStorage.getItem(LANG_STORAGE_KEY));
await i18n.changeLanguage(lang);
applyDocumentLang(lang, document);
document.title = i18n.t('common.appName');

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
