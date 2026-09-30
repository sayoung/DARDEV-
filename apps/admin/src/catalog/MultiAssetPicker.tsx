import { useEffect, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type AssetKind, type AssetResponse } from '@xplor/shared';
import { listAssets } from '../api/catalog.js';

import { Label } from '../components/ui/Label.js';
import { Select } from '../components/ui/Select.js';
import { Alert } from '../components/ui/Alert.js';

interface MultiAssetPickerProps {
  label: string;
  kind: AssetKind;
  value: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
}

export function MultiAssetPicker({ label, kind, value, onChange, required }: MultiAssetPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [assets, setAssets] = useState<AssetResponse[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    
    const fetchAssets = async () => {
      try {
        const res = await listAssets({ kind, pageSize: 100, page: 1 });
        if (mounted) {
          setAssets(res.items);
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
    return <div className="p-4 text-sm text-gray-500">{t('common.loading')}</div>;
  }

  if (error) {
    return <Alert variant="destructive">{t('catalog.asset.error')}</Alert>;
  }

  if (assets.length === 0) {
    return <Alert>{t('catalog.asset.empty')}</Alert>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        multiple
        value={value}
        onChange={(e) => {
          const options = e.target.options;
          const selected: string[] = [];
          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (opt?.selected && opt.value) {
              selected.push(opt.value);
            }
          }
          onChange(selected);
        }}
        required={required}
        className="h-32"
      >
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
      </Select>
    </div>
  );
}
