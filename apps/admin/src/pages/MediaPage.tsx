import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetKind, ProcessingStatus, z, type PaginatedAssetResponse } from '@xplor/shared';
import { listAssets } from '../api/catalog.js';
import { navigateWithSearch, useAppLocation } from '../router.js';
import { PageHeader } from '../components/PageHeader.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { ProcessingStatusBadge } from '../components/ProcessingStatusBadge.js';
import { PanoramaUploader } from '../catalog/PanoramaUploader.js';

const pageSchema = z.number().int().min(1);

function readPage(raw: string | null): number {
  if (raw === null || raw === '') {
    return 1;
  }
  const parsed = pageSchema.safeParse(Number(raw));
  return parsed.success ? parsed.data : 1;
}

export function MediaPage() {
  const { t } = useTranslation();
  const { search } = useAppLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const page = readPage(searchParams.get('page'));
  const pageSize = 20;

  const [assetsData, setAssetsData] = useState<PaginatedAssetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAssets = useCallback(async (mounted: { current: boolean }) => {
    try {
      setFetchError(null);
      setLoading(true);
      const data = await listAssets({
        kind: AssetKind.PANORAMA,
        page,
        pageSize,
      });
      if (mounted.current) {
        setAssetsData(data);
      }
    } catch {
      if (mounted.current) {
        setFetchError(t('catalog.asset.error'));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, t]);

  useEffect(() => {
    const mounted = { current: true };
    void fetchAssets(mounted);
    return () => {
      mounted.current = false;
    };
  }, [fetchAssets, refreshKey]);

  const handleUploaded = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  function updatePage(newPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    navigateWithSearch('/media', next.toString());
  }

  const items = assetsData?.items ?? [];
  const total = assetsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('media.title')}
        subtitle={t('media.subtitle')}
      />

      <Card>
        <CardContent className="pt-6">
          <PanoramaUploader onUploaded={handleUploaded} />
        </CardContent>
      </Card>

      {fetchError ? (
        <Alert variant="destructive" role="alert">
          {fetchError}
        </Alert>
      ) : null}

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">{t('media.empty')}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('media.columns.date')}</TableHead>
                <TableHead>{t('media.columns.dimensions')}</TableHead>
                <TableHead>{t('media.columns.size')}</TableHead>
                <TableHead>{t('media.columns.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((asset) => {
                const date = new Intl.DateTimeFormat('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                }).format(new Date(asset.createdAt));
                const dimensions = asset.width !== null && asset.height !== null 
                  ? `${String(asset.width)} × ${String(asset.height)}` 
                  : '—';
                const sizeMb = (asset.sizeBytes / (1024 * 1024)).toFixed(1);

                return (
                  <TableRow key={asset.id}>
                    <TableCell>{date}</TableCell>
                    <TableCell>{dimensions}</TableCell>
                    <TableCell>{sizeMb}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <ProcessingStatusBadge status={asset.processingStatus} />
                        {asset.processingStatus === ProcessingStatus.ERROR && asset.processingLog && (
                          <span 
                            className="text-xs text-destructive max-w-[200px] truncate" 
                            title={asset.processingLog}
                          >
                            {asset.processingLog}
                          </span>
                        )}
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
                  updatePage(page - 1);
                }}
              >
                {t('catalog.tour.pagination.prev')}
              </Button>
              <span className="text-sm text-muted-foreground">{t('catalog.tour.pagination.info', { page, total: totalPages })}</span>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => {
                  updatePage(page + 1);
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
