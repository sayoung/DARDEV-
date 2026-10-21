import { dir, resources } from '@xplor/i18n';
import type { Lang, TourGraph } from '@xplor/shared';
import { TourNotFoundError } from '@xplor/viewer-core';

import { parseViewerRoute, resolveLang } from './route.js';
import { createLangSwitcher } from './lang-switcher.js';
import { createViewerController } from './viewer-controller.js';
import type { WebStats } from './stats.js';

export async function startViewer(
  doc: Document,
  location: { pathname: string; search: string },
  deps: {
    load: (shareToken: string, lang: Lang) => Promise<TourGraph>;
    loadPreview: (previewToken: string, lang: Lang) => Promise<TourGraph>;
    mount: (
      container: HTMLElement,
      graph: TourGraph,
      opts: {
        sceneId?: string | null;
        onSceneChange?: (sceneId: string) => void;
        onHotspotClick?: (hotspotId: string) => void;
      }
    ) => { goToScene(id: string): Promise<void>; destroy(): void; gyroscopeSupported(): Promise<boolean>; toggleGyroscope(): void };
    navigate: (url: string) => void;
    stats?: Pick<WebStats, 'openTour' | 'langChange'> & Partial<Pick<WebStats, 'qrShown'>> &
      Partial<Pick<WebStats, 'sceneView' | 'hotspotClick' | 'audioPlay'>>;
    mountVr?: (container: HTMLElement, sceneId: string, graph: TourGraph) => Promise<{ destroy(): void }>;
  }
): Promise<void> {
  const lang = resolveLang(location.search);
  doc.documentElement.setAttribute('lang', lang);
  doc.documentElement.setAttribute('dir', dir(lang));

  const labels = {
    ...resources[lang].viewer,
    vr: resources[lang].vr.enter,
  };

  createLangSwitcher(doc, lang, resources.fr.viewer.language, (newLang) => {
    try {
      deps.stats?.langChange(newLang);
    } catch {
      // La collecte ne doit jamais bloquer la navigation.
    }
    deps.navigate(`?lang=${newLang}`);
  });

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

  status.textContent = labels.loading;
  status.hidden = false;

  const route = parseViewerRoute(location.pathname);
  if (!route) {
    status.textContent = labels.notFound;
    return;
  }

  const isPreview = route.kind === 'preview';
  const token = route.token;

  if (isPreview) {
    const badge = doc.createElement('div');
    badge.id = 'preview-badge';
    badge.setAttribute('role', 'note');
    badge.textContent = labels.preview.badge;
    doc.body.prepend(badge);
  }

  try {
    const graph = await (isPreview ? deps.loadPreview(token, lang) : deps.load(token, lang));
    doc.title = graph.title;

    try {
      deps.stats?.openTour(graph.id);
      if (!isPreview && new URLSearchParams(location.search).get('src') === 'kiosk') {
        deps.stats?.qrShown?.(graph.id);
      }
    } catch {
      // La collecte ne doit jamais bloquer l’affichage de la visite.
    }

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
      stats: deps.stats,
      mountScene: (g, sceneId) => {
        return deps.mount(viewer, g, {
          sceneId,
          onSceneChange: (id) => { controller.onSceneChange(id); },
          onHotspotClick: (id) => { controller.onHotspotClick(id).catch(() => {}); },
        });
      },
      mountVr: deps.mountVr,
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
