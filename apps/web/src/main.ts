import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import '@photo-sphere-viewer/gallery-plugin/index.css';

import { resources } from '@xplor/i18n';
import { fetchTourGraph, fetchPreviewGraph, mountViewer, mountVr } from '@xplor/viewer-core';
import { startViewer } from './app.js';

void startViewer(document, window.location, {
  load: (token, lang) => fetchTourGraph('/api/v1', token, lang),
  loadPreview: (t, lang) => fetchPreviewGraph('/api/v1', t, lang),
  mount: (el, graph, opts) => mountViewer(el, graph, opts),
  mountVr: (container, sceneId, graph) => {
    let currentSceneId = sceneId;
    return mountVr(container, {
      label: resources[graph.lang].vr.enter,
      graph,
      getCurrentSceneId: () => currentSceneId,
      showScene: (targetSceneId: string) => {
        currentSceneId = targetSceneId;
        return Promise.resolve();
      },
      resolveTextureUrl: (targetSceneId: string) => {
        const scene = graph.scenes.find((s) => s.id === targetSceneId);
        if (!scene) {
          return null;
        }
        return scene.panorama.web || scene.panorama.preview || null;
      },
    });
  },
  navigate: (url) => { window.location.href = url; }
});
