import { type AuditLogEntry, type PaginatedAuditLogResponse } from '@xplor/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { listAuditLogs } from '../api/audit.js';
import { PageHeader } from '../components/PageHeader.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/Table.js';

function formatAuditDate(isoString: string, lang: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(lang);
}

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<PaginatedAuditLogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    void listAuditLogs()
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
  }, []);

  const items: AuditLogEntry[] = data !== null ? data.items : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.audit.title')}
        subtitle={t('page.audit.subtitle')}
      />

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
      ) : null}
    </div>
  );
}
