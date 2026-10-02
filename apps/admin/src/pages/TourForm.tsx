import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type TourCreate,
  type TourResponse,
  type LocalizedText,
  TourCreateSchema,
  TourUpdateSchema,
  localize,
  AssetKind,
  type CityResponse,
  type CategoryResponse,
} from '@xplor/shared';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { AssetPicker } from '../catalog/AssetPicker.js';
import { listCities, listCategories } from '../api/catalog.js';

import { Label } from '../components/ui/Label.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';

interface TourFormProps {
  initialData?: TourResponse;
  onSubmit: (data: TourCreate) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSubmitting: boolean;
  statusText?: string;
}

const emptyLocalizedText = (): LocalizedText => ({ fr: '', ar: '', en: '' });

function isBlank(text: string | undefined): boolean {
  return text === undefined || text.trim() === '';
}

export function TourForm({ initialData, onSubmit, onDelete, isSubmitting, statusText }: TourFormProps) {
  const { t, i18n } = useTranslation();
  
  const [title, setTitle] = useState<LocalizedText>(initialData?.title ?? emptyLocalizedText());
  const [summary, setSummary] = useState<LocalizedText>(initialData?.summary ?? emptyLocalizedText());
  const [description, setDescription] = useState<LocalizedText>(initialData?.description ?? emptyLocalizedText());
  const [practicalInfo, setPracticalInfo] = useState<LocalizedText>(initialData?.practicalInfo ?? emptyLocalizedText());
  const [cityId, setCityId] = useState<string>(initialData?.cityId ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(initialData?.categoryIds ?? []);
  const [coverAssetId, setCoverAssetId] = useState<string>(initialData?.coverAssetId ?? '');
  const [durationMinutes, setDurationMinutes] = useState<string>(initialData?.durationMinutes?.toString() ?? '');
  const [lat, setLat] = useState<string>(initialData?.lat?.toString() ?? '');
  const [lng, setLng] = useState<string>(initialData?.lng?.toString() ?? '');
  
  const [cities, setCities] = useState<CityResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listCities(), listCategories()])
      .then(([citiesRes, categoriesRes]) => {
        if (active) {
          setCities(citiesRes);
          setCategories(categoriesRes);
          setReferenceError(null);
        }
      })
      .catch(() => {
        if (active) {
          setReferenceError('catalog.errors.fetchFailed');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCategoryChange = (id: string, checked: boolean) => {
    setCategoryIds(prev => checked ? [...prev, id] : prev.filter(c => c !== id));
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    
    if (categoryIds.length === 0) {
      setFormError(t('catalog.errors.invalidForm'));
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      summary,
      cityId,
      categoryIds,
      coverAssetId,
    };

    if (!isBlank(description.fr)) {
      payload.description = description;
    }
    if (!isBlank(practicalInfo.fr)) {
      payload.practicalInfo = practicalInfo;
    }
    if (durationMinutes.trim() !== '') {
      payload.durationMinutes = Number(durationMinutes);
    }
    if (lat.trim() !== '') {
      payload.lat = Number(lat);
    }
    if (lng.trim() !== '') {
      payload.lng = Number(lng);
    }

    const Schema = initialData ? TourUpdateSchema : TourCreateSchema;
    const result = Schema.safeParse(payload);
    
    if (!result.success) {
      setFormError(t('catalog.errors.invalidForm'));
      return;
    }

    void onSubmit(result.data);
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(t('common.deleteConfirm'))) {
      void onDelete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {statusText && <p className="text-sm font-medium text-muted-foreground">{statusText}</p>}
      {referenceError !== null && <Alert variant="destructive">{t(referenceError)}</Alert>}
      {formError !== null && <Alert variant="destructive">{formError}</Alert>}
      
      <LocalizedTextField
        label={t('tour.form.title')}
        value={title}
        onChange={setTitle}
        required
      />
      
      <LocalizedTextField
        label={t('tour.form.summary')}
        value={summary}
        onChange={setSummary}
        maxLength={500}
        multiline
        required
      />

      <LocalizedTextField
        label={t('tour.form.description')}
        value={description}
        onChange={setDescription}
        multiline
      />

      <LocalizedTextField
        label={t('tour.form.practicalInfo')}
        value={practicalInfo}
        onChange={setPracticalInfo}
        multiline
      />

      <div className="space-y-2">
        <Label htmlFor="cityId">{t('tour.form.cityId')}</Label>
        <Select
          id="cityId"
          value={cityId}
          onChange={e => { setCityId(e.target.value); }}
          required
        >
          <option value="">{t('tour.form.selectCity')}</option>
          {cities.map(c => (
            <option key={c.id} value={c.id}>{localize(c.name, i18n.language)}</option>
          ))}
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('tour.form.categoryIds')}</legend>
        <div className="flex flex-col gap-2 mt-2">
          {categories.map(c => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={c.id}
                checked={categoryIds.includes(c.id)}
                onChange={e => { handleCategoryChange(c.id, e.target.checked); }}
                className="h-4 w-4 rounded border-input accent-primary focus-visible:ring-ring"
              />
              {localize(c.name, i18n.language)}
            </label>
          ))}
        </div>
      </fieldset>

      <AssetPicker
        label={t('tour.form.coverAssetId')}
        kind={AssetKind.IMAGE}
        value={coverAssetId}
        onChange={setCoverAssetId}
        required
      />

      <div className="space-y-2">
        <Label htmlFor="durationMinutes">{t('tour.form.durationMinutes')}</Label>
        <Input
          id="durationMinutes"
          type="number"
          min="1"
          step="1"
          value={durationMinutes}
          onChange={e => { setDurationMinutes(e.target.value); }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lat">{t('tour.form.lat')}</Label>
        <Input
          id="lat"
          type="number"
          step="any"
          min="-90"
          max="90"
          value={lat}
          onChange={e => { setLat(e.target.value); }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lng">{t('tour.form.lng')}</Label>
        <Input
          id="lng"
          type="number"
          step="any"
          min="-180"
          max="180"
          value={lng}
          onChange={e => { setLng(e.target.value); }}
        />
      </div>

      <div className="flex gap-4 pt-4">
        <Button type="submit" data-testid="submit-tour-btn" disabled={isSubmitting}>{t('common.save')}</Button>
        {onDelete && (
          <Button variant="destructive" type="button" onClick={handleDelete} disabled={isSubmitting}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </form>
  );
}

