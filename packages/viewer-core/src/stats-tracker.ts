/**
 * @file stats-tracker.ts
 * Suivi et émission des événements statistiques de navigation (M7 F-80).
 *
 * Fonctionnalités :
 * - Gestion du cycle de vie de session (startSession, endSession)
 * - Suivi du temps passé par scène (SCENE_VIEW émis à la fermeture)
 * - Émission des interactions : tourOpen, hotspotClick, audioPlay, vrEnter, vrExit, qrShown, langChange
 * - Validation stricte par eventSchema (@xplor/shared)
 * - Résilience absolue : aucune exception ne remonte à l'appelant
 * - Conforme NF-02 (loi 09-08) : aucune donnée personnelle collectée
 */

import { eventSchema, EVENT_TYPES, type EventChannel, type Event } from '@xplor/shared';
import type { EventBatcher } from './event-batcher.js';

/**
 * Options de configuration pour le traqueur de statistiques.
 */
export interface StatsTrackerOptions {
  batcher: Pick<EventBatcher, 'push'>;
  channel: EventChannel;
  getLang: () => string;
  now?: () => number;
  uuid?: () => string;
}

/**
 * Interface publique du traqueur d'événements statistiques.
 */
export interface StatsTracker {
  startSession(): void;
  endSession(): void;
  tourOpen(tourId: string): void;
  sceneView(tourId: string, sceneId: string): void;
  hotspotClick(tourId: string, sceneId: string, hotspotId: string): void;
  audioPlay(tourId: string, sceneId: string): void;
  vrEnter(): void;
  vrExit(): void;
  qrShown(tourId?: string): void;
  langChange(lang: string): void;
}

interface ActiveScene {
  tourId: string;
  sceneId: string;
  openedAt: number;
}

interface PartialEvent {
  type: Event['type'];
  tourId?: Event['tourId'];
  sceneId?: Event['sceneId'];
  hotspotId?: Event['hotspotId'];
  lang?: Event['lang'];
  durationMs?: Event['durationMs'];
}

/**
 * Crée un traqueur d'événements statistiques de navigation.
 *
 * @param options Configuration (batcher, channel, getLang, now, uuid).
 * @returns Instance de `StatsTracker` prête à l'emploi.
 */
export function createStatsTracker({
  batcher,
  channel,
  getLang,
  now = () => Date.now(),
  uuid = () => crypto.randomUUID(),
}: StatsTrackerOptions): StatsTracker {
  let currentSessionId = '';
  try {
    currentSessionId = uuid();
  } catch {
    currentSessionId = '';
  }

  let sessionStartTime: number | null = null;
  let currentScene: ActiveScene | null = null;

  function emit(partial: PartialEvent): void {
    try {
      const eventLang =
        typeof partial.lang === 'string' && partial.lang.length > 0
          ? partial.lang
          : getLang();

      const candidate = {
        ...partial,
        channel,
        lang: eventLang,
        sessionId: currentSessionId,
        occurredAt: new Date(now()).toISOString(),
      };

      const parsed = eventSchema.safeParse(candidate);
      if (parsed.success) {
        batcher.push(parsed.data);
      }
    } catch {
      // Résilience absolue : aucune exception ne remonte
    }
  }

  function closeCurrentScene(): void {
    if (currentScene !== null) {
      const sceneToClose = currentScene;
      currentScene = null;
      try {
        const durationMs = Math.max(0, Math.floor(now() - sceneToClose.openedAt));
        emit({
          type: EVENT_TYPES.SCENE_VIEW,
          tourId: sceneToClose.tourId,
          sceneId: sceneToClose.sceneId,
          durationMs,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    }
  }

  return {
    startSession(): void {
      try {
        closeCurrentScene();
        currentSessionId = uuid();
        sessionStartTime = now();
        emit({ type: EVENT_TYPES.SESSION_START });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    endSession(): void {
      try {
        closeCurrentScene();
        const durationMs =
          sessionStartTime !== null
            ? Math.max(0, Math.floor(now() - sessionStartTime))
            : null;
        sessionStartTime = null;
        emit({
          type: EVENT_TYPES.SESSION_END,
          durationMs,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    tourOpen(tourId: string): void {
      try {
        emit({
          type: EVENT_TYPES.TOUR_OPEN,
          tourId,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    sceneView(tourId: string, sceneId: string): void {
      try {
        closeCurrentScene();
        currentScene = {
          tourId,
          sceneId,
          openedAt: now(),
        };
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    hotspotClick(tourId: string, sceneId: string, hotspotId: string): void {
      try {
        emit({
          type: EVENT_TYPES.HOTSPOT_CLICK,
          tourId,
          sceneId,
          hotspotId,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    audioPlay(tourId: string, sceneId: string): void {
      try {
        emit({
          type: EVENT_TYPES.AUDIO_PLAY,
          tourId,
          sceneId,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    vrEnter(): void {
      try {
        emit({ type: EVENT_TYPES.VR_ENTER });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    vrExit(): void {
      try {
        emit({ type: EVENT_TYPES.VR_EXIT });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    qrShown(tourId?: string): void {
      try {
        emit({
          type: EVENT_TYPES.QR_SHOWN,
          ...(typeof tourId === 'string' ? { tourId } : {}),
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },

    langChange(lang: string): void {
      try {
        emit({
          type: EVENT_TYPES.LANG_CHANGE,
          lang,
        });
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    },
  };
}
