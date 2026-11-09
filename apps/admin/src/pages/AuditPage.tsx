import {
  AUDIT_ACTIONS,
  AuditActionSchema,
  type AuditAction,
  type AuditLogEntry,
  type AuditLogQuery,
  type PaginatedAuditLogResponse,
  z,
} from '@xplor/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listAuditLogs } from '../api/audit.js';
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
import { navigateWithSearch, useAppLocation } from '../router.js';

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

function parseAction(raw: string | null): AuditAction | undefined {
  if (raw === null || raw === '') {
    return undefined;
  }
  const parsed = AuditActionSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return undefined;
}

function parseStringFilter(raw: string | null): string {
  if (raw === null) {
    return '';
  }
  return raw.trim();
}

function formatAuditDate(isoString: string, lang: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(lang);
}

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const page = parsePage(searchParams.get('page'));
  const actionFilter = parseAction(searchParams.get('action'));
  const entityTypeFilter = parseStringFilter(searchParams.get('entityType'));
  const fromFilter = parseStringFilter(searchParams.get('from'));
  const toFilter = parseStringFilter(searchParams.get('to'));

  const [entityTypeInput, setEntityTypeInput] = useState<string>(entityTypeFilter);
  const [data, setData] = useState<PaginatedAuditLogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setEntityTypeInput(entityTypeFilter);
  }, [entityTypeFilter]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    const query: Partial<AuditLogQuery> = { page };
    if (actionFilter !== undefined) {
      query.action = actionFilter;
    }
    if (entityTypeFilter.length > 0) {
      query.entityType = entityTypeFilter;
    }
    if (fromFilter.length > 0) {
      query.from = fromFilter;
    }
    if (toFilter.length > 0) {
      query.to = toFilter;
    }

    void listAuditLogs(query)
      .then((response) => {
        if (mounted) {
          setData(response);
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
  }, [page, actionFilter, entityTypeFilter, fromFilter, toFilter]);

  function updateFilter(key: string, value: string): void {
    const currentValue = searchParams.get(key) ?? '';
    if (key !== 'page' && currentValue === value) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (value !== '') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.delete('page');
    }
    navigateWithSearch('/audit', next.toString());
  }

  function handleEntityTypeCommit(): void {
    updateFilter('entityType', entityTypeInput.trim());
  }

  const items: AuditLogEntry[] = data !== null ? data.items : [];
  const total = data !== null ? data.total : 0;
  const pageSize = data !== null ? data.pageSize : 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.audit.title')}
        subtitle={t('page.audit.subtitle')}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-filter-action">{t('page.audit.filters.action')}</Label>
          <Select
            id="audit-filter-action"
            data-testid="audit-filter-action"
            value={actionFilter ?? ''}
            disabled={loading}
            onChange={(event) => {
              updateFilter('action', event.target.value);
            }}
          >
            <option value="">{t('page.audit.filters.allActions')}</option>
            {AUDIT_ACTIONS.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-filter-entity-type">
            {t('page.audit.filters.entityType')}
          </Label>
          <Input
            id="audit-filter-entity-type"
            data-testid="audit-filter-entity-type"
            type="text"
            value={entityTypeInput}
            placeholder={t('page.audit.filters.entityTypePlaceholder')}
            onChange={(event) => {
              setEntityTypeInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleEntityTypeCommit();
              }
            }}
            onBlur={() => {
              handleEntityTypeCommit();
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-filter-from">{t('page.audit.filters.from')}</Label>
          <Input
            id="audit-filter-from"
            data-testid="audit-filter-from"
            type="date"
            value={fromFilter}
            disabled={loading}
            onChange={(event) => {
              updateFilter('from', event.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-filter-to">{t('page.audit.filters.to')}</Label>
          <Input
            id="audit-filter-to"
            data-testid="audit-filter-to"
            type="date"
            value={toFilter}
            disabled={loading}
            onChange={(event) => {
              updateFilter('to', event.target.value);
            }}
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          {t('page.audit.loadError')}
        </Alert>
      ) : null}

      {loading ? (
        <p role="status" className="text-muted-foreground">
          {t('common.loading')}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t('page.audit.empty')}
        </p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('page.audit.columns.date')}</TableHead>
                <TableHead>{t('page.audit.columns.action')}</TableHead>
                <TableHead>{t('page.audit.columns.entityType')}</TableHead>
                <TableHead>{t('page.audit.columns.entityId')}</TableHead>
                <TableHead>{t('page.audit.columns.user')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {formatAuditDate(log.createdAt, i18n.language)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell>
                    {log.entityId !== null && log.entityId !== undefined && log.entityId.length > 0
                      ? log.entityId
                      : t('page.audit.emptyValue')}
                  </TableCell>
                  <TableCell>
                    {log.userId !== null && log.userId !== undefined && log.userId.length > 0
                      ? log.userId
                      : t('page.audit.emptyValue')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <nav
            className="flex items-center gap-4 mt-4"
            aria-label={t('page.audit.pagination.label')}
          >
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                updateFilter('page', String(page - 1));
              }}
            >
              {t('page.audit.pagination.prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('page.audit.pagination.info', { page, total: totalPages })}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                updateFilter('page', String(page + 1));
              }}
            >
              {t('page.audit.pagination.next')}
            </Button>
          </nav>
        </>
      ) : null}
    </div>
  );
}
