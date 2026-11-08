import { useTranslation } from 'react-i18next';

import { PageHeader } from '../components/PageHeader.js';

export function UsersPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.users.title')}
        subtitle={t('page.users.subtitle')}
      />
    </div>
  );
}
