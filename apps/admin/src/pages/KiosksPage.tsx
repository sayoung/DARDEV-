import { useEffect, useState } from 'react';
import { type Kiosk, type KioskConnectionState } from '@xplor/shared';
import { useTranslation } from 'react-i18next';
import { listHotels } from '../api/hotels.js';
import { listKiosks } from '../api/kiosks.js';
import { Alert } from '../components/ui/Alert.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { PageHeader } from '../components/PageHeader.js';

const STATUS_LABEL = {
  ONLINE: 'page.kiosks.status.online',
  OFFLINE: 'page.kiosks.status.offline',
  DESYNCHRONIZED: 'page.kiosks.status.outOfSync',
  PENDING: 'page.kiosks.status.pending',
  DISABLED: 'page.kiosks.status.disabled',
} as const satisfies Record<KioskConnectionState, `page.kiosks.status.${string}`>;

export function KiosksPage() {
  const { t } = useTranslation();
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [hotelNames, setHotelNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setFetchError(false);
        const [kioskResponse, hotels] = await Promise.all([listKiosks(), listHotels()]);
        setKiosks(kioskResponse.items);
        setHotelNames(new Map(hotels.map((hotel) => [hotel.id, hotel.name])));
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader title={t('page.kiosks.title')} />

      {fetchError ? (
        <Alert variant="destructive">{t('page.kiosks.loadError')}</Alert>
      ) : loading ? (
        <p role="status" className="text-muted-foreground">{t('common.loading')}</p>
      ) : kiosks.length === 0 ? (
        <p role="status" className="text-muted-foreground">{t('page.kiosks.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('page.kiosks.columns.label')}</TableHead>
              <TableHead>{t('page.kiosks.columns.hotel')}</TableHead>
              <TableHead>{t('page.kiosks.columns.state')}</TableHead>
              <TableHead>{t('page.kiosks.columns.lastHeartbeat')}</TableHead>
              <TableHead>{t('page.kiosks.columns.version')}</TableHead>
              <TableHead>{t('page.kiosks.columns.freeSpace')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kiosks.map((kiosk) => (
              <TableRow key={kiosk.id}>
                <TableCell>{kiosk.label}</TableCell>
                <TableCell>{hotelNames.get(kiosk.hotelId) ?? kiosk.hotelId}</TableCell>
                <TableCell>{t(STATUS_LABEL[kiosk.connectionState])}</TableCell>
                <TableCell>
                  {kiosk.lastHeartbeatAt === null
                    ? t('page.kiosks.notAvailable')
                    : new Date(kiosk.lastHeartbeatAt).toLocaleString()}
                </TableCell>
                <TableCell>{kiosk.appVersion ?? t('page.kiosks.notAvailable')}</TableCell>
                <TableCell>
                  {kiosk.storageFreeMb === null
                    ? t('page.kiosks.notAvailable')
                    : t('page.kiosks.freeSpaceValue', { mb: kiosk.storageFreeMb })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
