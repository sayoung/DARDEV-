import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { SceneForm } from './SceneForm.js';
import { HotspotForm } from './HotspotForm.js';
import { getScene, updateScene, createScene, deleteScene, listScenes, getAsset, listHotspots, createHotspot, deleteHotspot } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type SceneResponse, type SceneCreate, type HotspotCreate, z, ProcessingStatus } from '@xplor/shared';
import { ApiError } from '../api/client.js';
import { PageHeader } from '../components/PageHeader.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { SceneCreateSchema, SceneUpdateSchema } from '@xplor/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs.js';
import { SceneEditor360 } from '../components/SceneEditor360.js';
import { editorMarkers, editorPanorama, type EditorMarker, type EditorPanorama } from '@xplor/viewer-core';

function normalizeLang(lang: string): 'fr' | 'ar' | 'en' {
  if (lang === 'ar' || lang === 'en') {
    return lang;
  }
  return 'fr';
}

function SceneEditorTab({ scene }: { scene: SceneResponse }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [panorama, setPanorama] = useState<EditorPanorama | null>(null);
  const [hotspots, setHotspots] = useState<EditorMarker[]>([]);

  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [draftPosition, setDraftPosition] = useState<{ yaw: number; pitch: number } | null>(null);
  const [currentTourScenes, setCurrentTourScenes] = useState<SceneResponse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listScenes(scene.tourId).then((res) => {
      if (active) setCurrentTourScenes(res);
    }).catch(console.error);
    return () => { active = false; };
  }, [scene.tourId]);

  const loadHotspots = () => {
    listHotspots(scene.id).then((hotspotsRes) => {
      const lang = normalizeLang(i18n.language);
      setHotspots(editorMarkers(hotspotsRes, lang));
    }).catch(() => {
      setActionError('common.error.generic');
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotReady(false);
    setError(null);

    Promise.all([
      getAsset(scene.panoramaAssetId),
      listHotspots(scene.id)
    ]).then(([asset, hotspotsRes]) => {
      if (!active) return;
      if (asset.processingStatus !== ProcessingStatus.READY) {
        setNotReady(true);
        setLoading(false);
        return;
      }
      try {
        const pan = editorPanorama(asset);
        const lang = normalizeLang(i18n.language);
        const marks = editorMarkers(hotspotsRes, lang);
        setPanorama(pan);
        setHotspots(marks);
      } catch {
        setError('common.error.generic');
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError('common.error.generic');
      setLoading(false);
    });

    return () => { active = false; };
  }, [scene.id, scene.panoramaAssetId, i18n.language]);

  const handleCreateHotspot = async (data: HotspotCreate) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await createHotspot(scene.id, data);
      setDraftPosition(null);
      loadHotspots();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 422) {
        setActionError('catalog.errors.invalidForm');
      } else {
        setActionError('common.error.generic');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <p className="p-4">{t('common.loading')}</p>;
  }

  if (error) {
    return <Alert variant="destructive">{t(error)}</Alert>;
  }

  if (notReady) {
    return <Alert variant="destructive">{t('catalog.errors.panoramaNotReady')}</Alert>;
  }

  if (!panorama) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 min-h-[500px]">
        <SceneEditor360
          panorama={panorama}
          hotspots={hotspots}
          initialView={{ yaw: scene.initialYaw, pitch: scene.initialPitch, zoom: scene.initialZoom }}
          onPanoramaClick={(yaw, pitch) => {
            setDraftPosition({ yaw, pitch });
            setSelectedHotspotId(null);
            setActionError(null);
          }}
          onMarkerSelect={(id) => {
            setSelectedHotspotId(id);
            setDraftPosition(null);
            setActionError(null);
          }}
        />
      </div>
      <div>
        {draftPosition ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('catalog.hotspots.editor.newTitle')}</h3>
            {actionError && <Alert variant="destructive">{t(actionError)}</Alert>}
            <HotspotForm
              key={`${String(draftPosition.yaw)}-${String(draftPosition.pitch)}`}
              defaultPosition={draftPosition}
              currentTourScenes={currentTourScenes}
              onSubmit={handleCreateHotspot}
              isSubmitting={isSubmitting}
              onCancel={() => { setDraftPosition(null); }}
            />
          </div>
        ) : selectedHotspotId ? (
          (() => {
            const hotspot = hotspots.find(h => h.id === selectedHotspotId);
            if (!hotspot) return null;
            return (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{hotspot.tooltip}</h3>
                {actionError && <Alert variant="destructive">{t(actionError)}</Alert>}
                <div className="flex space-x-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(t('catalog.hotspots.editor.confirmDelete'))) {
                        setIsSubmitting(true);
                        setActionError(null);
                        deleteHotspot(selectedHotspotId)
                          .then(() => {
                            setSelectedHotspotId(null);
                            loadHotspots();
                          })
                          .catch(() => {
                            setActionError('common.error.generic');
                          })
                          .finally(() => {
                            setIsSubmitting(false);
                          });
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    {t('catalog.hotspots.editor.delete')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedHotspotId(null); }}
                    disabled={isSubmitting}
                  >
                    {t('common.actions.cancel')}
                  </Button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="p-4 bg-muted text-muted-foreground rounded-md text-sm">
            {t('catalog.hotspots.editor.hint')}
          </div>
        )}
      </div>
    </div>
  );
}

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
      
      {isNew ? (
        <Card>
          <CardContent className="pt-6">
            <SceneForm
              initialData={scene}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              weight={weight}
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">{t('catalog.scenes.tabs.info')}</TabsTrigger>
            <TabsTrigger value="editor">{t('catalog.scenes.tabs.editor')}</TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <Card>
              <CardContent className="pt-6">
                <SceneForm
                  initialData={scene}
                  onSubmit={handleSubmit}
                  onDelete={handleDelete}
                  isSubmitting={isSubmitting}
                  weight={weight}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="editor">
            <Card>
              <CardContent className="pt-6">
                {scene && <SceneEditorTab scene={scene} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
