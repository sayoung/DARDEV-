import { useTranslation } from 'react-i18next';

export function TourNewPage() {
  const { t } = useTranslation();
  return <h2>{t('page.tourNew.title')}</h2>;
}
