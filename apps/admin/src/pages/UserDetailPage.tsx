import {
  LANGS,
  Role,
  z,
  type AdminUser,
  type HotelListResponse,
  type Lang,
  type UpdateAdminUserRequest,
} from '@xplor/shared';
import { useEffect, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api/client.js';
import { listHotels } from '../api/hotels.js';
import { getUser, setUserHotels, updateUser } from '../api/users.js';
import { PageHeader } from '../components/PageHeader.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';
import { Switch } from '../components/ui/Switch.js';
import { navigate, useAppLocation } from '../router.js';

export interface UserDetailPageProps {
  userId?: string;
}

export function UserDetailPage({ userId }: UserDetailPageProps) {
  const { t } = useTranslation();
  const { route } = useAppLocation();

  const routeUserId = route.name === 'user-detail' ? route.id : '';
  const id = userId !== undefined && userId !== '' ? userId : routeUserId;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);

  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<Role>(Role.EDITOR);
  const [active, setActive] = useState<boolean>(true);
  const [uiLang, setUiLang] = useState<Lang>('fr');

  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [hotels, setHotels] = useState<HotelListResponse>([]);
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState<boolean>(false);
  const [hotelsLoadError, setHotelsLoadError] = useState<boolean>(false);
  const [hotelsSaving, setHotelsSaving] = useState<boolean>(false);
  const [hotelsSaveError, setHotelsSaveError] = useState<string | null>(null);
  const [hotelsSaveSuccess, setHotelsSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (id === '') {
      setLoading(false);
      setLoadError(true);
      return;
    }

    setLoading(true);
    setLoadError(false);

    void getUser(id)
      .then((data) => {
        if (mounted) {
          setUser(data);
          setName(data.name);
          setRole(data.role);
          setActive(data.active);
          setUiLang(data.uiLang);
          setSelectedHotelIds(data.hotelIds);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const hasNameChanged = user !== null && name.trim() !== user.name;
  const hasRoleChanged = user !== null && role !== user.role;
  const hasActiveChanged = user !== null && active !== user.active;
  const hasUiLangChanged = user !== null && uiLang !== user.uiLang;

  const isDirty = hasNameChanged || hasRoleChanged || hasActiveChanged || hasUiLangChanged;
  const canSubmit = isDirty && !saving && name.trim().length > 0;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit || id === '') {
      return;
    }

    const patch: UpdateAdminUserRequest = {};
    if (hasNameChanged) {
      patch.name = name.trim();
    }
    if (hasRoleChanged) {
      patch.role = role;
    }
    if (hasActiveChanged) {
      patch.active = active;
    }
    if (hasUiLangChanged) {
      patch.uiLang = uiLang;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updated = await updateUser(id, patch);
      setUser(updated);
      setName(updated.name);
      setRole(updated.role);
      setActive(updated.active);
      setUiLang(updated.uiLang);
      setSelectedHotelIds(updated.hotelIds);
      setSaveSuccess(t('page.userDetail.saveSuccess'));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setSaveError(t('page.userDetail.errorSelfModification'));
        } else if (err.status === 409) {
          setSaveError(t('page.userDetail.errorLastAdmin'));
        } else {
          setSaveError(t('page.userDetail.saveError'));
        }
      } else {
        setSaveError(t('page.userDetail.saveError'));
      }
    } finally {
      setSaving(false);
    }
  }

  const isHotelRole =
    user !== null && (user.role === Role.HOTEL_MANAGER || user.role === Role.PARTNER);

  useEffect(() => {
    let mounted = true;
    if (!isHotelRole) {
      return;
    }

    setHotelsLoading(true);
    setHotelsLoadError(false);

    async function fetchHotels() {
      try {
        const data = await listHotels();
        if (mounted) {
          setHotels(data);
        }
      } catch {
        if (mounted) {
          setHotelsLoadError(true);
        }
      } finally {
        if (mounted) {
          setHotelsLoading(false);
        }
      }
    }

    void fetchHotels();

    return () => {
      mounted = false;
    };
  }, [isHotelRole]);

  function toggleHotel(hotelId: string): void {
    setSelectedHotelIds((prev) =>
      prev.includes(hotelId)
        ? prev.filter((item) => item !== hotelId)
        : [...prev, hotelId],
    );
  }

  async function handleSaveHotels(
    event?: SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    if (event) {
      event.preventDefault();
    }
    if (user === null || hotelsSaving) {
      return;
    }

    setHotelsSaving(true);
    setHotelsSaveError(null);
    setHotelsSaveSuccess(null);

    try {
      const updated = await setUserHotels(user.id, selectedHotelIds);
      setUser(updated);
      setName(updated.name);
      setRole(updated.role);
      setActive(updated.active);
      setUiLang(updated.uiLang);
      setSelectedHotelIds(updated.hotelIds);
      setHotelsSaveSuccess(t('page.userDetail.hotels.saveSuccess'));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setHotelsSaveError(t('page.userDetail.hotels.errorIncompatibleRole'));
        } else if (err.status === 400) {
          setHotelsSaveError(t('page.userDetail.hotels.errorUnknownHotel'));
        } else {
          setHotelsSaveError(t('page.userDetail.hotels.saveError'));
        }
      } else {
        setHotelsSaveError(t('page.userDetail.hotels.saveError'));
      }
    } finally {
      setHotelsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.userDetail.title')}
        subtitle={user !== null ? user.email : t('page.userDetail.subtitle')}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              navigate('/users');
            }}
          >
            {t('page.userDetail.actions.back')}
          </Button>
        }
      />

      {loading ? (
        <p role="status" className="text-muted-foreground">
          {t('common.loading')}
        </p>
      ) : null}

      {loadError ? (
        <Alert variant="destructive" role="alert">
          {t('page.userDetail.loadError')}
        </Alert>
      ) : null}

      {user !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('page.userDetail.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('page.userDetail.subtitle')}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
              {saveSuccess !== null ? (
                <Alert variant="default" role="status">
                  {saveSuccess}
                </Alert>
              ) : null}

              {saveError !== null ? (
                <Alert variant="destructive" role="alert">
                  {saveError}
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="user-email">{t('page.userDetail.fields.email')}</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={user.email}
                  disabled
                  readOnly
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-name">{t('page.userDetail.fields.name')}</Label>
                <Input
                  id="user-name"
                  type="text"
                  value={name}
                  disabled={saving}
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role">{t('page.userDetail.fields.role')}</Label>
                <Select
                  id="user-role"
                  value={role}
                  disabled={saving}
                  onChange={(event) => {
                    const parsed = z.enum(Role).safeParse(event.target.value);
                    if (parsed.success) {
                      setRole(parsed.data);
                    }
                  }}
                >
                  <option value={Role.ADMIN}>{t('auth.role.ADMIN')}</option>
                  <option value={Role.EDITOR}>{t('auth.role.EDITOR')}</option>
                  <option value={Role.HOTEL_MANAGER}>{t('auth.role.HOTEL_MANAGER')}</option>
                  <option value={Role.PARTNER}>{t('auth.role.PARTNER')}</option>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="user-active"
                    className="text-base cursor-pointer"
                  >
                    {t('page.userDetail.fields.active')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('page.userDetail.fields.activeDescription')}
                  </p>
                </div>
                <Switch
                  id="user-active"
                  checked={active}
                  disabled={saving}
                  onCheckedChange={(checked) => {
                    setActive(checked);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-uiLang">{t('page.userDetail.fields.uiLang')}</Label>
                <Select
                  id="user-uiLang"
                  value={uiLang}
                  disabled={saving}
                  onChange={(event) => {
                    const parsed = z.enum(LANGS).safeParse(event.target.value);
                    if (parsed.success) {
                      setUiLang(parsed.data);
                    }
                  }}
                >
                  <option value="fr">{t('page.userDetail.languages.fr')}</option>
                  <option value="ar">{t('page.userDetail.languages.ar')}</option>
                  <option value="en">{t('page.userDetail.languages.en')}</option>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={!canSubmit}
                >
                  {saving ? t('page.userDetail.actions.saving') : t('page.userDetail.actions.save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isHotelRole ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('page.userDetail.hotels.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('page.userDetail.hotels.description')}
            </p>
          </CardHeader>
          <CardContent>
            {hotelsLoading ? (
              <p role="status" className="text-muted-foreground">
                {t('page.userDetail.hotels.loading')}
              </p>
            ) : null}

            {hotelsLoadError ? (
              <Alert variant="destructive" role="alert">
                {t('page.userDetail.hotels.loadError')}
              </Alert>
            ) : null}

            {!hotelsLoading && !hotelsLoadError ? (
              <form
                onSubmit={(event) => {
                  void handleSaveHotels(event);
                }}
                className="space-y-6"
              >
                {hotelsSaveSuccess !== null ? (
                  <Alert variant="default" role="status">
                    {hotelsSaveSuccess}
                  </Alert>
                ) : null}

                {hotelsSaveError !== null ? (
                  <Alert variant="destructive" role="alert">
                    {hotelsSaveError}
                  </Alert>
                ) : null}

                {hotels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('page.userDetail.hotels.noHotels')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {hotels.map((hotel) => (
                      <div key={hotel.id} className="flex items-center gap-2">
                        <input
                          id={`hotel-${hotel.id}`}
                          type="checkbox"
                          value={hotel.id}
                          checked={selectedHotelIds.includes(hotel.id)}
                          disabled={hotelsSaving}
                          onChange={() => {
                            toggleHotel(hotel.id);
                          }}
                          className="h-4 w-4 rounded border-input accent-primary focus-visible:ring-ring cursor-pointer"
                        />
                        <Label
                          htmlFor={`hotel-${hotel.id}`}
                          className="cursor-pointer font-normal text-sm"
                        >
                          {hotel.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={hotelsSaving}
                  >
                    {hotelsSaving
                      ? t('page.userDetail.hotels.actions.saving')
                      : t('page.userDetail.hotels.actions.save')}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
