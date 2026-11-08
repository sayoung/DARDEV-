import { useTranslation } from 'react-i18next';

import { PageHeader } from '../components/PageHeader.js';

export function AuditPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.audit.title')}
        subtitle={t('page.audit.subtitle')}
      />
    </div>
  );
}
