import { useEffect, useState, useId, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetKind, type AssetResponse, ProcessingStatus, z } from '@xplor/shared';
import { listAssets, getAsset } from '../api/catalog.js';
import { uploadAsset } from '../api/client.js';
import { waitUntilAssetReady } from './media-polling.js';

import { Label } from '../components/ui/Label.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs.js';

interface AssetPickerProps {
  label: string;
  kind?: AssetKind;
  kinds?: readonly AssetKind[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

export function AssetPicker({ label, kind, kinds, value, onChange, required }: AssetPickerProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  
  const [open, setOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetResponse | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [kindFilter, setKindFilter] = useState<AssetKind | 'all'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [q]);

  const requestCounter = useRef(0);
  
  const kindsDep = kinds?.join(',');
  const kindsRef = useRef<readonly AssetKind[] | undefined>(kinds);
  if (kindsRef.current?.join(',') !== kindsDep) {
    kindsRef.current = kinds;
  }

  const [activeTab, setActiveTab] = useState('library');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<AssetKind>(kind || kindsRef.current?.[0] || AssetKind.IMAGE);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const uploadAbortController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      setQ('');
      setDebouncedQ('');
      setKindFilter('all');
      
      setActiveTab('library');
      setUploadFile(null);
      setUploading(false);
      setProcessing(false);
      setUploadProgress(0);
      setUploadErrorMsg(null);
      if (uploadAbortController.current) {
        uploadAbortController.current.abort();
        uploadAbortController.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (uploadAbortController.current) {
        uploadAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    setUploadFile(null);
  }, [uploadKind]);

  const handleUpload = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setProcessing(false);
    setUploadErrorMsg(null);
    setUploadProgress(0);

    const controller = new AbortController();
    uploadAbortController.current = controller;
    let stage: 'upload' | 'processing' = 'upload';

    try {
      const k = kind || uploadKind;
      const res = await uploadAsset(uploadFile, k, (percent) => { setUploadProgress(percent); });
      
      stage = 'processing';
      setUploading(false);
      setProcessing(true);
      
      const finalAsset = await waitUntilAssetReady(res.id, { signal: controller.signal });
      
      onChange(finalAsset.id);
      setOpen(false);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;

      setUploadErrorMsg(t(stage === 'upload' ? 'catalog.asset.uploadError' : 'catalog.asset.processingError'));
    } finally {
      if (!controller.signal.aborted) {
        setUploading(false);
        setProcessing(false);
      }
    }
  };

  useEffect(() => {
    if (!value) {
      setSelectedAsset(null);
      return;
    }
    let mounted = true;
    const fetchSelected = async () => {
      try {
        const asset = await getAsset(value);
        if (mounted) {
          setSelectedAsset(asset);
        }
      } catch {
        // failed to fetch selected asset silently
      }
    };
    void fetchSelected();
    return () => {
      mounted = false;
    };
  }, [value]);

  const getQueryParams = useCallback((loadPage: number) => {
    const queryParams: Parameters<typeof listAssets>[0] = {
      status: ProcessingStatus.READY,
      page: loadPage,
      pageSize: 24,
    };
    
    if (debouncedQ) {
      queryParams.q = debouncedQ;
    }

    if (kind) {
      queryParams.kind = kind;
    } else if (kindFilter !== 'all') {
      queryParams.kind = kindFilter;
    } else if (kindsRef.current) {
      queryParams.kinds = [...kindsRef.current];
    }

    return queryParams;
  }, [debouncedQ, kind, kindFilter, kindsDep]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const currentRequest = ++requestCounter.current;
    
    const load = async (loadPage: number, reset: boolean) => {
      if (reset) {
        setError(false);
        setAssets([]);
        setPage(1);
        setTotal(0);
      }
      setLoading(true);
      
      try {
        const queryParams = getQueryParams(loadPage);
        const res = await listAssets(queryParams);
        
        if (!mounted || currentRequest !== requestCounter.current) {
          return;
        }

        setAssets(prev => reset ? res.items : [...prev, ...res.items]);
        setTotal(res.total);
        setPage(loadPage);
        setLoading(false);
      } catch {
        if (!mounted || currentRequest !== requestCounter.current) {
          return;
        }
        setError(true);
        setLoading(false);
      }
    };

    void load(1, true);

    return () => {
      mounted = false;
    };
  }, [open, getQueryParams]);

