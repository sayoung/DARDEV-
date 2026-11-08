import {
  Role,
  z,
  type AdminUser,
  type PaginatedAdminUsersResponse,
} from '@xplor/shared';
import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { listUsers } from '../api/users.js';
import { PageHeader } from '../components/PageHeader.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/Table.js';
import { hrefFor, navigate, navigateWithSearch, useAppLocation } from '../router.js';

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'auth.role.ADMIN',
  EDITOR: 'auth.role.EDITOR',
  HOTEL_MANAGER: 'auth.role.HOTEL_MANAGER',
  PARTNER: 'auth.role.PARTNER',
};

const pageSchema = z.number().int().min(1);

function parsePage(raw: string | null): number {
  if (raw === null || raw === '') {
    return 1;
  }
  const parsed = pageSchema.safeParse(Number(raw));
  if (parsed.success) {
    return parsed.data;
  }
  return 1;
}

function parseRole(raw: string | null): Role | undefined {
  if (raw === null || raw === '') {
    return undefined;
  }
  const parsed = z.enum(Role).safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return undefined;
}

function parseActive(raw: string | null): boolean | undefined {
  if (raw === null || raw === '') {
    return undefined;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return undefined;
}

function parseQ(raw: string | null): string {
  if (raw === null) {
    return '';
  }
  return raw.trim();
}

function formatLastLogin(isoString: string | null, lang: string, fallback: string): string {
  if (isoString === null) {
    return fallback;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleString(lang);
}

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const page = parsePage(searchParams.get('page'));
  const roleFilter = parseRole(searchParams.get('role'));
  const activeFilter = parseActive(searchParams.get('active'));
  const qFilter = parseQ(searchParams.get('q'));

  const [qInput, setQInput] = useState<string>(qFilter);
  const [usersData, setUsersData] = useState<PaginatedAdminUsersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setQInput(qFilter);
  }, [qFilter]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    void listUsers({
      page,
      pageSize: 20,
      role: roleFilter,
      active: activeFilter,
      q: qFilter.length > 0 ? qFilter : undefined,
    })
      .then((data) => {
        if (mounted) {
          setUsersData(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
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
  }, [page, roleFilter, activeFilter, qFilter]);

  function updateFilter(key: string, value: string): void {
    const next = new URLSearchParams(searchParams);
    if (value !== '') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    navigateWithSearch('/users', next.toString());
  }

  function handleSearchSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateFilter('q', qInput.trim());
  }

  const items: AdminUser[] = usersData !== null ? usersData.items : [];
  const total = usersData !== null ? usersData.total : 0;
  const pageSize = usersData !== null ? usersData.pageSize : 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.users.title')}
        subtitle={t('page.users.subtitle')}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="users-filter-role">{t('page.users.filters.role')}</Label>
          <Select
            id="users-filter-role"
            value={roleFilter ?? ''}
            disabled={loading}
            onChange={(event) => {
              updateFilter('role', event.target.value);
            }}
          >
            <option value="">{t('page.users.filters.allRoles')}</option>
            <option value={Role.ADMIN}>{t('auth.role.ADMIN')}</option>
            <option value={Role.EDITOR}>{t('auth.role.EDITOR')}</option>
            <option value={Role.HOTEL_MANAGER}>{t('auth.role.HOTEL_MANAGER')}</option>
            <option value={Role.PARTNER}>{t('auth.role.PARTNER')}</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="users-filter-active">{t('page.users.filters.status')}</Label>
          <Select
            id="users-filter-active"
            value={activeFilter === undefined ? '' : String(activeFilter)}
            disabled={loading}
            onChange={(event) => {
              updateFilter('active', event.target.value);
            }}
          >
            <option value="">{t('page.users.filters.allStatuses')}</option>
            <option value="true">{t('page.users.filters.activeOnly')}</option>
            <option value="false">{t('page.users.filters.inactiveOnly')}</option>
          </Select>
        </div>

        <form
          className="flex flex-col gap-1.5"
          role="search"
          onSubmit={handleSearchSubmit}
        >
          <Label htmlFor="users-filter-q">{t('page.users.filters.search')}</Label>
          <div className="flex gap-2">
            <Input
              id="users-filter-q"
              type="search"
              value={qInput}
              placeholder={t('page.users.filters.searchPlaceholder')}
              disabled={loading}
              onChange={(event) => {
                setQInput(event.target.value);
              }}
            />
            <Button type="submit" variant="outline" disabled={loading}>
              {t('page.users.filters.submit')}
            </Button>
          </div>
        </form>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          {t('page.users.loadError')}
        </Alert>
      ) : null}

      {loading ? (
        <p role="status" className="text-muted-foreground">
          {t('common.loading')}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t('page.users.empty')}
        </p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('page.users.columns.name')}</TableHead>
                <TableHead>{t('page.users.columns.email')}</TableHead>
                <TableHead>{t('page.users.columns.role')}</TableHead>
                <TableHead>{t('page.users.columns.active')}</TableHead>
                <TableHead>{t('page.users.columns.twoFactor')}</TableHead>
                <TableHead>{t('page.users.columns.lastLogin')}</TableHead>
                <TableHead>{t('page.users.columns.hotels')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <a
                      href={hrefFor(`/users/${encodeURIComponent(user.id)}`)}
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button > 0
                        ) {
                          return;
                        }
                        event.preventDefault();
                        navigate(`/users/${encodeURIComponent(user.id)}`);
                      }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {user.name}
                    </a>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(ROLE_LABEL[user.role])}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'success' : 'secondary'}>
                      {t(user.active ? 'page.users.status.active' : 'page.users.status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.totpEnabled ? 'default' : 'outline'}>
                      {t(user.totpEnabled ? 'page.users.twoFactor.enabled' : 'page.users.twoFactor.disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatLastLogin(user.lastLoginAt, i18n.language, t('page.users.never'))}
                  </TableCell>
                  <TableCell>{user.hotelIds.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <nav
            className="flex items-center gap-4 mt-4"
            aria-label={t('page.users.pagination.label')}
          >
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                updateFilter('page', String(page - 1));
              }}
            >
              {t('page.users.pagination.prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('page.users.pagination.info', { page, total: totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                updateFilter('page', String(page + 1));
              }}
            >
              {t('page.users.pagination.next')}
            </Button>
          </nav>
        </>
      ) : null}
    </div>
  );
}
