import { dir, resources } from '@xplor/i18n';
import { LANGS, type Lang } from '@xplor/shared';

const APP_NAME_SLOT_ID = 'app-name';

export function resolveLang(search: string): Lang {
  const requested = new URLSearchParams(search).get('lang');
  for (const lang of LANGS) {
    if (lang === requested) {
      return lang;
    }
  }
  return 'fr';
}

export function mount(search: string, doc: Document): void {
  const lang = resolveLang(search);
  const label = resources[lang].common.appName;
  doc.documentElement.setAttribute('lang', lang);
  doc.documentElement.setAttribute('dir', dir(lang));
  doc.title = label;

  const existing = doc.getElementById(APP_NAME_SLOT_ID);
  const slot = existing ?? doc.createElement('p');
  if (existing === null) {
    slot.id = APP_NAME_SLOT_ID;
    doc.body.append(slot);
  }
  slot.textContent = label;
}
