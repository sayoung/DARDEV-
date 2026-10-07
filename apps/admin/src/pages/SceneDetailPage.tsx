import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider.js';
import { SceneForm } from './SceneForm.js';
import { HotspotForm } from './HotspotForm.js';
import { getScene, updateScene, createScene, deleteScene, listScenes, getAsset, listHotspots, createHotspot, deleteHotspot, updateHotspot } from '../api/catalog.js';
import { createDebouncedSaver, type SaveStatus } from '../editor/debouncedSaver.js';
import { createEditHistory } from '../editor/editHistory.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, type SceneResponse, type SceneCreate, type HotspotCreate, z, ProcessingStatus, type HotspotResponse, type HotspotUpdate, HotspotType } from '@xplor/shared';
import { ApiError } from '../api/client.js';
import { PageHeader } from '../components/PageHeader.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { SceneCreateSchema, SceneUpdateSchema } from '@xplor/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs.js';
import { SceneEditor360, type SceneEditor360Handle } from '../components/SceneEditor360.js';
import { editorMarkers, editorPanorama, type EditorMarker, type EditorPanorama } from '@xplor/viewer-core';

function normalizeLang(lang: string): 'fr' | 'ar' | 'en' {
  if (lang === 'ar' || lang === 'en') {
    return lang;
  }
  return 'fr';
}

function getHotspotUpdate(h: HotspotResponse, yaw: number, pitch: number): HotspotUpdate {
  const base = {
    yaw,
    pitch,
    label: h.label,
    icon: h.icon,
    arrivalYaw: h.arrivalYaw ?? undefined,
  };
  switch (h.type) {
    case HotspotType.SCENE_LINK:
      return { ...base, type: h.type, targetSceneId: h.targetSceneId ?? '' };
    case HotspotType.TOUR_LINK:
      return { ...base, type: h.type, targetTourId: h.targetTourId ?? '', targetTourSceneId: h.targetTourSceneId ?? undefined };
    case HotspotType.INFO:
      return { ...base, type: h.type, body: h.body ?? { fr: '' } };
    case HotspotType.MEDIA:
      return { ...base, type: h.type, mediaAssetIds: h.mediaAssetIds };
    case HotspotType.URL:
      return { ...base, type: h.type, url: h.url ?? '' };
  }
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
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleRef = useRef<SceneEditor360Handle>(null);

  const [rawHotspots, setRawHotspots] = useState<HotspotResponse[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saverRef = useRef<ReturnType<typeof createDebouncedSaver<HotspotUpdate>> | null>(null);

  const historyRef = useRef<ReturnType<typeof createEditHistory> | null>(null);
  const rawHotspotsRef = useRef(rawHotspots);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  if (!historyRef.current) {
    historyRef.current = createEditHistory();
  }

  useEffect(() => {
    rawHotspotsRef.current = rawHotspots;
  }, [rawHotspots]);

  const updateHistoryState = () => {
    if (historyRef.current) {
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  };

  const undo = () => {
    if (!historyRef.current) return;
    const cmd = historyRef.current.undo();
    if (cmd) {
      setHotspots((prev) => prev.map((h) => (h.id === cmd.hotspotId ? { ...h, position: cmd.from } : h)));
      if (saverRef.current) {
        const raw = rawHotspotsRef.current.find((r) => r.id === cmd.hotspotId);
        if (raw) {
          saverRef.current.schedule(cmd.hotspotId, getHotspotUpdate(raw, cmd.from.yaw, cmd.from.pitch));
        }
      }
      updateHistoryState();
    }
  };

  const redo = () => {
    if (!historyRef.current) return;
    const cmd = historyRef.current.redo();
    if (cmd) {
      setHotspots((prev) => prev.map((h) => (h.id === cmd.hotspotId ? { ...h, position: cmd.to } : h)));
      if (saverRef.current) {
        const raw = rawHotspotsRef.current.find((r) => r.id === cmd.hotspotId);
        if (raw) {
          saverRef.current.schedule(cmd.hotspotId, getHotspotUpdate(raw, cmd.to.yaw, cmd.to.pitch));
        }
      }
      updateHistoryState();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tag = activeEl.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, []);

  useEffect(() => {
    saverRef.current = createDebouncedSaver<HotspotUpdate>(
      async (id, data) => { await updateHotspot(id, data); },
      setSaveStatus,
      1000
    );
    return () => {
      if (saverRef.current) {
        void saverRef.current.flush();
      }
    };
  }, []);

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
      setRawHotspots(hotspotsRes);
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
        setRawHotspots(hotspotsRes);
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

  const handleSetInitialView = async () => {
    if (!handleRef.current) return;
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const view = handleRef.current.getView();
      await updateScene(scene.id, {
        title: scene.title,
        panoramaAssetId: scene.panoramaAssetId,
        weight: scene.weight,
        caption: scene.caption ?? undefined,
        narration: scene.narration ?? undefined,
        ambientAssetId: scene.ambientAssetId ?? undefined,
        initialYaw: view.yaw,
        initialPitch: view.pitch,
        initialZoom: view.zoom,
      });
      setActionSuccess('catalog.hotspots.editor.initialViewSaved');
    } catch {
      setActionError('common.error.generic');
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
        <div className="flex items-center justify-between mb-4">
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
            >
              {t('catalog.hotspots.editor.undo')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
            >
              {t('catalog.hotspots.editor.redo')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSetInitialView()}
              disabled={isSubmitting}
            >
              {t('catalog.hotspots.editor.setInitialView')}
            </Button>
          </div>
          {saveStatus !== 'idle' && (
            <div aria-live="polite" className="text-sm font-medium text-muted-foreground">
              {t(`catalog.hotspots.editor.status.${saveStatus}`)}
            </div>
          )}
        </div>
        {actionSuccess && <Alert variant="default" className="mb-4">{t(actionSuccess)}</Alert>}
        {actionError && !draftPosition && !selectedHotspotId && <Alert variant="destructive" className="mb-4">{t(actionError)}</Alert>}
        <SceneEditor360
          handleRef={handleRef}
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
          onMarkerMove={(id, yaw, pitch) => {
            const old = hotspots.find(h => h.id === id);
            if (old && historyRef.current) {
              historyRef.current.push({ kind: 'move', hotspotId: id, from: old.position, to: { yaw, pitch } });
              updateHistoryState();
            }
            setHotspots((prev) => prev.map((h) => (h.id === id ? { ...h, position: { yaw, pitch } } : h)));
            if (saverRef.current) {
              const raw = rawHotspots.find((r) => r.id === id);
              if (raw) {
                saverRef.current.schedule(id, getHotspotUpdate(raw, yaw, pitch));
              }
            }
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
