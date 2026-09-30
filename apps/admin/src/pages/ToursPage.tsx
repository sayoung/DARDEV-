import { useTranslation } from 'react-i18next';

export function ToursPage() {
  const { t } = useTranslation();
  return <h2>{t('page.tours.title')}</h2>;
}
