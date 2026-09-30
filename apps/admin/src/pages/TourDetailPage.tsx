import { useTranslation } from 'react-i18next';

export function TourDetailPage() {
  const { t } = useTranslation();
  return <h2>{t('page.tourDetail.title')}</h2>;
}
