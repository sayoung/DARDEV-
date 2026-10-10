import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getScene, listHotspots, deleteHotspot, listScenes, getTour } from '../api/catalog.js';
import { hrefFor, navigate, useAppLocation } from '../router.js';
import { Role, HotspotType, type HotspotResponse, type SceneResponse, type TourResponse } from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { PageHeader } from '../components/PageHeader.js';
import { Button } from '../components/ui/Button.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { localize } from '@xplor/shared';
import { i18n } from '../i18n.js';

export function HotspotsPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { route } = useAppLocation();
  const tourId = route.name === 'hotspots' ? route.tourId : '';
  const sceneId = route.name === 'hotspots' ? route.sceneId : '';

  const [hotspots, setHotspots] = useState<HotspotResponse[]>([]);
  const [scene, setScene] = useState<SceneResponse | null>(null);
  const [tour, setTour] = useState<TourResponse | null>(null);
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (auth.state.status === 'authenticated' && (auth.state.profile.role === Role.ADMIN || auth.state.profile.role === Role.EDITOR) && tourId && sceneId) {
      Promise.all([
        listHotspots(sceneId),
        getScene(sceneId),
        getTour(tourId),
        listScenes(tourId)
      ])
        .then(([resHotspots, resScene, resTour, resScenes]) => {
          if (active) {
            setHotspots(resHotspots);
            setScene(resScene);
            setTour(resTour);
            setScenes(resScenes);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setError('common.error.generic');
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [tourId, sceneId, auth.state]);

  const handleDelete = async (hotspotId: string) => {
    if (!window.confirm(t('catalog.hotspots.deleteConfirm'))) return;
    try {
      await deleteHotspot(hotspotId);
      setHotspots(hotspots.filter(h => h.id !== hotspotId));
    } catch {
      alert(t('common.error.generic'));
    }
  };

  if (auth.state.status !== 'authenticated' || (auth.state.profile.role !== Role.ADMIN && auth.state.profile.role !== Role.EDITOR)) {
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  if (loading) {
    return <p className="p-4">{t('common.loading')}</p>;
  }

  if (error || !scene) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('catalog.hotspots.title')} />
        <div className="text-sm font-medium text-destructive" role="alert">{t(error || 'catalog.errors.sceneNotFound')}</div>
        <a
          href={hrefFor(`/tours/${tourId}/scenes/${sceneId}`)}
          className="text-primary hover:underline"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
            event.preventDefault();
            navigate(`/tours/${tourId}/scenes/${sceneId}`);
          }}
        >
          {t('catalog.hotspots.backToScene')}
        </a>
      </div>
    );
  }

  const renderTarget = (h: HotspotResponse) => {
    if (h.type === HotspotType.SCENE_LINK && h.targetSceneId) {
      const targetScene = scenes.find(s => s.id === h.targetSceneId);
      const title = targetScene ? localize(targetScene.title, i18n.language) : h.targetSceneId;
      return <span>{title}</span>;
    }
    if (h.type === HotspotType.TOUR_LINK && h.targetTourId) {
      return <span>Tour: {h.targetTourId}</span>;
    }
    if (h.type === HotspotType.URL && h.url) {
      return <a href={h.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{h.url}</a>;
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
            <a href={hrefFor('/tours')} onClick={(e) => { e.preventDefault(); navigate('/tours'); }} className="hover:underline">{t('catalog.tours.list')}</a>
            <span>›</span>
            <a href={hrefFor(`/tours/${tourId}`)} onClick={(e) => { e.preventDefault(); navigate(`/tours/${tourId}`); }} className="hover:underline">{localize(tour?.title || { fr: '' }, i18n.language)}</a>
            <span>›</span>
            <a href={hrefFor(`/tours/${tourId}/scenes/${sceneId}`)} onClick={(e) => { e.preventDefault(); navigate(`/tours/${tourId}/scenes/${sceneId}`); }} className="hover:underline">{localize(scene.title, i18n.language)}</a>
            <span>›</span>
            <span>{t('catalog.hotspots.list')}</span>
          </div>
          <PageHeader title={t('catalog.hotspots.list')} />
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => { navigate(`/tours/${tourId}/scenes/${sceneId}`); }}
          >
            {t('catalog.hotspots.backToScene')}
          </Button>
          <Button
            onClick={() => { navigate(`/tours/${tourId}/scenes/${sceneId}/hotspots/new`); }}
          >
            {t('catalog.hotspots.add')}
          </Button>
        </div>
      </div>

      {hotspots.length === 0 ? (
        <p>{t('catalog.hotspots.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.hotspots.columns.type')}</TableHead>
              <TableHead>{t('catalog.hotspots.columns.label')}</TableHead>
              <TableHead>{t('catalog.hotspots.columns.target')}</TableHead>
              <TableHead>{t('catalog.hotspots.columns.icon')}</TableHead>
              <TableHead className="w-[100px] text-end">{t('catalog.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotspots.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{t(`catalog.hotspots.type.${h.type}`)}</TableCell>
                <TableCell>{localize(h.label, 'fr')}</TableCell>
                <TableCell>{renderTarget(h)}</TableCell>
                <TableCell>{t(`catalog.hotspots.icon.${h.icon}`)}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { navigate(`/tours/${tourId}/scenes/${sceneId}/hotspots/${h.id}`); }}
                    >
                      {t('catalog.edit')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(h.id)}
                    >
                      {t('catalog.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
