import { resources } from '@xplor/i18n';
import { LANGS } from '@xplor/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: resources.fr },
    ar: { translation: resources.ar },
    en: { translation: resources.en },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  supportedLngs: [...LANGS],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export { i18n };
