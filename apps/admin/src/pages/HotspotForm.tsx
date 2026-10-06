import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  HotspotType, HotspotIcon, type HotspotCreate, type HotspotResponse, 
  type LocalizedText, AssetKind, type SceneResponse, type TourResponse, z 
} from '@xplor/shared';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { MultiAssetPicker } from '../catalog/MultiAssetPicker.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';
import { listTours, listScenes } from '../api/catalog.js';

interface Props {
  initialData?: HotspotResponse | null;
  defaultPosition?: { yaw: number; pitch: number };
  currentTourScenes: SceneResponse[];
  onSubmit: (data: HotspotCreate) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
  isSubmitting: boolean;
}

export function HotspotForm({ initialData, defaultPosition, currentTourScenes, onSubmit, onDelete, onCancel, isSubmitting }: Props) {
  const { t } = useTranslation();

  const [type, setType] = useState<HotspotType>(initialData?.type ?? HotspotType.SCENE_LINK);
  const [yaw, setYaw] = useState<number>(initialData?.yaw ?? defaultPosition?.yaw ?? 0);
  const [pitch, setPitch] = useState<number>(initialData?.pitch ?? defaultPosition?.pitch ?? 0);
  const [label, setLabel] = useState<LocalizedText>(initialData?.label ?? { fr: '' });
  const [arrivalYaw, setArrivalYaw] = useState<number | ''>(initialData?.arrivalYaw ?? '');
  const [icon, setIcon] = useState<HotspotIcon>(initialData?.icon ?? HotspotIcon.ARROW);

  // SCENE_LINK
  const [targetSceneId, setTargetSceneId] = useState<string>(initialData?.targetSceneId ?? '');

  // TOUR_LINK
  const [targetTourId, setTargetTourId] = useState<string>(initialData?.targetTourId ?? '');
  const [targetTourSceneId, setTargetTourSceneId] = useState<string>(initialData?.targetTourSceneId ?? '');
  const [tourSearch, setTourSearch] = useState<string>('');
  const [foundTours, setFoundTours] = useState<TourResponse[]>([]);
  const [foundTourScenes, setFoundTourScenes] = useState<SceneResponse[]>([]);

  // INFO
  const [body, setBody] = useState<LocalizedText>(initialData?.body ?? { fr: '' });

  // MEDIA
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>(initialData?.mediaAssetIds ?? []);

  // URL
  const [url, setUrl] = useState<string>(initialData?.url ?? '');

  useEffect(() => {
    if (type === HotspotType.TOUR_LINK) {
      if (tourSearch.trim().length > 1 || targetTourId) {
        listTours({ q: tourSearch, page: 1, pageSize: 50 }).then((res) => { setFoundTours(res.items); }).catch(console.error);
      }
    }
  }, [tourSearch, type, targetTourId]);

  useEffect(() => {
    if (targetTourId) {
      listScenes(targetTourId).then((res) => { setFoundTourScenes(res); }).catch(console.error);
    } else {
      setFoundTourScenes([]);
    }
  }, [targetTourId]);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const baseData = { yaw, pitch, label, icon, arrivalYaw: arrivalYaw !== '' ? arrivalYaw : undefined };
    let data: HotspotCreate;

    if (type === HotspotType.SCENE_LINK) {
      data = { ...baseData, type: HotspotType.SCENE_LINK, targetSceneId };
    } else if (type === HotspotType.TOUR_LINK) {
      data = { ...baseData, type: HotspotType.TOUR_LINK, targetTourId, targetTourSceneId: targetTourSceneId || undefined };
    } else if (type === HotspotType.INFO) {
      data = { ...baseData, type: HotspotType.INFO, body };
    } else if (type === HotspotType.MEDIA) {
      data = { ...baseData, type: HotspotType.MEDIA, mediaAssetIds };
    } else {
      data = { ...baseData, type: HotspotType.URL, url };
    }

    void onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">{t('catalog.hotspots.fields.type')}</Label>
          <Select 
            id="type"
            
            value={type} 
            onChange={(e) => { 
              const val = z.enum(HotspotType).safeParse(e.target.value);
              if (val.success) setType(val.data);
            }}
          >
            {Object.values(HotspotType).map((tVal) => (
              <option key={tVal} value={tVal}>{t(`catalog.hotspots.type.${tVal}`)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="icon">{t('catalog.hotspots.fields.icon')}</Label>
          <Select 
            id="icon"
            
            value={icon} 
            onChange={(e) => { 
              const val = z.enum(HotspotIcon).safeParse(e.target.value);
              if (val.success) setIcon(val.data);
            }}
          >
            {Object.values(HotspotIcon).map((iVal) => (
              <option key={iVal} value={iVal}>{t(`catalog.hotspots.icon.${iVal}`)}</option>
            ))}
          </Select>
        </div>
      </div>

      <LocalizedTextField
        label={t('catalog.hotspots.fields.label')}
        value={label}
        onChange={setLabel}
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="yaw">{t('catalog.hotspots.fields.yaw')}</Label>
          <Input id="yaw" type="number" step="0.01" value={yaw} onChange={e => { setYaw(Number(e.target.value)); }} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pitch">{t('catalog.hotspots.fields.pitch')}</Label>
          <Input id="pitch" type="number" step="0.01" value={pitch} onChange={e => { setPitch(Number(e.target.value)); }} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="arrivalYaw">{t('catalog.hotspots.fields.arrivalYaw')} ({t('common.optional')})</Label>
          <Input id="arrivalYaw" type="number" step="0.01" value={arrivalYaw} onChange={e => { setArrivalYaw(e.target.value === '' ? '' : Number(e.target.value)); }} />
        </div>
      </div>

      <div className="border-t pt-4 mt-4">
        {type === HotspotType.SCENE_LINK && (
          <div className="space-y-2">
            <Label htmlFor="targetSceneId">{t('catalog.hotspots.fields.targetSceneId')}</Label>
            <Select
              id="targetSceneId"
              value={targetSceneId} 
              onChange={(e) => { setTargetSceneId(e.target.value); }}
              required
            >
              <option value="">{t('common.select')}</option>
              {currentTourScenes.map((s) => (
                <option key={s.id} value={s.id}>{s.title.fr || s.id}</option>
              ))}
            </Select>
          </div>
        )}

        {type === HotspotType.TOUR_LINK && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetTourId">{t('catalog.hotspots.fields.targetTourId')}</Label>
              <Input 
                id="tourSearch"
                type="text" 
                placeholder={t('common.search')} 
                value={tourSearch} 
                onChange={(e) => { setTourSearch(e.target.value); }} 
              />
              <Select 
                id="targetTourId"
                className="mt-2"
                value={targetTourId} 
                onChange={(e) => { setTargetTourId(e.target.value); }}
                required
              >
                <option value="">{t('common.select')}</option>
                {foundTours.map((t) => (
                  <option key={t.id} value={t.id}>{t.title.fr || t.id}</option>
                ))}
                {!foundTours.find(ft => ft.id === targetTourId) && targetTourId && (
                  <option value={targetTourId}>{targetTourId}</option>
                )}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetTourSceneId">{t('catalog.hotspots.fields.targetTourSceneId')} ({t('common.optional')})</Label>
              <Select 
                id="targetTourSceneId"
                value={targetTourSceneId} 
                onChange={(e) => { setTargetTourSceneId(e.target.value); }}
              >
                <option value="">{t('common.select')}</option>
                {foundTourScenes.map((s) => (
                  <option key={s.id} value={s.id}>{s.title.fr || s.id}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {type === HotspotType.INFO && (
          <LocalizedTextField
            label={t('catalog.hotspots.fields.body')}
            value={body}
            onChange={setBody}
            required
            multiline
          />
        )}

        {type === HotspotType.MEDIA && (
          <MultiAssetPicker
            label={t('catalog.hotspots.fields.mediaAssetIds')}
            kind={AssetKind.IMAGE}
            value={mediaAssetIds}
            onChange={setMediaAssetIds}
          />
        )}

        {type === HotspotType.URL && (
          <div className="space-y-2">
            <Label htmlFor="url">{t('catalog.hotspots.fields.url')}</Label>
            <Input id="url" type="url" value={url} onChange={e => { setUrl(e.target.value); }} required />
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="submit" data-testid="submit-hotspot-btn" disabled={isSubmitting}>
          {t('common.save')}
        </Button>
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            {t('common.actions.cancel')}
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" type="button" onClick={() => void onDelete()} disabled={isSubmitting}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </form>
  );
}


