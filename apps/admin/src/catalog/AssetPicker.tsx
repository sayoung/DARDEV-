import { useEffect, useState, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type AssetKind, type AssetResponse, ProcessingStatus } from '@xplor/shared';
import { listAssets } from '../api/catalog.js';

import { Label } from '../components/ui/Label.js';
import { Alert } from '../components/ui/Alert.js';

import { Input } from '../components/ui/Input.js';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [search, setSearch] = useState('');

  const kindsDep = (kinds ?? (kind ? [kind] : [])).join(',');
  const kindsRef = useRef<readonly AssetKind[]>(kinds ?? (kind ? [kind] : []));
  if (kindsRef.current.join(',') !== kindsDep) {
    kindsRef.current = kinds ?? (kind ? [kind] : []);
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    
    const fetchAssets = async () => {
      try {
        const typesToFetch = kindsRef.current;
        let allAssets: AssetResponse[] = [];

        if (typesToFetch.length > 0) {
          const fetchPromises = typesToFetch.map(k => listAssets({ kind: k, pageSize: 100, page: 1 }));
          const results = await Promise.all(fetchPromises);
          allAssets = results.flatMap(res => res.items);
        } else {
          const res = await listAssets({ pageSize: 100, page: 1 });
          allAssets = res.items;
        }

        if (mounted) {
          const readyAssets = allAssets.filter(a => a.processingStatus === ProcessingStatus.READY);
          
          const uniqueAssetsMap = new Map<string, AssetResponse>();
          for (const a of readyAssets) {
             if (!uniqueAssetsMap.has(a.id)) {
                 uniqueAssetsMap.set(a.id, a);
             }
          }
          const uniqueAssets = Array.from(uniqueAssetsMap.values());

          uniqueAssets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setAssets(uniqueAssets);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };
    
    fetchAssets().catch(console.error);
    return () => {
      mounted = false;
    };
  }, [kindsDep]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (error) {
    return <Alert variant="destructive">{t('catalog.asset.error')}</Alert>;
  }

  const filteredAssets = assets.filter(a => {
    if (!search) return true;
    const date = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(a.createdAt));
    const name = a.filename || t('catalog.asset.fallbackFilename', { date });
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label} {required && '*'}</Label>
      
      {assets.length > 0 && (
        <Input
          type="search"
          placeholder={t('catalog.asset.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
          className="mb-4"
        />
      )}

      {filteredAssets.length === 0 ? (
        <Alert>{t('catalog.asset.empty')}</Alert>
      ) : (
        <div 
          id={id}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" 
          role="radiogroup" 
          aria-label={label}
        >
          {filteredAssets.map((asset) => {
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
                onClick={() => { onChange(asset.id); }}
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
    </div>
  );
}
