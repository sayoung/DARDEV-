import { TourGraph } from '@xplor/shared';
import { hotspotAction } from '@xplor/viewer-core';
import { openInfoPanel } from './info-panel.js';
import { openMediaOverlay } from './media-overlay.js';

export function handleHotspotClick(
  doc: Document,
  graph: TourGraph,
  sceneId: string,
  hotspotId: string,
  labels: { close: string; previous: string; next: string },
  deps: { openUrl(url: string): void; onTourLink(hotspotId: string): void }
): void {
  const scene = graph.scenes.find(s => s.id === sceneId);
  if (!scene) {
    return;
  }

  const action = hotspotAction(scene, hotspotId);
  if (!action) {
    return;
  }

  switch (action.kind) {
    case 'info':
      openInfoPanel(
        doc,
        {
          title: action.title,
          bodyHtml: action.bodyHtml,
          images: action.images,
        },
        { close: labels.close }
      );
      break;
    case 'media':
      openMediaOverlay(
        doc,
        {
          title: action.title,
          media: action.media,
        },
        labels
      );
      break;
    case 'url':
      deps.openUrl(action.url);
      break;
    case 'tour':
      deps.onTourLink(action.hotspotId);
      break;
  }
}
