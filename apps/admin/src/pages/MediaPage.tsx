import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetKind, ProcessingStatus, z, type PaginatedAssetResponse, type AssetFoldersResponse } from '@xplor/shared';
import { listAssets, listAssetFolders } from '../api/catalog.js';
import { reprocessAsset, deleteAsset, cleanupAssetsDryRun, cleanupAssetsConfirm, ApiError } from '../api/client.js';
import { navigateWithSearch, useAppLocation } from '../router.js';
import { PageHeader } from '../components/PageHeader.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '../components/ui/Dialog.js';
import { ProcessingStatusBadge } from '../components/ProcessingStatusBadge.js';
import { PanoramaUploader } from '../catalog/PanoramaUploader.js';
import { needsPolling } from '../catalog/media-polling.js';

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
  const dossier = searchParams.get('dossier');

  const [assetsData, setAssetsData] = useState<PaginatedAssetResponse | null>(null);
  const [foldersData, setFoldersData] = useState<AssetFoldersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);

  const fetchAssets = useCallback(async (mounted: { current: boolean }, silent = false) => {
    try {
      setFetchError(null);
      if (!silent) setLoading(true);
      
      const [data, folders] = await Promise.all([
        listAssets({
          kind: AssetKind.PANORAMA,
          page,
          pageSize,
          tourId: dossier && dossier !== 'unused' ? dossier : undefined,
          unused: dossier === 'unused' ? 'true' : undefined,
        }),
        listAssetFolders({ kind: AssetKind.PANORAMA })
      ]);
      
      if (mounted.current) {
        setAssetsData(data);
        setFoldersData(folders);
      }
    } catch {
      if (mounted.current) {
        setFetchError(t('catalog.asset.error'));
      }
    } finally {
      if (mounted.current && !silent) {
        setLoading(false);
      }
    }
  }, [page, pageSize, dossier, t]);

  useEffect(() => {
    const mounted = { current: true };
    // Mute loading blink on refresh (e.g. for polling or after upload)
    void fetchAssets(mounted, refreshKey > 0);
    return () => {
      mounted.current = false;
    };
  }, [fetchAssets, refreshKey]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    if (assetsData && needsPolling(assetsData.items)) {
      timeoutId = setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 3000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [assetsData]);

  const handleUploaded = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  type CleanupModalState = 
    | { type: 'none' }
    | { type: 'confirm'; count: number; sizeMb: string }
    | { type: 'success'; count: number }
    | { type: 'empty' };

  const [cleanupModal, setCleanupModal] = useState<CleanupModalState>({ type: 'none' });

  const handleCleanup = async () => {
    setCleaning(true);
    setActionError(null);
    try {
      const dryRes = await cleanupAssetsDryRun();
      if (dryRes.count === 0) {
        setCleanupModal({ type: 'empty' });
      } else {
        const sizeMb = (dryRes.totalBytes / (1024 * 1024)).toFixed(1);
        setCleanupModal({ type: 'confirm', count: dryRes.count, sizeMb });
      }
    } catch (error) {
      setActionError(error instanceof ApiError && error.message ? error.message : t('catalog.asset.error'));
    } finally {
      setCleaning(false);
    }
  };

  const confirmCleanup = async () => {
    setCleaning(true);
    setActionError(null);
    try {
      const res = await cleanupAssetsConfirm();
      setCleanupModal({ type: 'success', count: res.deleted });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      setActionError(error instanceof ApiError && error.message ? error.message : t('catalog.asset.error'));
      setCleanupModal({ type: 'none' });
    } finally {
      setCleaning(false);
    }
  };

  const handleReprocess = async (id: string) => {
    setActionError(null);
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const updatedAsset = await reprocessAsset(id);
      setAssetsData(prev => {
        if (prev === null) return null;
        return {
          ...prev,
          items: prev.items.map(a => a.id === id ? updatedAsset : a)
        };
      });
    } catch (error) {
      setActionError(error instanceof ApiError && error.message ? error.message : t('catalog.asset.error'));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('media.actions.confirmDelete'))) return;
    setActionError(null);
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await deleteAsset(id);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setActionError(t('media.errors.inUse'));
      } else {
        setActionError(error instanceof ApiError && error.message ? error.message : t('catalog.asset.error'));
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  function updatePage(newPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    navigateWithSearch('/media', next.toString());
  }

  function formatFolderLabel(nom: string, compte: number) {
    return `${nom} (${String(compte)})`;
  }

  const changeFolder = useCallback((valeur: string) => {
    const next = new URLSearchParams(searchParams);
    if (valeur === 'all') {
      next.delete('dossier');
    } else {
      next.set('dossier', valeur);
    }
    next.set('page', '1');
    navigateWithSearch('/media', next.toString());
  }, [searchParams]);

  const folderItems = useMemo(() => {
    if (!foldersData) return [];
    return [
      { id: 'all', label: formatFolderLabel(t('media.folders.all'), foldersData.total) },
      ...foldersData.tours.map(f => ({ id: f.id, label: formatFolderLabel(f.title.fr, f.count) })),
      { id: 'unused', label: formatFolderLabel(t('media.folders.unused'), foldersData.unusedCount) }
    ];
  }, [foldersData, t]);

  const items = assetsData?.items ?? [];
  const total = assetsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('media.title')}
        subtitle={t('media.subtitle')}
        actions={
          <Button
            variant="outline"
            disabled={cleaning || loading}
            onClick={() => void handleCleanup()}
          >
            {cleaning ? t('common.loading') : t('media.cleanup.button')}
          </Button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <nav className="w-full lg:w-64 shrink-0 bg-card rounded-xl border shadow-sm p-4 sticky top-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2 px-3">{t('media.folders.title')}</h3>
          <ul className="flex flex-col gap-2">
            {folderItems.map(f => {
              const isActive = f.id === 'all' ? !dossier || dossier === 'all' : dossier === f.id;
              return (
                <li key={f.id}>
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => { changeFolder(f.id); }}
                    className={`w-full text-start px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted ${isActive ? 'bg-primary text-primary-foreground font-medium' : ''}`}
                  >
                    {f.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-8 min-w-0 flex-1">
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

          {actionError ? (
            <Alert variant="destructive" role="alert">
              {actionError}
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
                    <TableHead>{t('media.columns.actions')}</TableHead>
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
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processingIds.has(asset.id) || (asset.processingStatus !== ProcessingStatus.READY && asset.processingStatus !== ProcessingStatus.ERROR)}
                              onClick={() => void handleReprocess(asset.id)}
                            >
                              {processingIds.has(asset.id) ? t('common.loading') : t('media.actions.reprocess')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={processingIds.has(asset.id)}
                              onClick={() => void handleDelete(asset.id)}
                            >
                              {t('media.actions.delete')}
                            </Button>
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
      </div>
      <Dialog open={cleanupModal.type !== 'none'} onOpenChange={(open) => { if (!open) setCleanupModal({ type: 'none' }); }}>
        {cleanupModal.type === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('media.cleanup.confirmTitle')}</DialogTitle>
            </DialogHeader>
            <DialogContent>
              <p>{t('media.cleanup.confirm', { count: cleanupModal.count, size: cleanupModal.sizeMb })}</p>
            </DialogContent>
            <DialogFooter>
              <Button variant="outline" disabled={cleaning} onClick={() => { setCleanupModal({ type: 'none' }); }}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" disabled={cleaning} onClick={() => void confirmCleanup()}>
                {cleaning ? t('common.loading') : t('common.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
        {cleanupModal.type === 'empty' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('media.cleanup.emptyTitle')}</DialogTitle>
            </DialogHeader>
            <DialogContent>
              <p>{t('media.cleanup.empty')}</p>
            </DialogContent>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCleanupModal({ type: 'none' }); }}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </>
        )}
        {cleanupModal.type === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('media.cleanup.successTitle')}</DialogTitle>
            </DialogHeader>
            <DialogContent>
              <p>{t('media.cleanup.success', { count: cleanupModal.count })}</p>
            </DialogContent>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCleanupModal({ type: 'none' }); }}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}
