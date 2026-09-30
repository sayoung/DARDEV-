import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourResponse,
  type SceneResponse,
  type LocalizedText,
  SceneCreateSchema,
  SceneUpdateSchema,
  localize,
  AssetKind,
  z
} from '@xplor/shared';
import {
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  setStartScene,
  getTour,
} from '../api/catalog.js';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { AssetPicker } from '../catalog/AssetPicker.js';
import { ApiError } from '../api/client.js';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

interface Props {
  tour: TourResponse;
  onTourUpdated: (tour: TourResponse) => void;
}

export function TourScenesSection({ tour, onTourUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState<LocalizedText>({ fr: '' });
  const [caption, setCaption] = useState<LocalizedText>({ fr: '' });
  const [panoramaAssetId, setPanoramaAssetId] = useState<string>('');
  const [initialYaw, setInitialYaw] = useState(0);
  const [initialPitch, setInitialPitch] = useState(0);
  const [initialZoom, setInitialZoom] = useState(50);

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

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setTitle({ fr: '' });
    setCaption({ fr: '' });
    setPanoramaAssetId('');
    setInitialYaw(0);
    setInitialPitch(0);
    setInitialZoom(50);
    setError(null);
  };

  const handleStartEdit = (scene: SceneResponse) => {
    setIsAdding(false);
    setEditingId(scene.id);
    setTitle(scene.title);
    setCaption(scene.caption ?? { fr: '' });
    setPanoramaAssetId(scene.panoramaAssetId);
    setInitialYaw(scene.initialYaw);
    setInitialPitch(scene.initialPitch);
    setInitialZoom(scene.initialZoom);
    setError(null);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const hasCaption = Object.values(caption).some(v => v.trim() !== '');

    const payload = {
      title,
      caption: hasCaption ? caption : undefined,
      panoramaAssetId,
      initialYaw,
      initialPitch,
      initialZoom,
      weight: isAdding ? scenes.length : (scenes.find((s) => s.id === editingId)?.weight ?? 0),
    };

    try {
      if (isAdding) {
        const data = SceneCreateSchema.parse(payload);
        await createScene(tour.id, data);
        const updatedTour = await getTour(tour.id);
        onTourUpdated(updatedTour);
      } else if (editingId) {
        const data = SceneUpdateSchema.parse(payload);
        await updateScene(editingId, data);
      }
      setIsAdding(false);
      setEditingId(null);
      await reloadScenes();
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError('catalog.errors.invalidForm');
      } else if (err instanceof ApiError && err.code === 'PANORAMA_ASSET_NOT_FOUND') {
        setError('catalog.errors.panoramaAssetNotFound');
      } else {
        setError('common.error.generic');
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  const showForm = isAdding || editingId !== null;

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
                          onClick={() => { handleStartEdit(scene); }}
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

      {!showForm && !loading && (
        <Button onClick={handleStartAdd} className="mt-4">
          {t('catalog.scene.actions.add')}
        </Button>
      )}

      {showForm && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6 mt-8 p-6 border rounded-lg bg-gray-50 dark:bg-gray-900">
          <h4 className="text-lg font-semibold">{isAdding ? t('catalog.scene.actions.add') : t('catalog.edit')}</h4>
          <LocalizedTextField
            label={t('catalog.scene.fields.title')}
            value={title}
            onChange={setTitle}
            required
          />
          <LocalizedTextField
            label={t('catalog.scene.fields.caption')}
            value={caption}
            onChange={setCaption}
          />

          <AssetPicker
            label={t('catalog.scene.fields.panorama')}
            kind={AssetKind.PANORAMA}
            value={panoramaAssetId}
            onChange={setPanoramaAssetId}
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('catalog.scene.fields.initialYaw')}</Label>
              <Input type="number" step="0.1" value={initialYaw} onChange={e => { setInitialYaw(Number(e.target.value)); }} required />
            </div>
            <div className="space-y-2">
              <Label>{t('catalog.scene.fields.initialPitch')}</Label>
              <Input type="number" step="0.1" value={initialPitch} onChange={e => { setInitialPitch(Number(e.target.value)); }} required />
            </div>
            <div className="space-y-2">
              <Label>{t('catalog.scene.fields.initialZoom')}</Label>
              <Input type="number" min="0" max="100" value={initialZoom} onChange={e => { setInitialZoom(Number(e.target.value)); }} required />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={submitting}>
              {t('common.save')}
            </Button>
            <Button variant="outline" type="button" onClick={handleCancelForm} disabled={submitting}>
              {t('catalog.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
