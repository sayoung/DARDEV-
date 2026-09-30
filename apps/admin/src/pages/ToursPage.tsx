import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { localize, Role, type PaginatedTourResponse, type CityResponse, type CategoryResponse, type TourStatus } from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { listTours, listCities, listCategories, duplicateTour } from '../api/catalog.js';
import { navigate, navigateWithSearch, useAppLocation } from '../router.js';

export function ToursPage() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.profile : null;
  const canWrite = user?.role === Role.ADMIN || user?.role === Role.EDITOR;

  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const [toursData, setToursData] = useState<PaginatedTourResponse | null>(null);
  const [cities, setCities] = useState<CityResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const statusFilter = searchParams.get('status') || '';
  const cityIdFilter = searchParams.get('cityId') || '';
  const categoryIdFilter = searchParams.get('categoryId') || '';
  const qFilter = searchParams.get('q') || '';
  const [qInput, setQInput] = useState(qFilter);

  useEffect(() => {
    setQInput(qFilter);
  }, [qFilter]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setFetchError(null);
        setLoading(true);
        const [tData, cData, catData] = await Promise.all([
          listTours({
            page,
            pageSize: 10,
            status: statusFilter ? (statusFilter as unknown as TourStatus) : undefined,
            cityId: cityIdFilter || undefined,
            categoryId: categoryIdFilter || undefined,
            q: qFilter || undefined,
          }),
          listCities(),
          listCategories(),
        ]);
        if (mounted) {
          setToursData(tData);
          setCities(cData);
          setCategories(catData);
        }
      } catch {
        if (mounted) {
          setFetchError(t('catalog.errors.fetchFailed'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, [page, statusFilter, cityIdFilter, categoryIdFilter, qFilter, t]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    navigateWithSearch('/tours', next.toString());
  }

  async function handleDuplicate(id: string) {
    setActionError(null);
    try {
      const copy = await duplicateTour(id);
      navigate(`/tours/${copy.id}`);
    } catch {
      setActionError(t('catalog.errors.generic'));
    }
  }

  function handleSearchSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    updateFilter('q', qInput);
  }

  const items = toursData?.items || [];
  const total = toursData?.total || 0;
  const pageSize = toursData?.pageSize || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page-tours">
      <h2>{t('page.tours.title')}</h2>

      {fetchError && (
        <p className="error" role="alert">
          {fetchError}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}

      <div className="filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select value={statusFilter} onChange={(e) => { updateFilter('status', e.target.value); }}>
          <option value="">{t('catalog.tour.filters.allStatus')}</option>
          <option value="DRAFT">{t('catalog.tour.status.DRAFT')}</option>
          <option value="PUBLISHED">{t('catalog.tour.status.PUBLISHED')}</option>
        </select>

        <select value={cityIdFilter} onChange={(e) => { updateFilter('cityId', e.target.value); }}>
          <option value="">{t('catalog.tour.filters.allCities')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {localize(c.name, i18n.language)}
            </option>
          ))}
        </select>

        <select value={categoryIdFilter} onChange={(e) => { updateFilter('categoryId', e.target.value); }}>
          <option value="">{t('catalog.tour.filters.allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {localize(c.name, i18n.language)}
            </option>
          ))}
        </select>

        <form onSubmit={handleSearchSubmit} style={{ display: 'inline-block' }}>
          <input
            type="search"
            value={qInput}
            placeholder={t('catalog.tour.filters.search')}
            onChange={(e) => { setQInput(e.target.value); }}
          />
          <button type="submit" style={{ display: 'none' }}>
            {t('catalog.tour.filters.search')}
          </button>
        </form>

        {canWrite && (
          <button
            type="button"
            onClick={() => {
              navigate('/tours/new');
            }}
            style={{ marginInlineStart: 'auto' }}
          >
            {t('catalog.tour.actions.new')}
          </button>
        )}
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>{t('catalog.tour.columns.title')}</th>
                <th>{t('catalog.tour.columns.city')}</th>
                <th>{t('catalog.tour.columns.status')}</th>
                <th>{t('catalog.tour.columns.scenes')}</th>
                <th>{t('catalog.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tour) => {
                const baseLang = i18n.language.split('-')[0];
                const isMissingTranslation = !tour.title[baseLang as keyof typeof tour.title] && baseLang !== 'fr';
                const city = cities.find((c) => c.id === tour.cityId);
                return (
                  <tr key={tour.id}>
                    <td>
                      <a
                        href={`/tours/${tour.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/tours/${tour.id}`);
                        }}
                      >
                        {localize(tour.title, i18n.language)}
                      </a>
                      {isMissingTranslation ? (
                        <span className="missing-translation" style={{ marginInlineStart: '0.5rem' }}>{t('catalog.translation.missing')}</span>
                      ) : null}
                    </td>
                    <td>{city ? localize(city.name, i18n.language) : ''}</td>
                    <td>{t(`catalog.tour.status.${tour.status}`)}</td>
                    <td>{tour.sceneCount}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/tours/${tour.id}`);
                        }}
                      >
                        {t('catalog.edit')}
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleDuplicate(tour.id);
                          }}
                        >
                          {t('catalog.tour.actions.duplicate')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => { updateFilter('page', String(page - 1)); }}
              >
                {t('catalog.tour.pagination.prev')}
              </button>
              <span>{t('catalog.tour.pagination.info', { page, total: totalPages })}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => { updateFilter('page', String(page + 1)); }}
              >
                {t('catalog.tour.pagination.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
