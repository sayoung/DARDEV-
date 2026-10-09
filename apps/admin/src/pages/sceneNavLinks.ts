export interface SceneNavContext {
  tourId: string;
  currentSceneId: string | null;
  scenes: { id: string }[];
}

export interface SceneNavLinks {
  toursListUrl: string;
  tourDetailUrl: string;
  currentSceneUrl: string | null;
  prevSceneUrl: string | null;
  nextSceneUrl: string | null;
  sceneUrl: (sceneId: string) => string;
}

export function getSceneNavLinks({
  tourId,
  currentSceneId,
  scenes,
}: SceneNavContext): SceneNavLinks {
  const tourDetailUrl = `/tours/${tourId}`;

  let currentSceneUrl: string | null = null;
  let prevSceneUrl: string | null = null;
  let nextSceneUrl: string | null = null;

  if (currentSceneId) {
    currentSceneUrl = `/tours/${tourId}/scenes/${currentSceneId}`;
    if (scenes.length > 0) {
      const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
      if (currentIndex !== -1) {
        if (currentIndex > 0) {
          const prevScene = scenes[currentIndex - 1];
          if (prevScene) prevSceneUrl = `/tours/${tourId}/scenes/${prevScene.id}`;
        }
        if (currentIndex < scenes.length - 1) {
          const nextScene = scenes[currentIndex + 1];
          if (nextScene) nextSceneUrl = `/tours/${tourId}/scenes/${nextScene.id}`;
        }
      }
    }
  }

  return {
    toursListUrl: '/tours',
    tourDetailUrl,
    currentSceneUrl,
    prevSceneUrl,
    nextSceneUrl,
    sceneUrl: (id: string) => `/tours/${tourId}/scenes/${id}`,
  };
}
