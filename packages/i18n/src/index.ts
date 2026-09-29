import type { Lang } from '@xplor/shared';

import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

export const resources = { fr, ar, en } as const;

export function isRtl(lang: Lang): boolean {
  return lang === 'ar';
}

export function dir(lang: Lang): 'rtl' | 'ltr' {
  return isRtl(lang) ? 'rtl' : 'ltr';
}
