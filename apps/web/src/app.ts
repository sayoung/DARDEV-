import { dir, resources } from '@xplor/i18n';
import type { Lang, TourGraph } from '@xplor/shared';
import { TourNotFoundError } from '@xplor/viewer-core';

import { parseShareToken, resolveLang } from './route.js';
import { createViewerController } from './viewer-controller.js';

export async function startViewer(
  doc: Document,
  location: { pathname: string; search: string },
  deps: {
    load: (shareToken: string, lang: Lang) => Promise<TourGraph>;
    mount: (
      container: HTMLElement,
      graph: TourGraph,
      opts: {
        sceneId?: string | null;
        onSceneChange?: (sceneId: string) => void;
        onHotspotClick?: (hotspotId: string) => void;
      }
    ) => { goToScene(id: string): Promise<void>; destroy(): void };
  }
): Promise<void> {
  const lang = resolveLang(location.search);
  doc.documentElement.setAttribute('lang', lang);
  doc.documentElement.setAttribute('dir', dir(lang));

  let viewer = doc.getElementById('viewer');
  if (!viewer) {
    viewer = doc.createElement('div');
    viewer.id = 'viewer';
    doc.body.append(viewer);
  }

  let status = doc.getElementById('status');
  if (!status) {
    status = doc.createElement('div');
    status.id = 'status';
    status.setAttribute('role', 'status');
    doc.body.append(status);
  }

  const labels = resources[lang].viewer;
  status.textContent = labels.loading;
  status.hidden = false;

  const token = parseShareToken(location.pathname);
  if (!token) {
    status.textContent = labels.notFound;
    return;
  }

  try {
    const graph = await deps.load(token, lang);
    doc.title = graph.title;

    let initialLoad = true;
    const controller = createViewerController(doc, {
      load: async (t) => {
        if (initialLoad && t === token) {
          initialLoad = false;
          return graph;
        }
        return deps.load(t, lang);
      },
      labels,
      mountScene: (g, sceneId) => {
        return deps.mount(viewer, g, {
          sceneId,
          onSceneChange: (id) => { controller.onSceneChange(id); },
          onHotspotClick: (id) => { controller.onHotspotClick(id).catch(() => {}); },
        });
      },
    });

    await controller.start(token);
  } catch (error) {
    status.hidden = false;
    if (error instanceof TourNotFoundError) {
      status.textContent = labels.notFound;
    } else {
      status.textContent = labels.loadError;
    }
  }
}
