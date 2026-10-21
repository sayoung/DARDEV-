import {
  createStatsSession,
  type StatsSession,
  type StatsSessionDocument,
  type StatsSessionOptions,
  type StatsTracker,
} from '@xplor/viewer-core';
import { EVENT_CHANNELS } from '@xplor/shared';

/**
 * Options de démarrage de la collecte statistique pour la visionneuse web.
 */
export interface StartWebStatsOptions {
  apiBase?: string;
  getLang: () => string;
  session?: StatsSession;
  createSession?: (options: StatsSessionOptions) => StatsSession;
  storeFactory?: IDBFactory | null;
  fetchFn?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
  document?: StatsSessionDocument | null;
  dbName?: string;
}

/**
 * Adaptateur de suivi d'événements statistiques pour la visionneuse publique web (M7 F-80).
 */
export interface WebStats {
  readonly session: StatsSession;
  readonly tracker: StatsTracker;
  openTour(tourId: string): void;
  tourOpen(tourId: string): void;
  sceneView(tourId: string, sceneId: string): void;
  hotspotClick(tourId: string, sceneId: string, hotspotId: string): void;
  audioPlay(tourId: string, sceneId: string): void;
  qrShown?(tourId?: string): void;
  langChange(lang: string): void;
  flush(): Promise<void>;
  destroy(): Promise<void>;
  onTourOpen(tourId: string): void;
  onSceneChange(tourId: string, sceneId: string): void;
  onHotspotClick(tourId: string, sceneId: string, hotspotId: string): void;
  onAudioPlay(tourId: string, sceneId: string): void;
  onLangChange(lang: string): void;
}

/**
 * Démarre la session de statistiques de la visionneuse web avec channel: 'WEB' et sans jeton.
 *
 * Résilience absolue : aucune exception ne remonte vers l'interface utilisateur.
 * Conforme NF-02 (loi 09-08) : aucune donnée personnelle de voyageur collectée.
 * Même si l'URL contient src=kiosk, la session reste sur le canal 'WEB'.
 */
export function startWebStats({
  apiBase = '/api/v1',
  getLang,
  session: customSession,
  createSession = createStatsSession,
  storeFactory,
  fetchFn,
  now,
  uuid,
  document: customDoc,
  dbName,
}: StartWebStatsOptions): WebStats {
  const session =
    customSession !== undefined
      ? customSession
      : createSession({
          apiBase,
          channel: EVENT_CHANNELS.WEB,
          getLang,
          storeFactory,
          fetchFn,
          now,
          uuid,
          document: customDoc,
          dbName,
        });

  const tracker = session.tracker;

  function openTour(tourId: string): void {
    try {
      tracker.startSession();
      tracker.tourOpen(tourId);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function sceneView(tourId: string, sceneId: string): void {
    try {
      tracker.sceneView(tourId, sceneId);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function hotspotClick(tourId: string, sceneId: string, hotspotId: string): void {
    try {
      tracker.hotspotClick(tourId, sceneId, hotspotId);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function audioPlay(tourId: string, sceneId: string): void {
    try {
      tracker.audioPlay(tourId, sceneId);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function langChange(lang: string): void {
    try {
      tracker.langChange(lang);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function qrShown(tourId?: string): void {
    try {
      tracker.qrShown(tourId);
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  async function flush(): Promise<void> {
    try {
      await session.flush();
    } catch {
      // Résilience absolue
    }
  }

  async function destroy(): Promise<void> {
    try {
      await session.destroy();
    } catch {
      // Résilience absolue
    }
  }

  return {
    session,
    tracker,
    openTour,
    tourOpen: openTour,
    sceneView,
    hotspotClick,
    audioPlay,
    qrShown,
    langChange,
    flush,
    destroy,
    onTourOpen: openTour,
    onSceneChange: sceneView,
    onHotspotClick: hotspotClick,
    onAudioPlay: audioPlay,
    onLangChange: langChange,
  };
}
