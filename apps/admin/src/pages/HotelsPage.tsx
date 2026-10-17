import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type HotelResponse } from '@xplor/shared';
import { listHotels } from '../api/hotels.js';
import { Alert } from '../components/ui/Alert.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { PageHeader } from '../components/PageHeader.js';
import { hrefFor, navigate } from '../router.js';

export function HotelsPage() {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<HotelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    void fetchHotels();
  }, []);

  async function fetchHotels() {
    try {
      setFetchError(false);
      setHotels(await listHotels());
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectionClick(event: React.MouseEvent<HTMLAnchorElement>, path: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) {
      return;
    }
    event.preventDefault();
    navigate(path);
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('page.hotels.title')} />

      {fetchError ? (
        <Alert variant="destructive">{t('page.hotels.loadError')}</Alert>
      ) : loading ? (
        <p role="status" className="text-muted-foreground">{t('common.loading')}</p>
      ) : hotels.length === 0 ? (
        <p role="status" className="text-muted-foreground">{t('page.hotels.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('page.hotels.columns.name')}</TableHead>
              <TableHead>{t('page.hotels.columns.city')}</TableHead>
              <TableHead>{t('page.hotels.selection')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotels.map((hotel) => {
              const path = `/hotels/${encodeURIComponent(hotel.id)}/selection`;
              return (
                <TableRow key={hotel.id}>
                  <TableCell>{hotel.name}</TableCell>
                  <TableCell>{hotel.cityId}</TableCell>
                  <TableCell>
                    <a
                      href={hrefFor(path)}
                      onClick={(event) => { handleSelectionClick(event, path); }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t('page.hotels.selection')}
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
