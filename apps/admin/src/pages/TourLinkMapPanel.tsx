import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type TourLinkMap } from '@xplor/shared';
import { getTourLinkMap } from '../api/catalog.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { LinkMapGraph } from '../editor/LinkMapGraph.js';

export interface TourLinkMapPanelProps {
  tourId: string;
  refreshKey?: string;
}

export function TourLinkMapPanel({ tourId, refreshKey }: TourLinkMapPanelProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapData, setMapData] = useState<TourLinkMap | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setMapData(null);

    getTourLinkMap(tourId)
      .then((data) => {
        if (!cancelled) {
          setMapData(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error(err);
          setErrorMsg(t('common.error.generic'));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tourId, refreshKey, localRefresh, t]);

  const handleRefresh = () => {
    setLocalRefresh((prev) => prev + 1);
  };

  const orphans = mapData?.nodes.filter((n) => n.kind === 'scene' && n.orphan) || [];

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('catalog.tours.linkMap.title')}</h3>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={loading}
        >
          {t('catalog.tours.linkMap.refresh')}
        </Button>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {t('common.loading')}
        </div>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          {errorMsg}
        </Alert>
      )}

      {mapData && !loading && !errorMsg && (
        <div className="space-y-4">
          {mapData.nodes.length > 0 ? (
            <div className="border rounded bg-muted/30">
              <LinkMapGraph map={mapData} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t('catalog.tours.linkMap.empty')}
            </p>
          )}

          {orphans.length > 0 ? (
            <Alert variant="default">
              <p className="font-semibold mb-2">{t('catalog.tours.linkMap.orphans')}</p>
              <ul className="list-disc ps-5 space-y-1 text-sm">
                {orphans.map((n) => (
                  <li key={n.id}>{n.label}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('catalog.tours.linkMap.noOrphans')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
