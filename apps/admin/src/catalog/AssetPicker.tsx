import { useEffect, useState, useId, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetKind, type AssetResponse, ProcessingStatus, z } from '@xplor/shared';
import { listAssets, getAsset } from '../api/catalog.js';

import { Label } from '../components/ui/Label.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '../components/ui/Dialog.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';

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

  useEffect(() => {
    if (!open) {
      setQ('');
      setDebouncedQ('');
      setKindFilter('all');
    }
  }, [open]);

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

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    const currentRequest = ++requestCounter.current;
    
    const load = async (loadPage: number, reset: boolean) => {
      setLoading(true);
      if (reset) {
        setError(false);
      }
      
      try {
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
  }, [open, debouncedQ, kindFilter, kindsDep, kind]);

  const loadMore = useCallback(async (loadPage: number) => {
    const currentRequest = ++requestCounter.current;
    setLoading(true);
    try {
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
  }, [debouncedQ, kind, kindFilter]);

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
      <Button 
        id={id}
        type="button" 
        variant="outline" 
        className="w-full justify-start font-normal text-start" 
        onClick={() => { setOpen(true); }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selectedLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('catalog.asset.pickerTitle')}</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
