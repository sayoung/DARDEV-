import { useState, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { TourForm } from './TourForm.js';
import { TourScenesSection } from './TourScenesSection.js';
import { getTour, updateTour, deleteTour } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type TourResponse, type TourUpdate } from '@xplor/shared';
import { ApiError } from '../api/client.js';

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0;
}

export function TourDetailPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();
  const id = route.name === 'tour-detail' ? route.id : '';

  const [tour, setTour] = useState<TourResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

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
              setLoadError('common.error.generic');
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

  if (loadError) {
    return (
      <div>
        <h2>{t('page.tourDetail.title')}</h2>
        <div className="form-error" role="alert">{t(loadError)}</div>
      </div>
    );
  }

  if (notFound || !tour) {
    return (
      <div>
        <p>{t('tour.notFound')}</p>
        <a
          href={hrefFor('/tours')}
          onClick={(event) => {
            if (isModifiedClick(event)) {
              return;
            }
            event.preventDefault();
            navigate('/tours');
          }}
        >
          {t('tour.backToList')}
        </a>
      </div>
    );
  }

  const handleSubmit = async (data: TourUpdate) => {
    setIsSubmitting(true);
    setActionError(null);
    setSuccessKey(null);
    try {
      const updated = await updateTour(id, data);
      setTour(updated);
      setSuccessKey('tour.saveSuccess');
    } catch {
      setActionError('common.error.generic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    setActionError(null);
    setSuccessKey(null);
    try {
      await deleteTour(id);
      navigate('/tours');
    } catch {
      setActionError('common.error.generic');
      setIsSubmitting(false);
    }
  };

  const statusText = t(`catalog.tour.status.${tour.status}`);

  return (
    <div>
      <h2>{t('page.tourDetail.title')}</h2>
      {actionError !== null && <div className="form-error" role="alert">{t(actionError)}</div>}
      {successKey !== null && <div className="form-success" role="status">{t(successKey)}</div>}
      <TourForm
        initialData={tour}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        statusText={statusText}
      />
      <TourScenesSection tour={tour} onTourUpdated={setTour} />
    </div>
  );
}

