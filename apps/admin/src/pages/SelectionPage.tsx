import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, TourStatus, type CategoryResponse, type CityResponse, type PaginatedTourResponse, type SelectionResponse, type SelectionUpdate, type TourResponse } from '@xplor/shared';
import { getHotelSelection, saveHotelSelection } from '../api/hotels.js';
import { getTour, listCategories, listCities, listTours } from '../api/catalog.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { PageHeader } from '../components/PageHeader.js';
import { Select } from '../components/ui/Select.js';
import { addTour, fromResponse, moveTour, removeTour, setFeatured, toggleAttract } from './selectionDraft.js';

type LoadedTour = Pick<TourResponse, 'id' | 'title'>;

export function SelectionPage({ hotelId }: { hotelId: string }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<SelectionUpdate | null>(null);
  const [tourTitles, setTourTitles] = useState<Record<string, LoadedTour>>({});
  const [cities, setCities] = useState<CityResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [catalog, setCatalog] = useState<PaginatedTourResponse | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError(null);
        const response = await getHotelSelection(hotelId);
        const nextDraft = fromResponse(response);
        const tours = await Promise.all(nextDraft.tourIds.map((id) => getTour(id)));
        if (!active) return;
        setDraft(nextDraft);
        setVersion(response.version);
        setTourTitles(Object.fromEntries(tours.map((tour) => [tour.id, { id: tour.id, title: tour.title }])));
      } catch {
        if (active) setError(t('page.hotelSelection.loadError'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [hotelId, t]);

  useEffect(() => {
    let active = true;
    Promise.all([listCities(), listCategories()])
      .then(([cityData, categoryData]) => {
        if (!active) return;
        setCities(cityData);
        setCategories(categoryData);
      })
      .catch(() => {
        if (active) setCatalogError(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(false);
      try {
        const result = await listTours({
          page: 1,
          pageSize: 100,
          status: TourStatus.PUBLISHED,
          cityId: cityId || undefined,
          categoryId: categoryId || undefined,
          q: search || undefined,
        });
        if (active) setCatalog(result);
      } catch {
        if (active) setCatalogError(true);
      } finally {
        if (active) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => { active = false; };
  }, [cityId, categoryId, search]);

  async function save() {
    if (draft === null || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response: SelectionResponse = await saveHotelSelection(hotelId, draft);
      setDraft(fromResponse(response));
      setVersion(response.version);
      setSaved(true);
    } catch {
      setError(t('page.hotelSelection.error'));
    } finally {
      setSaving(false);
    }
  }

  function submitSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function addCatalogTour(tour: TourResponse) {
    setTourTitles((current) => ({ ...current, [tour.id]: { id: tour.id, title: tour.title } }));
    setDraft((current) => current ? addTour(current, tour.id) : current);
    setSaved(false);
  }

  const orderedTours = draft?.tourIds.map((id) => tourTitles[id]).filter((tour): tour is LoadedTour => tour !== undefined) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title={t('page.hotelSelection.title')} />
      {version !== null ? <p className="text-sm text-muted-foreground">{t('page.hotelSelection.version', { version })}</p> : null}
      {error !== null ? <Alert variant="destructive" role="alert">{error}</Alert> : null}
      {saved ? <Alert role="status">{t('page.hotelSelection.saved')}</Alert> : null}
      {loading ? <p role="status" className="text-muted-foreground">{t('common.loading')}</p> : null}
      {!loading && draft !== null ? (
        <>
          <section className="space-y-4" aria-labelledby="selection-catalog-heading">
            <h2 id="selection-catalog-heading" className="text-lg font-semibold">{t('page.hotelSelection.catalog')}</h2>
            <div className="flex flex-wrap items-end gap-4">
              <form className="flex flex-col gap-1.5" onSubmit={submitSearch}>
                <Label htmlFor="selection-catalog-search">{t('page.hotelSelection.search')}</Label>
                <Input id="selection-catalog-search" type="search" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); }} />
                <Button type="submit" variant="outline" size="sm">{t('page.hotelSelection.searchAction')}</Button>
              </form>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="selection-catalog-city">{t('page.hotelSelection.city')}</Label>
                <Select id="selection-catalog-city" value={cityId} onChange={(event) => { setCityId(event.target.value); }}>
                  <option value="">{t('page.hotelSelection.allCities')}</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{localize(city.name, i18n.language)}</option>)}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="selection-catalog-category">{t('page.hotelSelection.category')}</Label>
                <Select id="selection-catalog-category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); }}>
                  <option value="">{t('page.hotelSelection.allCategories')}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{localize(category.name, i18n.language)}</option>)}
                </Select>
              </div>
            </div>
            {catalogError ? <Alert variant="destructive" role="alert">{t('page.hotelSelection.catalogError')}</Alert> : null}
            {catalogLoading ? <p role="status" className="text-muted-foreground">{t('common.loading')}</p> : null}
            {!catalogLoading && catalog !== null ? (
              <ul className="space-y-3">
                {catalog.items.map((tour) => {
                  const selected = draft.tourIds.includes(tour.id);
                  const city = cities.find((item) => item.id === tour.cityId);
                  const tourCategories = categories.filter((category) => tour.categoryIds.includes(category.id));
                  return (
                    <li key={tour.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                      <span className="min-w-40 flex-1 font-medium">{localize(tour.title, i18n.language)}</span>
                      {city ? <span className="text-sm text-muted-foreground">{localize(city.name, i18n.language)}</span> : null}
                      {tourCategories.map((category) => <span key={category.id} className="text-sm text-muted-foreground">{localize(category.name, i18n.language)}</span>)}
                      <Button type="button" size="sm" disabled={selected} onClick={() => { addCatalogTour(tour); }}>
                        {selected ? t('page.hotelSelection.added') : t('page.hotelSelection.add')}
                      </Button>
                    </li>
                  );
                })}
                {catalog.items.length === 0 ? <li className="text-muted-foreground">{t('page.hotelSelection.noCatalogResults')}</li> : null}
              </ul>
            ) : null}
          </section>
          <section className="space-y-4" aria-labelledby="selection-tours-heading">
            <h2 id="selection-tours-heading" className="text-lg font-semibold">{t('page.hotelSelection.selectedTours')}</h2>
            {orderedTours.length === 0 ? <p className="text-muted-foreground">{t('page.hotelSelection.empty')}</p> : null}
            <ol aria-labelledby="selection-tours-heading" className="space-y-3">
              {orderedTours.map((tour, index) => (
                <li key={tour.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                  <span className="min-w-40 flex-1 font-medium">{localize(tour.title, i18n.language)}</span>
                  <Button type="button" variant="outline" size="sm" disabled={index === 0} aria-label={`${t('page.hotelSelection.moveUp')} ${localize(tour.title, i18n.language)}`} onClick={() => { setDraft((current) => current ? moveTour(current, tour.id, -1) : current); setSaved(false); }}>
                    {t('page.hotelSelection.moveUp')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={index === orderedTours.length - 1} aria-label={`${t('page.hotelSelection.moveDown')} ${localize(tour.title, i18n.language)}`} onClick={() => { setDraft((current) => current ? moveTour(current, tour.id, 1) : current); setSaved(false); }}>
                    {t('page.hotelSelection.moveDown')}
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => { setDraft((current) => current ? removeTour(current, tour.id) : current); setSaved(false); }}>
                    {t('page.hotelSelection.remove')}
                  </Button>
                  <div className="flex items-center gap-2">
                    <input id={`featured-${tour.id}`} type="radio" name="featured-tour" checked={draft.featuredTourId === tour.id} onChange={() => { setDraft((current) => current ? setFeatured(current, tour.id) : current); setSaved(false); }} />
                    <Label htmlFor={`featured-${tour.id}`}>{t('page.hotelSelection.featured')}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id={`attract-${tour.id}`} type="checkbox" checked={draft.attractTourIds.includes(tour.id)} onChange={() => { setDraft((current) => current ? toggleAttract(current, tour.id) : current); setSaved(false); }} />
                    <Label htmlFor={`attract-${tour.id}`}>{t('page.hotelSelection.attract')}</Label>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <Button type="button" disabled={saving} onClick={() => { void save(); }}>
            {saving ? t('page.hotelSelection.saving') : t('page.hotelSelection.save')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
