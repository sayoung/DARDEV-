import { TourGraph } from '@xplor/shared';
import { TourHistory, createTourHistory } from './tour-history.js';

export interface TourNavigator {
  current(): { shareToken: string; graph: TourGraph; sceneId: string } | null;
  open(shareToken: string, sceneId?: string | null): Promise<void>;
  canGoBack(): boolean;
  followLink(
    current: { sceneId: string; yaw: number; pitch: number },
    target: { shareToken: string; sceneId: string | null }
  ): Promise<void>;
  back(): Promise<boolean>;
}

export function createTourNavigator(deps: {
  load: (shareToken: string) => Promise<TourGraph>;
  history?: TourHistory;
}): TourNavigator {
  const history = deps.history ?? createTourHistory();
  let currentState: { shareToken: string; graph: TourGraph; sceneId: string } | null = null;

  const openFn = async (shareToken: string, sceneId?: string | null): Promise<void> => {
    const graph = await deps.load(shareToken);

    let targetSceneId = graph.startSceneId;
    if (sceneId != null && graph.scenes.some(s => s.id === sceneId)) {
      targetSceneId = sceneId;
    }

    currentState = {
      shareToken,
      graph,
      sceneId: targetSceneId,
    };
  };

  return {
    current(): { shareToken: string; graph: TourGraph; sceneId: string } | null {
      return currentState;
    },
    open: openFn,
    canGoBack(): boolean {
      return history.canGoBack();
    },
    async followLink(
      current: { sceneId: string; yaw: number; pitch: number },
      target: { shareToken: string; sceneId: string | null }
    ): Promise<void> {
      let added = false;
      if (currentState !== null) {
        const prevSize = history.size();
        history.push({
          shareToken: currentState.shareToken,
          sceneId: current.sceneId,
          yaw: current.yaw,
          pitch: current.pitch,
        });
        added = history.size() > prevSize;
      }

      try {
        await openFn(target.shareToken, target.sceneId);
      } catch (error) {
        if (added) {
          history.pop();
        }
        throw error;
      }
    },
    async back(): Promise<boolean> {
      const entry = history.pop();
      if (entry === null) {
        return false;
      }

      try {
        await openFn(entry.shareToken, entry.sceneId);
        return true;
      } catch (error) {
        history.push(entry);
        throw error;
      }
    },
  };
}
