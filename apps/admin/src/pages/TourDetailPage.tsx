import { useState, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { TourForm } from './TourForm.js';
import { TourScenesSection } from './TourScenesSection.js';
import { TourPublicationPanel } from './TourPublicationPanel.js';
import { getTour, updateTour, deleteTour, createPreviewToken } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type TourResponse, type TourUpdate } from '@xplor/shared';
import { ApiError } from '../api/client.js';
import { PageHeader } from '../components/PageHeader.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { previewUrl } from '../lib/tour-qr.js';

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0;
}

export function TourDetailPage() {
  const { t, i18n } = useTranslation();
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
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  if (loading) {
    return <p className="p-4">{t('common.loading')}</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('page.tourDetail.title')} />
        <div className="text-sm font-medium text-destructive" role="alert">{t(loadError)}</div>
      </div>
    );
  }

  if (notFound || !tour) {
    return (
      <div className="space-y-6">
        <p>{t('tour.notFound')}</p>
        <a
          href={hrefFor('/tours')}
          className="text-primary hover:underline"
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

  const handlePreview = async () => {
    setIsSubmitting(true);
    setActionError(null);
    setSuccessKey(null);
    try {
      const res = await createPreviewToken(id);
      const webBase = typeof import.meta.env.VITE_PUBLIC_WEB_URL === 'string'
        ? import.meta.env.VITE_PUBLIC_WEB_URL
        : window.location.origin;
      const url = previewUrl(webBase, res.token, i18n.language);
      window.open(url, '_blank', 'noopener');
    } catch {
      setActionError('common.error.generic');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusText = t(`catalog.tour.status.${tour.status}`);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader 
        title={t('page.tourDetail.title')} 
        actions={
          <Button onClick={() => { void handlePreview(); }} disabled={isSubmitting}>
            {t('catalog.tours.preview.open')}
          </Button>
        }
      />
      <TourPublicationPanel tour={tour} onTourUpdated={setTour} />
      {actionError !== null && <Alert variant="destructive" role="alert">{t(actionError)}</Alert>}
      {successKey !== null && <Alert variant="default" role="status">{t(successKey)}</Alert>}
      <Card>
        <CardContent className="pt-6">
          <TourForm
            initialData={tour}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            isSubmitting={isSubmitting}
            statusText={statusText}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <TourScenesSection tour={tour} onTourUpdated={setTour} />
        </CardContent>
      </Card>
    </div>
  );
}

