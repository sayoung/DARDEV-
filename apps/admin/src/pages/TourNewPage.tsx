import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { TourForm } from './TourForm.js';
import { createTour } from '../api/catalog.js';
import { navigate } from '../router.js';
import { Role, type TourCreate } from '@xplor/shared';
import { PageHeader } from '../components/PageHeader.js';
import { Card, CardContent } from '../components/ui/Card.js';

export function TourNewPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  const handleSubmit = async (data: TourCreate) => {
    setIsSubmitting(true);
    setGlobalError(null);
    try {
      const tour = await createTour(data);
      navigate(`/tours/${tour.id}`);
    } catch {
      setGlobalError('common.error.generic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader 
        title={t('page.tourNew.title')} 
      />
      {globalError !== null && <div className="text-sm font-medium text-destructive" role="alert">{t(globalError)}</div>}
      <Card>
        <CardContent className="pt-6">
          <TourForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>
    </div>
  );
}
