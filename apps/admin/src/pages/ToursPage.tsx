import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  idSchema,
  localize,
  Role,
  TourStatus,
  z,
  type CategoryResponse,
  type CityResponse,
  type PaginatedTourResponse,
} from '@xplor/shared';
import { useAuth } from '../auth/AuthProvider.js';
import { duplicateTour, listCategories, listCities, listTours } from '../api/catalog.js';
import { navigate, navigateWithSearch, useAppLocation } from '../router.js';

const pageSchema = z.number().int().min(1);

/** `page` absent ou invalide vaut 1. Les autres filtres invalides sont ignorés. */
function readPage(raw: string | null): number {
  if (raw === null || raw === '') {
    return 1;
  }
  const parsed = pageSchema.safeParse(Number(raw));
  return parsed.success ? parsed.data : 1;
}

function readStatus(raw: string | null): TourStatus | undefined {
  const parsed = z.enum(TourStatus).safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function readId(raw: string | null): string | undefined {
  const parsed = idSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function ToursPage() {
  const { t, i18n } = useTranslation();
  const { state } = useAuth();
  const user = state.status === 'authenticated' ? state.profile : null;
  const canWrite = user?.role === Role.ADMIN || user?.role === Role.EDITOR;

  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const page = readPage(searchParams.get('page'));
  const status = readStatus(searchParams.get('status'));
  const cityId = readId(searchParams.get('cityId'));
  const categoryId = readId(searchParams.get('categoryId'));
  const qFilter = searchParams.get('q') ?? '';

  const [toursData, setToursData] = useState<PaginatedTourResponse | null>(null);
  const [cities, setCities] = useState<CityResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicateInProgressId, setDuplicateInProgressId] = useState<string | null>(null);
  const [qInput, setQInput] = useState(qFilter);
  const duplicateLock = useRef(false);

  useEffect(() => {
    setQInput(qFilter);
  }, [qFilter]);

  useEffect(() => {
    let mounted = true;
    async function loadCatalogs() {
      try {
        const [cityData, categoryData] = await Promise.all([listCities(), listCategories()]);
        if (mounted) {
          setCities(cityData);
          setCategories(categoryData);
        }
      } catch {
        // La liste des visites reste affichable si les filtres ville/catégorie échouent.
      }
    }
    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchTours() {
      try {
        setFetchError(null);
        setLoading(true);
        const data = await listTours({
          page,
          pageSize: 10,
          status,
          cityId,
          categoryId,
          q: qFilter || undefined,
        });
        if (mounted) {
          setToursData(data);
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
    void fetchTours();
    return () => {
      mounted = false;
    };
  }, [page, status, cityId, categoryId, qFilter, t]);

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
    if (duplicateLock.current) {
      return;
    }
    duplicateLock.current = true;
    setActionError(null);
    setDuplicateInProgressId(id);
    try {
      const copy = await duplicateTour(id);
      navigate(`/tours/${copy.id}`);
    } catch {
      setActionError(t('catalog.errors.generic'));
    } finally {
      duplicateLock.current = false;
      setDuplicateInProgressId(null);
    }
  }

  function handleSearchSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter('q', qInput);
  }

  const items = toursData?.items ?? [];
  const total = toursData?.total ?? 0;
  const pageSize = toursData?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const duplicating = duplicateInProgressId !== null;

  return (
    <div className="page-tours">
      <h2>{t('page.tours.title')}</h2>

      {fetchError ? (
        <p className="error" role="alert">
          {fetchError}
        </p>
      ) : null}
      {actionError ? (
        <p className="error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="tour-filters">
        <div className="tour-filter">
          <label htmlFor="tour-filter-status">{t('catalog.tour.filters.status')}</label>
          <select
            id="tour-filter-status"
            value={status ?? ''}
            onChange={(event) => {
              updateFilter('status', event.target.value);
            }}
          >
            <option value="">{t('catalog.tour.filters.allStatus')}</option>
            <option value={TourStatus.DRAFT}>{t('catalog.tour.status.DRAFT')}</option>
            <option value={TourStatus.PUBLISHED}>{t('catalog.tour.status.PUBLISHED')}</option>
          </select>
        </div>

        <div className="tour-filter">
          <label htmlFor="tour-filter-city">{t('catalog.tour.filters.city')}</label>
          <select
            id="tour-filter-city"
            value={cityId ?? ''}
            onChange={(event) => {
              updateFilter('cityId', event.target.value);
            }}
          >
            <option value="">{t('catalog.tour.filters.allCities')}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {localize(city.name, i18n.language)}
              </option>
            ))}
          </select>
        </div>

        <div className="tour-filter">
          <label htmlFor="tour-filter-category">{t('catalog.tour.filters.category')}</label>
          <select
            id="tour-filter-category"
            value={categoryId ?? ''}
            onChange={(event) => {
              updateFilter('categoryId', event.target.value);
            }}
          >
            <option value="">{t('catalog.tour.filters.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {localize(category.name, i18n.language)}
              </option>
            ))}
          </select>
        </div>

        <form className="tour-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="tour-filter-q">{t('catalog.tour.filters.search')}</label>
          <input
            id="tour-filter-q"
            type="search"
            value={qInput}
            onChange={(event) => {
              setQInput(event.target.value);
            }}
          />
        </form>

        {canWrite ? (
          <button
            type="button"
            className="tour-new"
            onClick={() => {
              navigate('/tours/new');
            }}
          >
            {t('catalog.tour.actions.new')}
          </button>
        ) : null}
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
                const isMissingTranslation =
                  baseLang !== 'fr' && !tour.title[baseLang as keyof typeof tour.title];
                const city = cities.find((item) => item.id === tour.cityId);
                return (
                  <tr key={tour.id}>
                    <td>
                      <a
                        href={`/tours/${tour.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/tours/${tour.id}`);
                        }}
                      >
                        {localize(tour.title, i18n.language)}
                      </a>
                      {isMissingTranslation ? (
                        <span className="missing-translation">{t('catalog.translation.missing')}</span>
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
                      {canWrite ? (
                        <button
                          type="button"
                          disabled={duplicating}
                          onClick={() => {
                            void handleDuplicate(tour.id);
                          }}
                        >
                          {t('catalog.tour.actions.duplicate')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <div className="tour-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  updateFilter('page', String(page - 1));
                }}
              >
                {t('catalog.tour.pagination.prev')}
              </button>
              <span>{t('catalog.tour.pagination.info', { page, total: totalPages })}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  updateFilter('page', String(page + 1));
                }}
              >
                {t('catalog.tour.pagination.next')}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
