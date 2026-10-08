import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessingStatus } from '@xplor/shared';
import { uploadPanorama } from '../api/client.js';
import { getAsset, createScene } from '../api/catalog.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

interface PanoramaUploaderProps {
  onUploaded: () => void;
  tourId?: string | null;
}

interface FileUploadState {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
  assetId?: string;
  sceneCreated?: boolean;
  sceneError?: string;
}

export function PanoramaUploader({ onUploaded, tourId }: PanoramaUploaderProps) {
  const { t } = useTranslation();
  const fileInputId = useId();
  
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingScenes, setIsCreatingScenes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleUpload = async () => {
    if (isUploading) return;
    
    const filesToUpload = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (filesToUpload.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      if (files[i]?.status === 'done') continue;

      setFiles(prev => {
        const fileState = prev[i];
        if (!fileState) return prev;
        const next = [...prev];
        next[i] = { ...fileState, status: 'uploading', progress: 0 };
        return next;
      });

      try {
        const fileStateToUpload = files[i];
        if (!fileStateToUpload) continue;

        const assetResponse = await uploadPanorama(fileStateToUpload.file, (progress) => {
          setFiles(prev => {
            const fileState = prev[i];
            if (!fileState) return prev;
            const next = [...prev];
            next[i] = { ...fileState, progress };
            return next;
          });
        });

        setFiles(prev => {
          const fileState = prev[i];
          if (!fileState) return prev;
          const next = [...prev];
          next[i] = { ...fileState, status: 'done', progress: 100, assetId: assetResponse.id };
          return next;
        });

        onUploaded();
      } catch (err: unknown) {
        setFiles(prev => {
          const fileState = prev[i];
          if (!fileState) return prev;
          const next = [...prev];
          next[i] = { 
            ...fileState, 
            status: 'error', 
            errorMessage: err instanceof Error ? err.message : String(err) 
          };
          return next;
        });
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateScenes = async () => {
    if (!tourId || isCreatingScenes) return;
    setIsCreatingScenes(true);

    for (let i = 0; i < files.length; i++) {
      const fileState = files[i];
      if (!fileState || fileState.status !== 'done' || !fileState.assetId || fileState.sceneCreated) continue;

      try {
        setFiles(prev => {
          const current = prev[i];
          if (!current) return prev;
          const next = [...prev];
          next[i] = { ...current, sceneError: undefined };
          return next;
        });

        let asset = await getAsset(fileState.assetId);
        let attempts = 0;
        
        while (asset.processingStatus !== ProcessingStatus.READY && attempts < 15) {
          if (asset.processingStatus === ProcessingStatus.ERROR) {
             throw new Error(t('media.upload.scene_create_error'));
          }
          await new Promise(r => setTimeout(r, 2000));
          asset = await getAsset(fileState.assetId);
          attempts++;
        }

        if (asset.processingStatus === ProcessingStatus.READY) {
          const filenameNoExt = fileState.file.name.replace(/\.[^/.]+$/, "");
          await createScene(tourId, {
            title: { fr: filenameNoExt, ar: '', en: '' },
            panoramaAssetId: asset.id,
            weight: 0,
            initialYaw: 0,
            initialPitch: 0,
            initialZoom: 50,
          });

          setFiles(prev => {
            const current = prev[i];
            if (!current) return prev;
            const next = [...prev];
            next[i] = { ...current, sceneCreated: true };
            return next;
          });
          onUploaded();
        } else {
          throw new Error(t('media.upload.asset_not_ready'));
        }
      } catch (err: unknown) {
        setFiles(prev => {
          const current = prev[i];
          if (!current) return prev;
          const next = [...prev];
          next[i] = { 
            ...current, 
            sceneError: err instanceof Error ? err.message : String(err)
          };
          return next;
        });
      }
    }
    
    setIsCreatingScenes(false);
  };

  const hasDoneFiles = files.some(f => f.status === 'done' && !f.sceneCreated);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fileInputId}>{t('media.upload.select_files')}</Label>
        <div className="flex flex-wrap gap-4 items-center">
          <Input 
            id={fileInputId}
            ref={fileInputRef}
            type="file" 
            accept="image/jpeg" 
            multiple 
            onChange={handleFileChange} 
            disabled={isUploading || isCreatingScenes}
            aria-disabled={isUploading || isCreatingScenes}
            className="w-auto"
          />
          <Button 
            onClick={() => void handleUpload()} 
            disabled={isUploading || files.length === 0 || files.every(f => f.status === 'done')}
            aria-disabled={isUploading || files.length === 0 || files.every(f => f.status === 'done')}
          >
            {t('media.upload.submit')}
          </Button>

          {tourId && hasDoneFiles && (
            <Button
              variant="outline"
              onClick={() => void handleCreateScenes()}
              disabled={isUploading || isCreatingScenes}
            >
              {isCreatingScenes ? t('media.upload.creating_scenes') : t('media.upload.create_scenes')}
            </Button>
          )}
        </div>
      </div>
      
      {files.length > 0 ? (
        <ul className="space-y-3" role="list">
          {files.map((fileState, index) => (
            <li key={`${fileState.file.name}-${String(index)}`} className="flex flex-col gap-1 rounded border p-3 shadow-sm bg-card">
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm truncate">{fileState.file.name}</span>
                <span className="text-sm">
                  {fileState.status === 'uploading' ? t('media.upload.uploading') : null}
                  {fileState.status === 'done' ? (
                    <span className="text-primary font-medium">
                      {fileState.sceneCreated ? t('media.upload.scene_created') : t('media.upload.done')}
                    </span>
                  ) : null}
                  {fileState.status === 'error' ? <span className="text-destructive font-medium">{t('media.upload.error')}</span> : null}
                  {fileState.status === 'pending' ? <span className="text-muted-foreground">{t('media.status.PENDING')}</span> : null}
                </span>
              </div>
              
              {fileState.status === 'error' && fileState.errorMessage ? (
                <div className="text-sm text-destructive" role="alert">
                  {fileState.errorMessage}
                </div>
              ) : null}
              
              {fileState.sceneError ? (
                <div className="text-sm text-destructive" role="alert">
                  {fileState.sceneError}
                </div>
              ) : null}
              
              <div 
                className="h-2 w-full bg-secondary rounded-full overflow-hidden" 
                role="progressbar" 
                aria-valuenow={fileState.progress} 
                aria-valuemin={0} 
                aria-valuemax={100}
              >
                <div 
                  className={`h-full transition-all duration-300 ${fileState.status === 'error' ? 'bg-destructive' : 'bg-primary'}`} 
                  style={{ width: `${String(fileState.progress)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
