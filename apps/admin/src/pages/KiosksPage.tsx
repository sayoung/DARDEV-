import { useCallback, useEffect, useState } from 'react';
import { type Kiosk, type KioskConnectionState } from '@xplor/shared';
import { useTranslation } from 'react-i18next';
import { listHotels } from '../api/hotels.js';
import { disableKiosk, forceSyncKiosk, listKiosks } from '../api/kiosks.js';
import { KioskCreateDialog } from './KioskCreateDialog.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
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
  const [actionError, setActionError] = useState(false);
  const [actingKioskId, setActingKioskId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollmentKioskId, setEnrollmentKioskId] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    try {
      setFetchError(false);
      const [kioskResponse, hotels] = await Promise.all([listKiosks(), listHotels()]);
      setKiosks(kioskResponse.items);
      setHotelNames(new Map(hotels.map((hotel) => [hotel.id, hotel.name])));
    } catch {
      setFetchError(true);
      throw new Error('Kiosk list refresh failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData().catch(() => undefined);
  }, [fetchData]);

  async function runAction(kioskId: string, action: () => Promise<unknown>) {
    setActionError(false);
    setActingKioskId(kioskId);
    try {
      await action();
      await fetchData();
    } catch {
      setActionError(true);
    } finally {
      setActingKioskId(null);
    }
  }

  function closeDialog() {
    setDialogOpen(false);
    setEnrollmentKioskId(undefined);
    void fetchData().catch(() => undefined);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('page.kiosks.title')}
        actions={<Button type="button" onClick={() => { setEnrollmentKioskId(undefined); setDialogOpen(true); }}>{t('page.kiosks.actions.newKiosk')}</Button>}
      />

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
              <TableHead>{t('page.kiosks.columns.actions')}</TableHead>
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
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {kiosk.status === 'PENDING' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actingKioskId !== null}
                        onClick={() => { setEnrollmentKioskId(kiosk.id); setDialogOpen(true); }}
                      >
                        {t('page.kiosks.actions.enrollmentCode')}
                      </Button>
                    ) : null}
                    {kiosk.status !== 'DISABLED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actingKioskId !== null}
                        onClick={() => {
                          if (window.confirm(t('page.kiosks.confirmDisable'))) {
                            void runAction(kiosk.id, () => disableKiosk(kiosk.id));
                          }
                        }}
                      >
                        {t('page.kiosks.actions.disable')}
                      </Button>
                    ) : null}
                    {kiosk.status !== 'DISABLED' && kiosk.status !== 'PENDING' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={actingKioskId !== null}
                        onClick={() => void runAction(kiosk.id, () => forceSyncKiosk(kiosk.id))}
                      >
                        {t('page.kiosks.actions.forceSync')}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {actionError ? (
        <Alert variant="destructive" role="alert">{t('page.kiosks.actionError')}</Alert>
      ) : null}
      <KioskCreateDialog open={dialogOpen} kioskId={enrollmentKioskId} onClose={closeDialog} />
    </div>
  );
}
