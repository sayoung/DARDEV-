import { LANGS, type Lang } from '@xplor/shared';

const NATIVE_LABELS: Record<Lang, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English'
};

function isLang(v: string): v is Lang {
  return v === 'fr' || v === 'ar' || v === 'en';
}

export function createLangSwitcher(
  doc: Document,
  current: Lang,
  label: string,
  onChange: (lang: Lang) => void
): { destroy(): void } {
  const select = doc.createElement('select');
  select.id = 'lang-switcher';
  select.setAttribute('aria-label', label);

  for (const lang of LANGS) {
    const option = doc.createElement('option');
    option.value = lang;
    option.textContent = NATIVE_LABELS[lang];
    if (lang === current) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  const handleChange = (e: Event) => {
    const target = e.target;
    if (target instanceof HTMLSelectElement) {
      const val = target.value;
      if (isLang(val)) {
        onChange(val);
      }
    }
  };

  select.addEventListener('change', handleChange);
  doc.body.appendChild(select);

  return {
    destroy() {
      select.removeEventListener('change', handleChange);
      select.remove();
    }
  };
}
