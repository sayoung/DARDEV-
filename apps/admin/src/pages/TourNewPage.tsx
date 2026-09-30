import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { TourForm } from './TourForm.js';
import { createTour } from '../api/catalog.js';
import { navigate } from '../router.js';
import { Role, type TourCreate } from '@xplor/shared';

export function TourNewPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p>{t('auth.accessDenied')}</p>;
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
    <div>
      <h2>{t('page.tourNew.title')}</h2>
      {globalError !== null && <div className="form-error" role="alert">{t(globalError)}</div>}
      <TourForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
