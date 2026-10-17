import { useEffect, useState, type SubmitEvent } from 'react';
import { KioskCreateSchema, KioskDeviceTypeSchema, type EnrollmentCodeResponse, type KioskDeviceType } from '@xplor/shared';
import { useTranslation } from 'react-i18next';
import { listHotels } from '../api/hotels.js';
import { createKiosk, issueEnrollmentCode } from '../api/kiosks.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';

export interface KioskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  kioskId?: string;
}

const DEVICE_TYPES = KioskDeviceTypeSchema.options;
const DEFAULT_DEVICE_TYPE: KioskDeviceType = 'TOUCH_SCREEN';

export function KioskCreateDialog({ open, onClose, kioskId }: KioskCreateDialogProps) {
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<Array<{ id: string; name: string }>>([]);
  const [label, setLabel] = useState('');
  const [hotelId, setHotelId] = useState('');
  const [deviceType, setDeviceType] = useState<KioskDeviceType>(DEFAULT_DEVICE_TYPE);
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState('60');
  const [code, setCode] = useState<EnrollmentCodeResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!open) {
      setLabel('');
      setHotelId('');
      setDeviceType(DEFAULT_DEVICE_TYPE);
      setIdleTimeoutSeconds('60');
      setCode(null);
      setError(false);
      setLoading(false);
      return;
    }

    if (kioskId) {
      setLoading(true);
      void issueEnrollmentCode(kioskId).then((response) => {
        if (active) setCode(response);
      }).catch(() => {
        if (active) setError(true);
      }).finally(() => {
        if (active) setLoading(false);
      });
    } else {
      void listHotels().then((response) => {
        if (active) {
          setHotels(response.map(({ id, name }) => ({ id, name })));
          setHotelId((current) => current || response[0]?.id || '');
        }
      }).catch(() => {
        if (active) setError(true);
      });
    }
    return () => { active = false; };
  }, [open, kioskId]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    const parsed = KioskCreateSchema.safeParse({
      label,
      hotelId,
      deviceType,
      idleTimeoutSeconds: Number(idleTimeoutSeconds),
    });
    if (!parsed.success) {
      setError(true);
      return;
    }

    setLoading(true);
    try {
      const kiosk = await createKiosk(parsed.data);
      setCode(await issueEnrollmentCode(kiosk.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogHeader>
        <DialogTitle>{code ? t('page.kiosks.enrollmentCode.title') : t('page.kiosks.actions.newKiosk')}</DialogTitle>
      </DialogHeader>
      {code ? (
        <>
          <DialogContent className="space-y-3">
            <p>{t('page.kiosks.enrollmentCode.instruction')}</p>
            <p className="rounded-md bg-muted p-4 text-center font-mono text-3xl font-bold tracking-[0.3em]" aria-label={t('page.kiosks.enrollmentCode.title')}>
              {code.code}
            </p>
          </DialogContent>
          <DialogFooter>
            <Button type="button" onClick={handleClose}>{t('page.kiosks.enrollmentCode.close')}</Button>
          </DialogFooter>
        </>
      ) : (
        kioskId ? (
          <>
            <DialogContent>
              {loading ? <p role="status">{t('common.loading')}</p> : null}
              {error ? <Alert variant="destructive" role="alert">{t('page.kiosks.actionError')}</Alert> : null}
            </DialogContent>
            {!loading ? <DialogFooter>
              <Button type="button" onClick={handleClose}>{t('common.close')}</Button>
            </DialogFooter> : null}
          </>
        ) : (
        <form onSubmit={(event) => { void handleSubmit(event); }}>
          <DialogContent className="space-y-4">
            {error ? <Alert variant="destructive" role="alert">{t('page.kiosks.form.createError')}</Alert> : null}
            <>
              <div className="space-y-2">
                <Label htmlFor="kiosk-label">{t('page.kiosks.form.label')}</Label>
                <Input id="kiosk-label" value={label} onChange={(event) => { setLabel(event.target.value); }} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-hotel">{t('page.kiosks.form.hotel')}</Label>
                <Select id="kiosk-hotel" value={hotelId} onChange={(event) => { setHotelId(event.target.value); }} required disabled={hotels.length === 0}>
                  <option value="">{t('page.kiosks.form.selectHotel')}</option>
                  {hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-device-type">{t('page.kiosks.form.deviceType')}</Label>
                <Select id="kiosk-device-type" value={deviceType} onChange={(event) => { setDeviceType(event.target.value as KioskDeviceType); }}>
                  {DEVICE_TYPES.map((type) => <option key={type} value={type}>{t(`page.kiosks.form.deviceTypes.${type}`)}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kiosk-idle-timeout">{t('page.kiosks.form.idleTimeout')}</Label>
                <Input id="kiosk-idle-timeout" type="number" min={15} max={600} step={1} value={idleTimeoutSeconds} onChange={(event) => { setIdleTimeoutSeconds(event.target.value); }} required />
              </div>
            </>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>{t('page.kiosks.form.cancel')}</Button>
            <Button type="submit" disabled={loading || hotels.length === 0}>{t('page.kiosks.form.submit')}</Button>
          </DialogFooter>
        </form>
        )
      )}
    </Dialog>
  );
}
