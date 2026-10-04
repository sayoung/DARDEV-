import { TourGraph } from '@xplor/shared';
import { TourHistory, createTourHistory } from './tour-history.js';

export interface TourNavigator {
  current(): { shareToken: string; graph: TourGraph; sceneId: string } | null;
  open(shareToken: string, sceneId?: string | null): Promise<void>;
  canGoBack(): boolean;
}

export function createTourNavigator(deps: {
  load: (shareToken: string) => Promise<TourGraph>;
  history?: TourHistory;
}): TourNavigator {
  const history = deps.history ?? createTourHistory();
  let currentState: { shareToken: string; graph: TourGraph; sceneId: string } | null = null;

  return {
    current(): { shareToken: string; graph: TourGraph; sceneId: string } | null {
      return currentState;
    },
    async open(shareToken: string, sceneId?: string | null): Promise<void> {
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
    },
    canGoBack(): boolean {
      return history.canGoBack();
    },
  };
}
