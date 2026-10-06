import { useEffect, useRef } from 'react';
import { EditorPanorama, mountSceneEditor, EditorMarker } from '@xplor/viewer-core';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import { useTranslation } from 'react-i18next';

export interface SceneEditor360Props {
  panorama: EditorPanorama;
  hotspots: EditorMarker[];
  initialView: { yaw: number; pitch: number; zoom: number };
  onPanoramaClick: (yaw: number, pitch: number) => void;
  onMarkerSelect: (id: string) => void;
}

export function SceneEditor360({
  panorama,
  hotspots,
  initialView,
  onPanoramaClick,
  onMarkerSelect,
}: SceneEditor360Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof mountSceneEditor> | null>(null);

  // References to callbacks and hotspots to avoid stale closures or unnecessary remounts
  const callbacksRef = useRef({ onPanoramaClick, onMarkerSelect });
  useEffect(() => {
    callbacksRef.current = { onPanoramaClick, onMarkerSelect };
  }, [onPanoramaClick, onMarkerSelect]);

  const initialViewRef = useRef(initialView);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = mountSceneEditor(containerRef.current, {
      panorama,
      markers: hotspots, // Pass hotspots on mount so they are not lost
      initialView: initialViewRef.current, // Use ref to prevent remount if initialView is a literal passed on each render
      onPanoramaClick: (yaw, pitch) => { callbacksRef.current.onPanoramaClick(yaw, pitch); },
      onMarkerSelect: (id) => { callbacksRef.current.onMarkerSelect(id); },
    });

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [panorama]); // Removed initialView to avoid remounting, only depend on panorama

  useEffect(() => {
    editorRef.current?.setMarkers(hotspots);
  }, [hotspots]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[600px] rounded-xl overflow-hidden bg-muted"
      role="application"
      aria-label={t('editor.sceneAriaLabel')}
    />
  );
}
