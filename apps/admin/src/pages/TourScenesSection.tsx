import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourResponse,
  type SceneResponse,
  localize,
} from '@xplor/shared';
import {
  listScenes,
  deleteScene,
  reorderScenes,
  setStartScene,
  getTour,
} from '../api/catalog.js';
import { ApiError } from '../api/client.js';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { navigate, hrefFor } from '../router.js';

interface Props {
  tour: TourResponse;
  onTourUpdated: (tour: TourResponse) => void;
}

function isModifiedClick(event: React.MouseEvent<Element>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0;
}

export function TourScenesSection({ tour, onTourUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadScenes = async () => {
    try {
      const data = await listScenes(tour.id);
      setScenes(data);
      setError(null);
    } catch {
      setError('common.error.generic');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadScenes();
  }, [tour.id]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('common.deleteConfirm'))) return;
    try {
      setError(null);
      await deleteScene(id);
      await reloadScenes();
      const updatedTour = await getTour(tour.id);
      onTourUpdated(updatedTour);
    } catch {
      setError('common.error.generic');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const newScenes = [...scenes];
    const swap = newScenes[index + direction];
    const current = newScenes[index];
    if (!swap || !current) return;
    newScenes[index + direction] = current;
    newScenes[index] = swap;

    try {
      setError(null);
      await reorderScenes(tour.id, { sceneIds: newScenes.map((s) => s.id) });
      await reloadScenes();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SCENE_SET_MISMATCH') {
        setError('catalog.errors.sceneSetMismatch');
      } else {
        setError('common.error.generic');
      }
    }
  };

  const handleSetStart = async (sceneId: string) => {
    try {
      setError(null);
      const updatedTour = await setStartScene(tour.id, { sceneId });
      onTourUpdated(updatedTour);
    } catch {
      setError('common.error.generic');
    }
  };

  return (
    <section className="space-y-6">
      <h3 className="text-xl font-semibold">{t('catalog.scene.title')}</h3>
      {error && <Alert variant="destructive">{t(error)}</Alert>}
      
      {loading ? (
        <p className="p-4">{t('common.loading')}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('catalog.scene.fields.title')}</TableHead>
                <TableHead>{t('catalog.scene.fields.hotspotCount')}</TableHead>
                <TableHead className="text-right">{t('catalog.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-gray-500">
                    {t('common.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                scenes.map((scene, index) => (
                  <TableRow key={scene.id} id={`scene-${scene.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {localize(scene.title, i18n.language)}
                        {scene.id === tour.startSceneId && (
                          <Badge variant="secondary">{t('catalog.scene.startBadge')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{scene.hotspotCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => { void handleMove(index, -1); }}
                        >
                          {t('catalog.scene.actions.moveUp')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === scenes.length - 1}
                          onClick={() => { void handleMove(index, 1); }}
                        >
                          {t('catalog.scene.actions.moveDown')}
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => { void handleSetStart(scene.id); }}
                        >
                          {t('catalog.scene.actions.setStart')}
                        </Button>
                        <Button 
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            if (isModifiedClick(e)) return;
                            e.preventDefault();
                            navigate(`/tours/${tour.id}/scenes/${scene.id}`);
                          }}
                        >
                          {t('catalog.edit')}
                        </Button>
                        <Button 
                          variant="destructive"
                          size="sm"
                          onClick={() => { void handleDelete(scene.id); }}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && (
        <Button className="mt-4" onClick={(e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          navigate(`/tours/${tour.id}/scenes/new`);
        }}>
          {t('catalog.scene.actions.add')}
        </Button>
      )}
    </section>
  );
}
