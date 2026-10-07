import { useEffect, useRef, useImperativeHandle, Ref } from 'react';
import { EditorPanorama, mountSceneEditor, EditorMarker, normalizeYaw } from '@xplor/viewer-core';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import { useTranslation } from 'react-i18next';

export type SceneEditor360Handle = {
  getView: () => { yaw: number; pitch: number; zoom: number };
};

export interface SceneEditor360Props {
  panorama: EditorPanorama;
  hotspots: EditorMarker[];
  initialView: { yaw: number; pitch: number; zoom: number };
  onPanoramaClick: (yaw: number, pitch: number) => void;
  onMarkerSelect: (id: string) => void;
  onMarkerMove?: (id: string, yaw: number, pitch: number) => void;
  handleRef?: Ref<SceneEditor360Handle>;
}

export function SceneEditor360({
  panorama,
  hotspots,
  initialView,
  onPanoramaClick,
  onMarkerSelect,
  onMarkerMove,
  handleRef,
}: SceneEditor360Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof mountSceneEditor> | null>(null);

  useImperativeHandle(handleRef, () => ({
    getView: () => {
      if (!editorRef.current) {
        return initialView;
      }
      const view = editorRef.current.getView();
      return {
        yaw: normalizeYaw(view.yaw),
        pitch: view.pitch,
        zoom: Math.round(view.zoom),
      };
    },
  }));

  // References to callbacks and hotspots to avoid stale closures or unnecessary remounts
  const callbacksRef = useRef({ onPanoramaClick, onMarkerSelect, onMarkerMove });
  useEffect(() => {
    callbacksRef.current = { onPanoramaClick, onMarkerSelect, onMarkerMove };
  }, [onPanoramaClick, onMarkerSelect, onMarkerMove]);

  const initialViewRef = useRef(initialView);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = mountSceneEditor(containerRef.current, {
      panorama,
      markers: hotspots, // Pass hotspots on mount so they are not lost
      initialView: initialViewRef.current, // Use ref to prevent remount if initialView is a literal passed on each render
      onPanoramaClick: (yaw, pitch) => { callbacksRef.current.onPanoramaClick(yaw, pitch); },
      onMarkerSelect: (id) => { callbacksRef.current.onMarkerSelect(id); },
      onMarkerMove: (id, yaw, pitch) => { callbacksRef.current.onMarkerMove?.(id, yaw, pitch); },
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
