import { useEffect, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type AssetKind, type AssetResponse } from '@xplor/shared';
import { listAssets } from '../api/catalog.js';

interface AssetPickerProps {
  label: string;
  kind: AssetKind;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

export function AssetPicker({ label, kind, value, onChange, required }: AssetPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    
    listAssets({ kind, pageSize: 100, page: 1 })
      .then((res) => {
        if (mounted) {
          setAssets(res.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });
      
    return () => {
      mounted = false;
    };
  }, [kind]);

  if (loading) {
    return <div>{t('common.loading')}</div>;
  }

  if (error) {
    return <div>{t('catalog.asset.error')}</div>;
  }

  if (assets.length === 0) {
    return <div>{t('catalog.asset.empty')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBlockEnd: '1rem' }}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        required={required}
        style={{ paddingInlineStart: '0.5rem' }}
      >
        <option value="">{t('catalog.asset.emptyOption')}</option>
        {assets.map((asset) => {
          const shortId = asset.id.slice(-8);
          const dim = asset.width && asset.height ? ` ${String(asset.width)}×${String(asset.height)}` : '';
          const status = t(`catalog.asset.status.${asset.processingStatus}`);
          
          return (
            <option key={asset.id} value={asset.id}>
              {shortId} - {asset.mimeType}{dim} - {status}
            </option>
          );
        })}
      </select>
    </div>
  );
}
