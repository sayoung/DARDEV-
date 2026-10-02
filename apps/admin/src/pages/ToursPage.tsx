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
import { PageHeader } from '../components/PageHeader.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';

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
    <div className="page-tours space-y-8">
      <PageHeader
        title={t('page.tours.title')}
        actions={
          canWrite && (
            <Button
              onClick={() => {
                navigate('/tours/new');
              }}
            >
              {t('catalog.tour.actions.new')}
            </Button>
          )
        }
      />

      {fetchError ? (
        <Alert variant="destructive" role="alert">
          {fetchError}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive" role="alert">
          {actionError}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tour-filter-status">{t('catalog.tour.filters.status')}</Label>
          <Select
            id="tour-filter-status"
            value={status ?? ''}
            onChange={(event) => {
              updateFilter('status', event.target.value);
            }}
          >
            <option value="">{t('catalog.tour.filters.allStatus')}</option>
            <option value={TourStatus.DRAFT}>{t('catalog.tour.status.DRAFT')}</option>
            <option value={TourStatus.PUBLISHED}>{t('catalog.tour.status.PUBLISHED')}</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tour-filter-city">{t('catalog.tour.filters.city')}</Label>
          <Select
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
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tour-filter-category">{t('catalog.tour.filters.category')}</Label>
          <Select
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
          </Select>
        </div>

        <form className="flex flex-col gap-1.5" onSubmit={handleSearchSubmit}>
          <Label htmlFor="tour-filter-q">{t('catalog.tour.filters.search')}</Label>
          <Input
            id="tour-filter-q"
            type="search"
            value={qInput}
            onChange={(event) => {
              setQInput(event.target.value);
            }}
          />
        </form>
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('catalog.tour.columns.title')}</TableHead>
                <TableHead>{t('catalog.tour.columns.city')}</TableHead>
                <TableHead>{t('catalog.tour.columns.status')}</TableHead>
                <TableHead>{t('catalog.tour.columns.scenes')}</TableHead>
                <TableHead>{t('catalog.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((tour) => {
                const baseLang = i18n.language.split('-')[0];
                const isMissingTranslation =
                  baseLang !== 'fr' && !tour.title[baseLang as keyof typeof tour.title];
                const city = cities.find((item) => item.id === tour.cityId);
                return (
                  <TableRow key={tour.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/tours/${tour.id}`}
                          className="text-primary hover:underline font-semibold"
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(`/tours/${tour.id}`);
                          }}
                        >
                          {localize(tour.title, i18n.language)}
                        </a>
                        {isMissingTranslation ? (
                          <Badge variant="destructive">{t('catalog.translation.missing')}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{city ? localize(city.name, i18n.language) : ''}</TableCell>
                    <TableCell>
                      <Badge variant={tour.status === TourStatus.PUBLISHED ? 'success' : 'secondary'}>
                        {t(`catalog.tour.status.${tour.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{tour.sceneCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigate(`/tours/${tour.id}`);
                          }}
                        >
                          {t('catalog.edit')}
                        </Button>
                        {canWrite ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={duplicating}
                            onClick={() => {
                              void handleDuplicate(tour.id);
                            }}
                          >
                            {t('catalog.tour.actions.duplicate')}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 ? (
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => {
                  updateFilter('page', String(page - 1));
                }}
              >
                {t('catalog.tour.pagination.prev')}
              </Button>
              <span className="text-sm text-muted-foreground">{t('catalog.tour.pagination.info', { page, total: totalPages })}</span>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => {
                  updateFilter('page', String(page + 1));
                }}
              >
                {t('catalog.tour.pagination.next')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
