import { dir, resources } from '@xplor/i18n';
import { LANGS, type Lang } from '@xplor/shared';

const APP_NAME_SLOT_ID = 'app-name';

export { dir };
export type { Lang };

export function resolveLang(search: string): Lang {
  const requested = new URLSearchParams(search).get('lang');
  for (const lang of LANGS) {
    if (lang === requested) {
      return lang;
    }
  }
  return 'fr';
}

export function applyDocumentLanguage(doc: Document, lang: Lang): void {
  doc.documentElement.setAttribute('lang', lang);
  doc.documentElement.setAttribute('dir', dir(lang));
  doc.title = resources[lang].common.appName;
}

export const applyDocumentLang = applyDocumentLanguage;

export function mount(search: string, doc: Document): void {
  const lang = resolveLang(search);
  applyDocumentLanguage(doc, lang);

  const label = resources[lang].common.appName;
  const existing = doc.getElementById(APP_NAME_SLOT_ID);
  const slot = existing ?? doc.createElement('p');
  if (existing === null) {
    slot.id = APP_NAME_SLOT_ID;
    doc.body.append(slot);
  }
  slot.textContent = label;
}