  const loadMore = useCallback(async (loadPage: number) => {
    const currentRequest = ++requestCounter.current;
    setLoading(true);
    try {
      const queryParams = getQueryParams(loadPage);
      const res = await listAssets(queryParams);
      
      if (currentRequest !== requestCounter.current) {
        return;
      }

      setAssets(prev => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(loadPage);
      setLoading(false);
    } catch {
      if (currentRequest !== requestCounter.current) {
        return;
      }
      setError(true);
      setLoading(false);
    }
  }, [getQueryParams]);

  let selectedLabel = t('catalog.asset.emptyOption');
  if (selectedAsset) {
    if (selectedAsset.filename) {
      selectedLabel = selectedAsset.filename;
    } else {
      const date = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(selectedAsset.createdAt));
      selectedLabel = t('catalog.asset.fallbackFilename', { date });
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {required && '*'}</Label>
      {!selectedAsset ? (
        <Button 
          id={id}
          type="button" 
          variant="outline" 
          className="w-full justify-start font-normal text-start" 
          onClick={() => { setOpen(true); }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {t('catalog.asset.emptyOption')}
        </Button>
      ) : (
        <div className="flex items-center justify-between p-3 border rounded-md bg-card">
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate" title={selectedLabel}>
              {selectedLabel}
            </span>
            <span className="text-xs text-muted-foreground uppercase">
              {t(`catalog.asset.kind.${selectedAsset.kind}`)}
            </span>
          </div>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setOpen(true); }}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="ms-4 shrink-0"
          >
            {t('common.change')}
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('catalog.asset.pickerTitle')}</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="library">{t('catalog.asset.libraryTab')}</TabsTrigger>
              <TabsTrigger value="upload">{t('catalog.asset.uploadTab')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="library" className="mt-0 focus-visible:outline-none">
              {error && <Alert variant="destructive">{t('catalog.asset.error')}</Alert>}
              {!error && !loading && assets.length === 0 && <Alert>{t('catalog.asset.empty')}</Alert>}
              
              <div className="flex flex-col sm:flex-row gap-4 mb-4 mt-2">
                <div className="flex-1">
                  <Input
                    type="search"
                    placeholder={t('catalog.asset.searchPlaceholder')}
                    aria-label={t('catalog.asset.searchLabel')}
                    value={q}
                    onChange={(e) => { setQ(e.target.value); }}
                  />
                </div>
                {!kind && kindsRef.current && kindsRef.current.length > 1 && (
                  <div className="w-full sm:w-64">
                    <Select
                      value={kindFilter}
                      onChange={(e) => { 
                        const val = e.target.value;
                        if (val === 'all') {
                          setKindFilter('all');
                        } else {
                          const parsed = z.enum(AssetKind).safeParse(val);
                          if (parsed.success && kindsRef.current?.includes(parsed.data)) {
                            setKindFilter(parsed.data);
                          }
                        }
                      }}
                      aria-label={t('catalog.asset.kindFilterLabel')}
                    >
                      <option value="all">{t('catalog.asset.allKinds')}</option>
                      {kindsRef.current.map((k) => (
                        <option key={k} value={k}>
                          {t(`catalog.asset.kind.${k}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {assets.length > 0 && (
                <div 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4" 
                  role="radiogroup" 
                  aria-label={label}
                >
                  {assets.map((asset) => {
                    const isSelected = value === asset.id;
                    
                    const date = new Intl.DateTimeFormat(i18n.language, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    }).format(new Date(asset.createdAt));

                    const name = asset.filename || t('catalog.asset.fallbackFilename', { date });
                    const dim = asset.width && asset.height ? `${String(asset.width)} × ${String(asset.height)}` : '';

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        role="radio"
                        aria-label={name}
                        aria-checked={isSelected}
                        onClick={() => { 
                          onChange(asset.id); 
                          setOpen(false);
                        }}
                        disabled={loading}
                        className={`flex flex-col text-start overflow-hidden rounded-md border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          isSelected 
                            ? 'border-primary ring-2 ring-primary ring-offset-2' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground relative">
                          {asset.thumbnailUrl ? (
                            <img src={asset.thumbnailUrl} alt={t('catalog.asset.thumbnailOf', { id: name })} className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <span className="sr-only">{t('catalog.asset.thumbnailOf', { id: name })}</span>
                              <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-1 bg-background/80 rounded">
                                  {t(`catalog.asset.kind.${asset.kind}`)}
                                </span>
                                <span className="text-xs uppercase">{asset.mimeType.split('/')[1]}</span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="p-2 bg-card w-full">
                          <p className="text-sm font-medium truncate" title={name}>{name}</p>
                          <p className="text-xs text-muted-foreground">{dim ? `${dim} - ${date}` : date}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!error && assets.length < total && (
                <div className="flex justify-center mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { void loadMore(page + 1); }} 
                    disabled={loading}
                  >
                    {loading ? t('common.loading') : t('catalog.asset.loadMore')}
                  </Button>
                </div>
              )}
              
              {loading && assets.length === 0 && !error && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {t('common.loading')}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-0 focus-visible:outline-none">
              <form onSubmit={(e) => { void handleUpload(e); }} className="space-y-4">
                {uploadErrorMsg && <Alert variant="destructive">{uploadErrorMsg}</Alert>}
                
                <div className="space-y-2">
                  <Label htmlFor={`${id}-upload`}>{t('catalog.asset.chooseFile')}</Label>
                  <Input 
                    id={`${id}-upload`}
                    type="file" 
                    onChange={(e) => { setUploadFile(e.target.files?.[0] || null); }}
                    disabled={uploading || processing}
                    accept={
                      (kind || uploadKind) === AssetKind.IMAGE 
                        ? 'image/jpeg,image/png,image/webp' 
                        : (kind || uploadKind) === AssetKind.PANORAMA 
                        ? 'image/jpeg' 
                        : '*'
                    }
                  />
                </div>

                {!kind && kindsRef.current && kindsRef.current.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-upload-kind`}>{t('catalog.asset.kindFilterLabel')}</Label>
                    <Select
                      id={`${id}-upload-kind`}
                      value={uploadKind}
                      onChange={(e) => { 
                        const parsed = z.enum(AssetKind).safeParse(e.target.value);
                        if (parsed.success) {
                          setUploadKind(parsed.data);
                        }
                      }}
                      disabled={uploading || processing}
                    >
                      {kindsRef.current.map((k) => (
                        <option key={k} value={k}>
                          {t(`catalog.asset.kind.${k}`)}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {(uploading || processing) && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium flex justify-between">
                      <span>{processing ? t('catalog.asset.processing') : t('catalog.asset.upload')}</span>
                      {!processing && <span>{String(Math.round(uploadProgress))}%</span>}
                    </div>
                    <div className="h-2 w-full bg-muted rounded overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: processing ? '100%' : `${String(uploadProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => { setActiveTab('library'); }}
                    disabled={uploading || processing}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!uploadFile || uploading || processing}
                  >
                    {t('catalog.asset.upload')}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
