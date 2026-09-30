import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { TourForm } from './TourForm.js';
import { getTour, updateTour, deleteTour } from '../api/catalog.js';
import { navigate, useAppLocation } from '../router.js';
import { Role, type TourResponse, type TourUpdate } from '@xplor/shared';
import { ApiError } from '../api/client.js';

export function TourDetailPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();
  const id = route.name === 'tour-detail' ? route.id : '';

  const [tour, setTour] = useState<TourResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (auth.state.status === 'authenticated' && (auth.state.profile.role === Role.ADMIN || auth.state.profile.role === Role.EDITOR) && id) {
      setLoading(true);
      getTour(id)
        .then((res) => {
          if (active) {
            setTour(res);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            if (err instanceof ApiError && err.code === 'TOUR_NOT_FOUND') {
              setNotFound(true);
            } else {
              setGlobalError('common.error.generic');
            }
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [id, auth.state]);

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p>{t('auth.accessDenied')}</p>;
  }

  if (loading) {
    return <p>{t('common.loading')}</p>;
  }

  if (globalError) {
    return (
      <div>
        <h2>{t('page.tourDetail.title')}</h2>
        <div className="form-error" role="alert">{t(globalError)}</div>
      </div>
    );
  }

  if (notFound || !tour) {
    return (
      <div>
        <p>{t('tour.notFound')}</p>
        <button type="button" onClick={() => { navigate('/tours'); }}>{t('tour.backToList')}</button>
      </div>
    );
  }

  const handleSubmit = async (data: TourUpdate) => {
    setIsSubmitting(true);
    setGlobalError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateTour(id, data);
      setTour(updated);
      setSuccessMsg(t('tour.saveSuccess'));
    } catch {
      setGlobalError(t('common.error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setGlobalError(null);
    try {
      await deleteTour(id);
      navigate('/tours');
    } catch {
      setGlobalError(t('common.error.generic'));
      setIsSubmitting(false);
    }
  };

  const statusText = t(`catalog.tour.status.${tour.status}`);

  return (
    <div>
      <h2>{t('page.tourDetail.title')}</h2>
      {globalError && <div className="form-error" role="alert">{globalError}</div>}
      {successMsg && <div className="form-success" role="status">{successMsg}</div>}
      <TourForm
        initialData={tour}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        statusText={statusText}
      />
    </div>
  );
}
