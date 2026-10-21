import { EVENT_CHANNELS } from '@xplor/shared';
import {
  createStatsSession,
  type StatsSession,
  type StatsSessionOptions,
  type StatsTracker,
} from '@xplor/viewer-core';

export interface KioskStats {
  startSession(): void;
  endSession(): void;
  openTour(tourId: string): void;
  sceneView(tourId: string, sceneId: string): void;
  hotspotClick(tourId: string, sceneId: string, hotspotId: string): void;
  audioPlay(tourId: string, sceneId: string): void;
  qrShown(tourId?: string): void;
  langChange(lang: string): void;
  flush(): Promise<void>;
  destroy(): Promise<void>;
}

export interface StartKioskStatsOptions {
  apiBase: string;
  getToken: () => string | null;
  getLang: () => string;
  session?: StatsSession;
  createSession?: (options: StatsSessionOptions) => StatsSession;
  storeFactory?: IDBFactory | null;
  fetchFn?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
  dbName?: string;
}

const noopStats: KioskStats = {
  startSession: () => undefined,
  endSession: () => undefined,
  openTour: () => undefined,
  sceneView: () => undefined,
  hotspotClick: () => undefined,
  audioPlay: () => undefined,
  qrShown: () => undefined,
  langChange: () => undefined,
  flush: () => Promise.resolve(),
  destroy: () => Promise.resolve(),
};

export function startKioskStats({
  apiBase,
  getToken,
  getLang,
  session: customSession,
  createSession = createStatsSession,
  storeFactory,
  fetchFn,
  now,
  uuid,
  dbName,
}: StartKioskStatsOptions): KioskStats {
  let session: StatsSession;
  try {
    session = customSession ?? createSession({
      apiBase,
      channel: EVENT_CHANNELS.KIOSK,
      getToken,
      getLang,
      storeFactory,
      fetchFn,
      now,
      uuid,
      document: null,
      dbName,
    });
  } catch {
    return noopStats;
  }

  const tracker: StatsTracker = session.tracker;
  const safely = (action: () => void): void => {
    try {
      action();
    } catch {
      // Une panne de collecte ne doit jamais interrompre le kiosque.
    }
  };

  return {
    startSession() { safely(() => { tracker.startSession(); }); },
    endSession() { safely(() => { tracker.endSession(); }); },
    openTour(tourId) { safely(() => { tracker.tourOpen(tourId); }); },
    sceneView(tourId, sceneId) { safely(() => { tracker.sceneView(tourId, sceneId); }); },
    hotspotClick(tourId, sceneId, hotspotId) { safely(() => { tracker.hotspotClick(tourId, sceneId, hotspotId); }); },
    audioPlay(tourId, sceneId) { safely(() => { tracker.audioPlay(tourId, sceneId); }); },
    qrShown(tourId) { safely(() => { tracker.qrShown(tourId); }); },
    langChange(lang) { safely(() => { tracker.langChange(lang); }); },
    async flush() {
      try {
        await session.flush();
      } catch {
        // Une panne réseau reste sans effet sur l’interface.
      }
    },
    async destroy() {
      try {
        await session.destroy();
      } catch {
        // Une panne réseau reste sans effet sur l’interface.
      }
    },
  };
}
