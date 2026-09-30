import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type SceneResponse, type SceneCreate, type SceneUpdate, type LocalizedText, AssetKind } from '@xplor/shared';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { AssetPicker } from '../catalog/AssetPicker.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

interface Props {
  initialData?: SceneResponse | null;
  onSubmit: (data: SceneCreate) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSubmitting: boolean;
  weight: number;
}

export function SceneForm({ initialData, onSubmit, onDelete, isSubmitting, weight }: Props) {
  const { t } = useTranslation();

  const [title, setTitle] = useState<LocalizedText>(initialData?.title ?? { fr: '' });
  const [caption, setCaption] = useState<LocalizedText>(initialData?.caption ?? { fr: '' });
  const [panoramaAssetId, setPanoramaAssetId] = useState<string>(initialData?.panoramaAssetId ?? '');
  const [initialYaw, setInitialYaw] = useState(initialData?.initialYaw ?? 0);
  const [initialPitch, setInitialPitch] = useState(initialData?.initialPitch ?? 0);
  const [initialZoom, setInitialZoom] = useState(initialData?.initialZoom ?? 50);
  
  const [narrationFr, setNarrationFr] = useState<string>(initialData?.narration?.['fr'] ?? '');
  const [narrationAr, setNarrationAr] = useState<string>(initialData?.narration?.['ar'] ?? '');
  const [narrationEn, setNarrationEn] = useState<string>(initialData?.narration?.['en'] ?? '');
  
  const [ambientAssetId, setAmbientAssetId] = useState<string>(initialData?.ambientAssetId ?? '');

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hasCaption = Object.values(caption).some(v => v.trim() !== '');
    
    const narration: Record<string, string> = {};
    if (narrationFr) narration['fr'] = narrationFr;
    if (narrationAr) narration['ar'] = narrationAr;
    if (narrationEn) narration['en'] = narrationEn;

    void onSubmit({
      title,
      caption: hasCaption ? caption : undefined,
      panoramaAssetId,
      initialYaw,
      initialPitch,
      initialZoom,
      weight,
      narration: Object.keys(narration).length > 0 ? narration : undefined,
      ambientAssetId: ambientAssetId || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="space-y-4">
        <h4 className="font-medium text-sm">{t('catalog.scene.fields.narration')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AssetPicker
            label={t('common.language.fr')}
            kind={AssetKind.AUDIO}
            value={narrationFr}
            onChange={setNarrationFr}
          />
          <AssetPicker
            label={t('common.language.ar')}
            kind={AssetKind.AUDIO}
            value={narrationAr}
            onChange={setNarrationAr}
          />
          <AssetPicker
            label={t('common.language.en')}
            kind={AssetKind.AUDIO}
            value={narrationEn}
            onChange={setNarrationEn}
          />
        </div>
      </div>

      <AssetPicker
        label={t('catalog.scene.fields.ambient')}
        kind={AssetKind.AUDIO}
        value={ambientAssetId}
        onChange={setAmbientAssetId}
      />

      <div className="flex gap-4 pt-4">
        <Button type="submit" data-testid="submit-scene-btn" disabled={isSubmitting}>
          {t('common.save')}
        </Button>
        {onDelete && (
          <Button variant="destructive" type="button" onClick={() => { void onDelete(); }} disabled={isSubmitting}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </form>
  );
}
