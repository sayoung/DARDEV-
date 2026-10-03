import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader.js';

export function MediaPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader 
        title={t('media.title')} 
        subtitle={t('media.subtitle')} 
      />
    </>
  );
}
