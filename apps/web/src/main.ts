import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';
import '@photo-sphere-viewer/virtual-tour-plugin/index.css';
import '@photo-sphere-viewer/gallery-plugin/index.css';

import { fetchTourGraph, mountViewer } from '@xplor/viewer-core';
import { startViewer } from './app.js';

void startViewer(document, window.location, {
  load: (token, lang) => fetchTourGraph('/api', token, lang),
  mount: (el, graph, opts) => mountViewer(el, graph, opts),
  navigate: (url) => { window.location.href = url; }
});
