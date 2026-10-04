import { TourGraph } from '@xplor/shared';
import {
  createTourNavigator,
  adjacentScenes,
  resolveTourLink,
} from '@xplor/viewer-core';
import { createControls } from './controls.js';
import { confirmGoTo } from './confirm-dialog.js';

export interface ViewerLabels {
  nav?: string;
  previous: string;
  next: string;
  back: string;
  fullscreen: string;
  practicalInfo: string;
  goTo: string;
  confirm: string;
  cancel: string;
  loading: string;
  notFound: string;
  loadError: string;
}

export interface ViewerDeps {
  load: (shareToken: string) => Promise<TourGraph>;
  mountScene: (
    graph: TourGraph,
    sceneId: string
  ) => { goToScene(id: string): Promise<void>; destroy(): void };
  labels: ViewerLabels;
  onSceneChange?: (sceneId: string) => void;
}

export function createViewerController(doc: Document, deps: ViewerDeps) {
  const navigator = createTourNavigator({ load: deps.load });

  let currentMount: { goToScene(id: string): Promise<void>; destroy(): void } | null = null;
  let isTransitioning = false;

  const getStatusElement = () => {
    let el = doc.getElementById('status');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'status';
      el.setAttribute('role', 'status');
      doc.body.append(el);
    }
    return el;
  };

  const showStatus = (msg: string) => {
    const el = getStatusElement();
    el.textContent = msg;
    el.hidden = false;
  };

  const hideStatus = () => {
    const el = getStatusElement();
    el.textContent = '';
    el.hidden = true;
  };

  let controls: ReturnType<typeof createControls> | null = null;

  const updateControls = () => {
    if (!controls) return;
    if (isTransitioning) {
      controls.update({
        previous: null,
        next: null,
        canGoBack: false,
        hasPracticalInfo: false,
      });
      return;
    }
    
    const state = navigator.current();
    if (!state) return;

    const { previous, next } = adjacentScenes(state.graph, state.sceneId);
    controls.update({
      previous,
      next,
      canGoBack: navigator.canGoBack(),
      hasPracticalInfo: state.graph.practicalInfo !== null,
    });
  };

  const setTransitioning = (val: boolean) => {
    isTransitioning = val;
    updateControls();
  };

  const handlePrevious = async () => {
    if (isTransitioning) return;
    const state = navigator.current();
    if (!state) return;

    const { previous } = adjacentScenes(state.graph, state.sceneId);
    if (previous && currentMount) {
      setTransitioning(true);
      try {
        await currentMount.goToScene(previous);
      } finally {
        setTransitioning(false);
      }
    }
  };

  const handleNext = async () => {
    if (isTransitioning) return;
    const state = navigator.current();
    if (!state) return;

    const { next } = adjacentScenes(state.graph, state.sceneId);
    if (next && currentMount) {
      setTransitioning(true);
      try {
        await currentMount.goToScene(next);
      } finally {
        setTransitioning(false);
      }
    }
  };

  const handleBack = async () => {
    if (isTransitioning) return;
    setTransitioning(true);
    showStatus(deps.labels.loading);
    try {
      const ok = await navigator.back();
      if (ok) {
        const state = navigator.current();
        if (state) {
          if (currentMount) currentMount.destroy();
          currentMount = deps.mountScene(state.graph, state.sceneId);
          updateControls();
        }
      }
      hideStatus();
    } catch {
      showStatus(deps.labels.loadError);
    } finally {
      setTransitioning(false);
    }
  };

  const handleFullscreen = () => {
    if (doc.fullscreenElement) {
      doc.exitFullscreen().catch(() => {});
    } else {
      doc.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handlePracticalInfo = () => {
    // Info panel logic can be added later or as requested
  };

  controls = createControls(doc, deps.labels, {
    onPrevious: () => { handlePrevious().catch(() => {}); },
    onNext: () => { handleNext().catch(() => {}); },
    onBack: () => { handleBack().catch(() => {}); },
    onFullscreen: handleFullscreen,
    onPracticalInfo: handlePracticalInfo,
  });

  return {
    async start(shareToken: string) {
      if (isTransitioning) return;
      setTransitioning(true);
      showStatus(deps.labels.loading);
      try {
        await navigator.open(shareToken);
        const state = navigator.current();
        if (state) {
          if (currentMount) currentMount.destroy();
          currentMount = deps.mountScene(state.graph, state.sceneId);
          updateControls();
        }
        hideStatus();
      } catch {
        showStatus(deps.labels.loadError);
      } finally {
        setTransitioning(false);
      }
    },
    
    async onHotspotClick(hotspotId: string) {
      if (isTransitioning) return;
      const state = navigator.current();
      if (!state) return;

      const link = resolveTourLink(state.graph, hotspotId);
      if (link) {
        const confirmed = await confirmGoTo(doc, link.title, deps.labels);
        if (confirmed) {
          setTransitioning(true);
          showStatus(deps.labels.loading);
          try {
            await navigator.followLink(
              { sceneId: state.sceneId, yaw: 0, pitch: 0 },
              { shareToken: link.shareToken, sceneId: link.sceneId }
            );
            const newState = navigator.current();
            if (newState) {
              if (currentMount) currentMount.destroy();
              currentMount = deps.mountScene(newState.graph, newState.sceneId);
              updateControls();
            }
            hideStatus();
          } catch {
            showStatus(deps.labels.loadError);
          } finally {
            setTransitioning(false);
          }
        }
      }
    },
    
    onSceneChange(sceneId: string) {
      const state = navigator.current();
      if (state) {
        state.sceneId = sceneId;
        updateControls();
        if (deps.onSceneChange) {
          deps.onSceneChange(sceneId);
        }
      }
    }
  };
}
