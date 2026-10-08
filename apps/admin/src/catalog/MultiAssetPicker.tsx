import { useEffect, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type AssetKind, type AssetResponse, ProcessingStatus } from '@xplor/shared';
import { listAssets } from '../api/catalog.js';

import { Label } from '../components/ui/Label.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';

interface MultiAssetPickerProps {
  label: string;
  kind: AssetKind;
  value: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
}

export function MultiAssetPicker({ label, kind, value, onChange, required }: MultiAssetPickerProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    
    const fetchAssets = async () => {
      try {
        const res = await listAssets({ kind, pageSize: 100, page: 1 });
        if (mounted) {
          const readyAssets = res.items.filter(a => a.processingStatus === ProcessingStatus.READY);
          readyAssets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAssets(readyAssets);
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
  }, [kind]);

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

      {assets.length === 0 ? (
        <Alert>{t('catalog.asset.empty')}</Alert>
      ) : (
        <div 
          id={id}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" 
          role="group" 
          aria-label={label}
        >
          {filteredAssets.map((asset) => {
            const isSelected = value.includes(asset.id);
            
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
                role="checkbox"
                aria-label={name}
                aria-checked={isSelected}
                onClick={() => { 
                  if (isSelected) {
                    onChange(value.filter(v => v !== asset.id));
                  } else {
                    onChange([...value, asset.id]);
                  }
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
    </div>
  );
}
