import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourResponse,
  type SceneResponse,
  AssetKind,
  SceneCreateSchema,
  SceneUpdateSchema,
} from '@xplor/shared';
import {
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  setStartScene,
} from '../api/catalog.js';
import { ApiError } from '../api/client.js';
import { localize } from '@xplor/shared';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { AssetPicker } from '../catalog/AssetPicker.js';

interface Props {
  tour: TourResponse;
  onTourUpdated: (tour: TourResponse) => void;
}

export function TourScenesSection({ tour, onTourUpdated }: Props) {
  const { t, i18n } = useTranslation();
  const [scenes, setScenes] = useState<SceneResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState<{ fr: string; ar?: string; en?: string }>({ fr: '' });
  const [caption, setCaption] = useState<{ fr: string; ar?: string; en?: string }>({ fr: '' });
  const [panoramaAssetId, setPanoramaAssetId] = useState('');
  const [initialYaw, setInitialYaw] = useState(0);
  const [initialPitch, setInitialPitch] = useState(0);
  const [initialZoom, setInitialZoom] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const reloadScenes = async () => {
    try {
      setLoading(true);
      const res = await listScenes(tour.id);
      setScenes(res);
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
    setCaption(scene.caption || { fr: '' });
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

    const payload = {
      title: title as { fr: string; ar?: string; en?: string },
      caption: caption.fr ? (caption as { fr: string; ar?: string; en?: string }) : undefined,
      panoramaAssetId,
      initialYaw,
      initialPitch,
      initialZoom,
      weight: isAdding ? scenes.length : scenes.find((s) => s.id === editingId)?.weight || 0,
    };

    try {
      if (isAdding) {
        const data = SceneCreateSchema.parse(payload);
        await createScene(tour.id, data);
      } else if (editingId) {
        const data = SceneUpdateSchema.parse(payload);
        await updateScene(editingId, data);
      }
      setIsAdding(false);
      setEditingId(null);
      await reloadScenes();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PANORAMA_ASSET_NOT_FOUND') {
        setError('catalog.errors.panoramaAssetNotFound');
      } else {
        setError('common.error.generic');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      setError(null);
      await deleteScene(id);
      await reloadScenes();
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
    <section>
      <h3>{t('catalog.scene.title')}</h3>
      {error && <div className="form-error" role="alert">{t(error)}</div>}
      
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('catalog.scene.fields.title')}</th>
              <th>{t('catalog.scene.fields.hotspotCount')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene, index) => (
              <tr key={scene.id} id={`scene-${scene.id}`}>
                <td>
                  {localize(scene.title, i18n.language)}
                  {scene.id === tour.startSceneId && (
                    <span className="badge">{t('catalog.scene.startBadge')}</span>
                  )}
                </td>
                <td>{scene.hotspotCount}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => { void handleMove(index, -1); }}
                  >
                    {t('catalog.scene.actions.moveUp')}
                  </button>
                  <button
                    type="button"
                    disabled={index === scenes.length - 1}
                    onClick={() => { void handleMove(index, 1); }}
                  >
                    {t('catalog.scene.actions.moveDown')}
                  </button>
                  <button type="button" onClick={() => { void handleSetStart(scene.id); }}>
                    {t('catalog.scene.actions.setStart')}
                  </button>
                  <button type="button" onClick={() => { handleStartEdit(scene); }}>
                    {t('common.edit')}
                  </button>
                  <button type="button" onClick={() => { void handleDelete(scene.id); }}>
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!showForm && (
        <button type="button" onClick={handleStartAdd} style={{ marginBlockStart: '1rem' }}>
          {t('catalog.scene.actions.add')}
        </button>
      )}

      {showForm && (
        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ marginBlockStart: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
          <h4>{isAdding ? t('catalog.scene.actions.add') : t('common.edit')}</h4>
          <LocalizedTextField
            label={t('catalog.scene.fields.title')}
            value={title}
            onChange={(v) => setTitle(v as { fr: string })}
            required
          />
          <LocalizedTextField
            label={t('catalog.scene.fields.caption')}
            value={caption}
            onChange={(v) => setCaption(v as { fr: string })}
          />
          <AssetPicker
            label={t('catalog.scene.fields.panorama')}
            kind={AssetKind.PANORAMA}
            value={panoramaAssetId}
            onChange={setPanoramaAssetId}
            required
          />
          
          <div style={{ display: 'flex', gap: '1rem', marginBlockEnd: '1rem' }}>
            <label>
              {t('catalog.scene.fields.initialYaw')}
              <input type="number" step="0.1" value={initialYaw} onChange={e => { setInitialYaw(Number(e.target.value)); }} required />
            </label>
            <label>
              {t('catalog.scene.fields.initialPitch')}
              <input type="number" step="0.1" value={initialPitch} onChange={e => { setInitialPitch(Number(e.target.value)); }} required />
            </label>
            <label>
              {t('catalog.scene.fields.initialZoom')}
              <input type="number" min="0" max="100" value={initialZoom} onChange={e => { setInitialZoom(Number(e.target.value)); }} required />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={submitting}>
              {t('common.save')}
            </button>
            <button type="button" onClick={handleCancelForm} disabled={submitting}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
