import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/Dialog.js';
import { Alert } from '../components/ui/Alert.js';
import { Button } from '../components/ui/Button.js';
import { SceneEditor360, type SceneEditor360Handle } from '../components/SceneEditor360.js';
import { getScene, getAsset } from '../api/catalog.js';
import { type SceneResponse, type AssetResponse, AssetKind, ProcessingStatus } from '@xplor/shared';
import { editorPanorama } from '@xplor/viewer-core';
import { Loader2 } from 'lucide-react';

export interface ArrivalOrientationDialogProps {
  open: boolean;
  targetSceneId: string;
  language: string;
  onClose: () => void;
  onConfirm: (arrivalYaw: number) => void;
}

export function ArrivalOrientationDialog({
  open,
  targetSceneId,
  onClose,
  onConfirm,
}: ArrivalOrientationDialogProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<AssetResponse | null>(null);
  const [scene, setScene] = useState<SceneResponse | null>(null);
  const editorRef = useRef<SceneEditor360Handle>(null);
  useEffect(() => {
    let mounted = true;

    if (!open) {
      setScene(null);
      setAsset(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const sceneData = await getScene(targetSceneId);
        const assetData = await getAsset(sceneData.panoramaAssetId);
        
        if (mounted) {
          setScene(sceneData);
          setAsset(assetData);
        }
      } catch {
        if (mounted) {
          setError(t('common.error.generic'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [open, targetSceneId, t]);

  const handleConfirm = () => {
    if (editorRef.current) {
      onConfirm(editorRef.current.getView().yaw);
    }
  };

  const isReady = asset?.processingStatus === ProcessingStatus.READY && asset.kind === AssetKind.PANORAMA && asset.panorama != null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('catalog.hotspots.editor.useThisDirection')}</DialogTitle>
        </DialogHeader>

        <div className="relative min-h-[400px] flex items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>{t('common.loading')}</p>
            </div>
          )}
          
          {!isLoading && error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          {!isLoading && !error && !isReady && (
            <Alert variant="destructive">
              {t('catalog.scenes.editor.panoramaNotReady')}
            </Alert>
          )}

          {!isLoading && !error && isReady && scene && asset.panorama && (
            <SceneEditor360
              handleRef={editorRef}
              panorama={editorPanorama(asset)}
              hotspots={[]}
              initialView={{
                yaw: scene.initialYaw,
                pitch: scene.initialPitch,
                zoom: scene.initialZoom,
              }}
              onPanoramaClick={() => {}}
              onMarkerSelect={() => {}}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('common.close')}
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !!error || !isReady}>
            {t('catalog.hotspots.editor.useThisDirection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
