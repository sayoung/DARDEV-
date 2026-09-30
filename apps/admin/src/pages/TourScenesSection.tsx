import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourResponse,
  type SceneResponse,
  AssetKind,
  SceneCreateSchema,
  SceneUpdateSchema,
  type LocalizedText,
  z,
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
import { ApiError } from '../api/client.js';
import { localize } from '@xplor/shared';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { AssetPicker } from '../catalog/AssetPicker.js';
import './TourScenesSection.css'; // Will create this

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
  const [title, setTitle] = useState<LocalizedText>({ fr: '' });
  const [caption, setCaption] = useState<LocalizedText>({ fr: '' });
  const [panoramaAssetId, setPanoramaAssetId] = useState('');
  const [initialYaw, setInitialYaw] = useState(0);
  const [initialPitch, setInitialPitch] = useState(0);
  const [initialZoom, setInitialZoom] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const reloadScenes = async () => {
    try {
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

    // If caption doesn't have at least 'fr' or any other required field, zod will throw.
    // Let's pass caption only if it has at least one key with content.
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
    <section className="tour-scenes-section">
      <h3>{t('catalog.scene.title')}</h3>
      {error && <div className="form-error" role="alert">{t(error)}</div>}
      
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <table className="scenes-table">
          <thead>
            <tr>
              <th>{t('catalog.scene.fields.title')}</th>
              <th>{t('catalog.scene.fields.hotspotCount')}</th>
              <th>{t('catalog.actions')}</th>
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
                <td className="actions-cell">
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
                    {t('catalog.edit')}
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

      {!showForm && !loading && (
        <button type="button" onClick={handleStartAdd} className="btn-add-scene">
          {t('catalog.scene.actions.add')}
        </button>
      )}

      {showForm && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="scene-form">
          <h4>{isAdding ? t('catalog.scene.actions.add') : t('catalog.edit')}</h4>
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
          
          <div className="scene-form-row">
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

          <div className="scene-form-actions">
            <button type="submit" disabled={submitting}>
              {t('common.save')}
            </button>
            <button type="button" onClick={handleCancelForm} disabled={submitting}>
              {t('catalog.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
