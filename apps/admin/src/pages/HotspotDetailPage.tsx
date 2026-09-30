import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getScene, listScenes, getHotspot, createHotspot, updateHotspot } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type HotspotCreate, type HotspotResponse, type SceneResponse } from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { PageHeader } from '../components/PageHeader.js';
import { HotspotForm } from './HotspotForm.js';
import { ApiError } from '../api/client.js';

export function HotspotDetailPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();
  const tourId = (route.name === 'hotspot-detail' || route.name === 'hotspot-new') ? route.tourId : '';
  const sceneId = (route.name === 'hotspot-detail' || route.name === 'hotspot-new') ? route.sceneId : '';
  const hotspotId = route.name === 'hotspot-detail' ? route.id : undefined;

  const [scene, setScene] = useState<SceneResponse | null>(null);
  const [currentTourScenes, setCurrentTourScenes] = useState<SceneResponse[]>([]);
  const [hotspot, setHotspot] = useState<HotspotResponse | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (auth.state.status === 'authenticated' && (auth.state.profile.role === Role.ADMIN || auth.state.profile.role === Role.EDITOR) && tourId && sceneId) {
      Promise.all([
        getScene(sceneId),
        listScenes(tourId),
        hotspotId ? getHotspot(hotspotId) : Promise.resolve(null)
      ])
        .then(([resScene, resScenes, resHotspot]) => {
          if (active) {
            setScene(resScene);
            setCurrentTourScenes(resScenes);
            if (resHotspot) setHotspot(resHotspot);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            if (err instanceof ApiError && err.status === 404) {
              setLoadError('catalog.errors.notFound');
            } else {
              setLoadError('catalog.errors.generic');
            }
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [tourId, sceneId, hotspotId, auth.state]);

  const handleSubmit = async (data: HotspotCreate) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      if (hotspotId) {
        await updateHotspot(hotspotId, data);
      } else {
        await createHotspot(sceneId, data);
      }
      navigate(`/tours/${tourId}/scenes/${sceneId}/hotspots`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setActionError('catalog.errors.invalidForm');
        } else {
          setActionError('catalog.errors.generic');
        }
      } else {
        setActionError('catalog.errors.generic');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  if (loading) {
    return <p className="p-4">{t('common.loading')}</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title={hotspotId ? t('catalog.hotspots.edit') : t('catalog.hotspots.add')} />
        <div className="text-sm font-medium text-destructive" role="alert">{t(loadError)}</div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="space-y-6">
        <p>{t('catalog.errors.sceneNotFound')}</p>
        <a
          href={hrefFor(`/tours/${tourId}/scenes/${sceneId}/hotspots`)}
          className="text-primary hover:underline"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
            event.preventDefault();
            navigate(`/tours/${tourId}/scenes/${sceneId}/hotspots`);
          }}
        >
          {t('catalog.hotspots.backToList')}
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <a
          href={hrefFor(`/tours/${tourId}/scenes/${sceneId}/hotspots`)}
          className="text-sm text-muted-foreground hover:text-foreground mb-1 block"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
            event.preventDefault();
            navigate(`/tours/${tourId}/scenes/${sceneId}/hotspots`);
          }}
        >
          &larr; {t('catalog.hotspots.backToList')}
        </a>
      </div>

      <PageHeader title={hotspotId ? t('catalog.hotspots.edit') : t('catalog.hotspots.add')} />

      {actionError && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm" role="alert">
          {t(actionError)}
        </div>
      )}

      <HotspotForm
        initialData={hotspot}
        currentTourScenes={currentTourScenes}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
