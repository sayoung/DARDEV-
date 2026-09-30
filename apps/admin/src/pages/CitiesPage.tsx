import { useTranslation } from 'react-i18next';

export function CitiesPage() {
  const { t } = useTranslation();
  return <h2>{t('page.cities.title')}</h2>;
}
