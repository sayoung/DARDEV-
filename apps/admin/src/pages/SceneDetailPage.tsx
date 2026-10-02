import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { SceneForm } from './SceneForm.js';
import { getScene, updateScene, createScene, deleteScene, listScenes } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type SceneResponse, type SceneCreate, z } from '@xplor/shared';
import { ApiError } from '../api/client.js';
import { PageHeader } from '../components/PageHeader.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';
import { SceneCreateSchema, SceneUpdateSchema } from '@xplor/shared';

export function SceneDetailPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();
  const tourId = route.name === 'scene-detail' ? route.tourId : '';
  const sceneId = route.name === 'scene-detail' ? route.sceneId : '';
  const isNew = sceneId === 'new';

  const [scene, setScene] = useState<SceneResponse | null>(null);
  const [weight, setWeight] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (auth.state.status === 'authenticated' && (auth.state.profile.role === Role.ADMIN || auth.state.profile.role === Role.EDITOR) && tourId) {
      if (isNew) {
        setLoading(true);
        listScenes(tourId).then((scenes) => {
          if (active) {
            setWeight(scenes.length);
            setLoading(false);
          }
        }).catch(() => {
          if (active) {
            setLoadError('common.error.generic');
            setLoading(false);
          }
        });
      } else if (sceneId) {
        setLoading(true);
        getScene(sceneId)
          .then((res) => {
            if (active) {
              setScene(res);
              setWeight(res.weight);
              setLoading(false);
            }
          })
          .catch((err: unknown) => {
            if (active) {
              if (err instanceof ApiError && err.code === 'SCENE_NOT_FOUND') {
                setNotFound(true);
              } else {
                setLoadError('common.error.generic');
              }
              setLoading(false);
            }
          });
      }
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [tourId, sceneId, isNew, auth.state]);

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  if (loading) {
    return <p className="p-4">{t('common.loading')}</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title={isNew ? t('catalog.scene.actions.add') : t('catalog.edit')} />
        <div className="text-sm font-medium text-destructive" role="alert">{t(loadError)}</div>
      </div>
    );
  }

  if ((notFound || !scene) && !isNew) {
    return (
      <div className="space-y-6">
        <p>{t('catalog.errors.sceneNotFound')}</p>
        <a
          href={hrefFor(`/tours/${tourId}`)}
          className="text-primary hover:underline"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
            event.preventDefault();
            navigate(`/tours/${tourId}`);
          }}
        >
          {t('tour.backToDetail')}
        </a>
      </div>
    );
  }

  const handleSubmit = async (data: SceneCreate) => {
    setIsSubmitting(true);
    setActionError(null);
    setSuccessKey(null);
    try {
      if (isNew) {
        const payload = SceneCreateSchema.parse(data);
        const created = await createScene(tourId, payload);
        navigate(`/tours/${tourId}/scenes/${created.id}`);
      } else {
        const payload = SceneUpdateSchema.parse(data);
        const updated = await updateScene(sceneId, payload);
        setScene(updated);
        setSuccessKey('catalog.scene.saveSuccess');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setActionError('catalog.errors.invalidForm');
      } else if (err instanceof ApiError && err.code === 'PANORAMA_ASSET_NOT_FOUND') {
        setActionError('catalog.errors.panoramaAssetNotFound');
      } else {
        setActionError('common.error.generic');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    setIsSubmitting(true);
    setActionError(null);
    setSuccessKey(null);
    try {
      await deleteScene(sceneId);
      navigate(`/tours/${tourId}`);
    } catch {
      setActionError('common.error.generic');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader 
        title={isNew ? t('catalog.scene.actions.add') : t('catalog.edit')} 
      />
      {actionError !== null && <Alert variant="destructive" role="alert">{t(actionError)}</Alert>}
      {successKey !== null && <Alert variant="default" role="status">{t(successKey)}</Alert>}
      <Card>
        <CardContent className="pt-6">
          <SceneForm
            initialData={scene}
            onSubmit={handleSubmit}
            onDelete={!isNew ? handleDelete : undefined}
            isSubmitting={isSubmitting}
            weight={weight}
          />
        </CardContent>
      </Card>
    </div>
  );
}
