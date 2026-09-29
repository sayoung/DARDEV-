import { dir } from '@xplor/i18n';
import { LANGS, type Lang } from '@xplor/shared';

export const LANG_STORAGE_KEY = 'xplor.lang';

function isLang(value: string | null): value is Lang {
  for (const lang of LANGS) {
    if (lang === value) {
      return true;
    }
  }
  return false;
}

export function resolveLang(search: string, stored: string | null): Lang {
  const requested = new URLSearchParams(search).get('lang');
  if (isLang(requested)) {
    return requested;
  }
  if (isLang(stored)) {
    return stored;
  }
  return 'fr';
}

export function applyDocumentLang(lang: Lang, doc: Document): void {
  doc.documentElement.setAttribute('lang', lang);
  doc.documentElement.setAttribute('dir', dir(lang));
}
