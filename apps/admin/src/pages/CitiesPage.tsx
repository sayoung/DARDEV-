import { useEffect, useState, useRef } from 'react';
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
import { PageHeader } from '../components/PageHeader.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

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

  const formRef = useRef<HTMLFormElement>(null);

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
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="page-cities space-y-8">
      <PageHeader
        title={t('page.cities.title')}
        actions={
          canWrite && (
            <Button onClick={() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t('catalog.city.createTitle')}
            </Button>
          )
        }
      />

      {fetchError && <Alert variant="destructive" role="alert">{fetchError}</Alert>}
      
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('catalog.city.name')}</TableHead>
              <TableHead>{t('catalog.city.region')}</TableHead>
              <TableHead>{t('catalog.city.lat')}</TableHead>
              <TableHead>{t('catalog.city.lng')}</TableHead>
              {canWrite && <TableHead>{t('catalog.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map((city) => {
              const baseLang = i18n.language.split('-')[0];
              const isMissingTranslation = !city.name[baseLang as keyof typeof city.name] && baseLang !== 'fr';
              return (
                <TableRow key={city.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{localize(city.name, i18n.language)}</span>
                      {isMissingTranslation && (
                        <Badge variant="destructive">{t('catalog.translation.missing')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{city.region}</TableCell>
                  <TableCell>{city.lat}</TableCell>
                  <TableCell>{city.lng}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { handleEdit(city); }}>{t('catalog.edit')}</Button>
                        <Button variant="destructive" size="sm" onClick={() => { void handleDelete(city); }}>{t('catalog.delete')}</Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {canWrite && (
        <form ref={formRef} onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 max-w-xl">
          <h3 className="text-xl font-semibold">{editingId ? t('catalog.city.editTitle') : t('catalog.city.createTitle')}</h3>
          
          {formError && <Alert variant="destructive" role="alert">{formError}</Alert>}
          
          <LocalizedTextField
            label={t('catalog.city.name')}
            value={name}
            onChange={setName}
            required
          />
          
          <div className="space-y-2">
            <Label htmlFor="region">{t('catalog.city.region')}</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => { setRegion(e.target.value); }}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lat">{t('catalog.city.lat')}</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => { setLat(e.target.value === '' ? '' : Number(e.target.value)); }}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lng">{t('catalog.city.lng')}</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => { setLng(e.target.value === '' ? '' : Number(e.target.value)); }}
              required
            />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? t('catalog.saving') : t('catalog.save')}
            </Button>
            
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                {t('catalog.cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
