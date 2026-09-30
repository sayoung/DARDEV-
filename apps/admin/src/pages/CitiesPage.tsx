import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CityCreateSchema,
  localize,
  Role,
  type LocalizedText,
  type CityResponse
} from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { listCities, createCity, updateCity, deleteCity } from '../api/catalog.js';
import { LocalizedTextField } from '../catalog/LocalizedTextField.js';
import { ApiError } from '../api/client.js';

export function CitiesPage() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.profile : null;
  const canWrite = user?.role === Role.ADMIN || user?.role === Role.EDITOR;

  const [cities, setCities] = useState<CityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<LocalizedText>({ fr: '' });
  const [region, setRegion] = useState('');
  const [lat, setLat] = useState<number | ''>('');
  const [lng, setLng] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchCities();
  }, []);

  async function fetchCities() {
    try {
      setFetchError(null);
      const data = await listCities();
      setCities(data);
    } catch {
      setFetchError(t('catalog.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName({ fr: '' });
    setRegion('');
    setLat('');
    setLng('');
    setFormError(null);
  }

  function handleEdit(city: CityResponse) {
    setEditingId(city.id);
    setName({ fr: city.name.fr, ar: city.name.ar, en: city.name.en });
    setRegion(city.region);
    setLat(city.lat);
    setLng(city.lng);
    setFormError(null);
  }

  async function handleDelete(city: CityResponse) {
    if (!window.confirm(t('catalog.city.deleteConfirm'))) {
      return;
    }
    setFetchError(null);
    try {
      await deleteCity(city.id);
      await fetchCities();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'IN_USE') {
        setFetchError(t('catalog.errors.inUse'));
      } else {
        setFetchError(t('catalog.errors.deleteFailed'));
      }
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      name,
      region,
      lat: typeof lat === 'string' ? parseFloat(lat) : lat,
      lng: typeof lng === 'string' ? parseFloat(lng) : lng,
    };

    const parsed = CityCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(t('catalog.errors.invalidForm'));
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateCity(editingId, parsed.data);
      } else {
        await createCity(parsed.data);
      }
      resetForm();
      await fetchCities();
    } catch {
      setFormError(t('catalog.errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-cities">
      <h2>{t('page.cities.title')}</h2>

      {fetchError && <p className="error" role="alert">{fetchError}</p>}
      
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('catalog.city.name')}</th>
              <th>{t('catalog.city.region')}</th>
              <th>{t('catalog.city.lat')}</th>
              <th>{t('catalog.city.lng')}</th>
              {canWrite && <th>{t('catalog.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => {
              const baseLang = i18n.language.split('-')[0];
              const isMissingTranslation = !city.name[baseLang as keyof typeof city.name] && baseLang !== 'fr';
              return (
                <tr key={city.id}>
                  <td>
                    <span>{localize(city.name, i18n.language)}</span>
                    {isMissingTranslation ? (
                      <span className="missing-translation">{t('catalog.translation.missing')}</span>
                    ) : null}
                  </td>
                  <td>{city.region}</td>
                  <td>{city.lat}</td>
                  <td>{city.lng}</td>
                  {canWrite && (
                    <td>
                      <button type="button" onClick={() => { handleEdit(city); }}>{t('catalog.edit')}</button>
                      <button type="button" onClick={() => { void handleDelete(city); }}>{t('catalog.delete')}</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {canWrite && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="city-form">
          <h3>{editingId ? t('catalog.city.editTitle') : t('catalog.city.createTitle')}</h3>
          
          {formError && <p className="error" role="alert">{formError}</p>}
          
          <LocalizedTextField
            label={t('catalog.city.name')}
            value={name}
            onChange={setName}
            required
          />
          
          <div>
            <label htmlFor="region">{t('catalog.city.region')}</label>
            <input
              id="region"
              value={region}
              onChange={(e) => { setRegion(e.target.value); }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="lat">{t('catalog.city.lat')}</label>
            <input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => { setLat(e.target.value === '' ? '' : Number(e.target.value)); }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="lng">{t('catalog.city.lng')}</label>
            <input
              id="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => { setLng(e.target.value === '' ? '' : Number(e.target.value)); }}
              required
            />
          </div>
          
          <button type="submit" disabled={saving}>
            {saving ? t('catalog.saving') : t('catalog.save')}
          </button>
          
          {editingId && (
            <button type="button" onClick={resetForm} disabled={saving}>
              {t('catalog.cancel')}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
