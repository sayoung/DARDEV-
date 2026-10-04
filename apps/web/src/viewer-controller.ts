import { TourGraph, TourGraphScene } from '@xplor/shared';
import {
  createTourNavigator,
  adjacentScenes,
  resolveTourLink,
} from '@xplor/viewer-core';
import { handleHotspotClick } from './hotspot-ui.js';
import { createControls } from './controls.js';
import { confirmGoTo } from './confirm-dialog.js';
import { openInfoPanel } from './info-panel.js';
import { textToHtml, mapLinkHtml } from './text-html.js';
import { createSceneAudioPlayer } from './scene-audio-player.js';

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
  close: string;
  play: string;
  pause: string;
  gyroscope?: string;
  openMap?: string;
}

export interface ViewerDeps {
  load: (shareToken: string) => Promise<TourGraph>;
  mountScene: (
    graph: TourGraph,
    sceneId: string
  ) => { goToScene(id: string): Promise<void>; destroy(): void; gyroscopeSupported(): Promise<boolean>; toggleGyroscope(): void };
  labels: ViewerLabels;
  onSceneChange?: (sceneId: string) => void;
  openUrl?: (url: string) => void;
  audioFactory?: (url: string) => HTMLAudioElement;
}

export function createViewerController(doc: Document, deps: ViewerDeps) {
  const navigator = createTourNavigator({ load: deps.load });

  let currentMount: { goToScene(id: string): Promise<void>; destroy(): void; gyroscopeSupported(): Promise<boolean>; toggleGyroscope(): void } | null = null;
  let isTransitioning = false;
  let controls: ReturnType<typeof createControls> | null = null;

  let prevScene: TourGraphScene | null = null;
  let player: ReturnType<typeof createSceneAudioPlayer> | null = null;

  const applyAudio = (isNewTour: boolean, sceneId: string) => {
    const state = navigator.current();
    if (!state) return;

    if (isNewTour || !player) {
      if (player) player.destroy();
      player = createSceneAudioPlayer(
        doc,
        { play: deps.labels.play, pause: deps.labels.pause },
        deps.audioFactory
      );
      prevScene = null;
    }

    const nextScene = state.graph.scenes.find((s) => s.id === sceneId) || null;
    if (nextScene) {
      player.apply(prevScene, nextScene);
      prevScene = nextScene;
    }
  };

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
      hasPracticalInfo: state.graph.practicalInfo !== null || state.graph.location !== null,
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
          currentMount.gyroscopeSupported().then(supported => {
             if (controls) controls.showGyroscope(supported);
          }).catch(() => {
             if (controls) controls.showGyroscope(false);
          });
          applyAudio(true, state.sceneId);
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
    if (isTransitioning) return;
    const state = navigator.current();
    if (!state) return;
    if (!state.graph.practicalInfo && !state.graph.location) return;

    let bodyHtml = textToHtml(state.graph.practicalInfo || '');
    if (state.graph.location) {
      bodyHtml += mapLinkHtml(state.graph.location, deps.labels.openMap ?? 'Voir sur la carte');
    }

    openInfoPanel(
      doc,
      {
        title: deps.labels.practicalInfo,
        bodyHtml,
        images: [],
      },
      { close: deps.labels.close }
    );
  };

  controls = createControls(doc, deps.labels, {
    onPrevious: () => { handlePrevious().catch(() => {}); },
    onNext: () => { handleNext().catch(() => {}); },
    onBack: () => { handleBack().catch(() => {}); },
    onFullscreen: handleFullscreen,
    onPracticalInfo: handlePracticalInfo,
    onGyroscope: () => {
      if (currentMount) currentMount.toggleGyroscope();
    }
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
          currentMount.gyroscopeSupported().then(supported => {
             controls.showGyroscope(supported);
          }).catch(() => {
             controls.showGyroscope(false);
          });
          applyAudio(true, state.sceneId);
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
              currentMount.gyroscopeSupported().then(supported => {
                 controls.showGyroscope(supported);
              }).catch(() => {
                 controls.showGyroscope(false);
              });
              applyAudio(true, newState.sceneId);
              updateControls();
            }
            hideStatus();
          } catch {
            showStatus(deps.labels.loadError);
          } finally {
            setTransitioning(false);
          }
        }
      } else {
        const openUrl = deps.openUrl ?? ((url: string) => window.open(url, '_blank', 'noopener,noreferrer'));
        handleHotspotClick(
          doc,
          state.graph,
          state.sceneId,
          hotspotId,
          deps.labels,
          {
            openUrl,
            onTourLink: () => {}
          }
        );
      }
    },
    
    onSceneChange(sceneId: string) {
      const state = navigator.current();
      if (state) {
        state.sceneId = sceneId;
        applyAudio(false, sceneId);
        updateControls();
        if (deps.onSceneChange) {
          deps.onSceneChange(sceneId);
        }
      }
    },

    destroy() {
      if (currentMount) currentMount.destroy();
      controls.destroy();
      if (player) player.destroy();
    }
  };
}
