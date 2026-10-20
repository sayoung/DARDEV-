/**
 * @file stats-session.ts
 * Assemblage de session de collecte et transmission de statistiques (M7 F-80).
 *
 * Fonctionnalités :
 * - Assemble createIdbEventStore, createEventSender, createEventBatcher et createStatsTracker
 * - Fournit l'interface de pilotage { tracker, flush(), destroy() }
 * - flush() vide la file d'attente vers l'expéditeur d'événements
 * - destroy() vide la file une dernière fois (sans lever d'exception) et arrête la minuterie
 * - Gestion du cycle de vie Document/DOM : si `document` est disponible, enregistre un écouteur
 *   'visibilitychange' (état 'hidden' → tracker.endSession() puis flush) retiré au destroy
 * - Résilience absolue : aucune exception ne remonte à l'appelant
 * - Conforme NF-02 (loi 09-08) : aucune donnée personnelle collectée
 */

import type { EventChannel } from '@xplor/shared';
import { createIdbEventStore } from './event-store-idb.js';
import { createEventSender } from './event-sender.js';
import { createEventBatcher } from './event-batcher.js';
import { createStatsTracker, type StatsTracker } from './stats-tracker.js';

/**
 * Interface minimale d'un document pour la gestion de l'événement visibilitychange.
 */
export interface StatsSessionDocument {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  readonly visibilityState: DocumentVisibilityState;
}

/**
 * Options de configuration pour la session de statistiques.
 */
export interface StatsSessionOptions {
  apiBase: string;
  channel: EventChannel;
  getLang: () => string;
  getToken?: () => string | null;
  storeFactory?: IDBFactory | null | undefined;
  flushMs?: number;
  maxBatch?: number;
  fetchFn?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
  document?: StatsSessionDocument | null;
  dbName?: string;
}

/**
 * Interface publique de la session de statistiques.
 */
export interface StatsSession {
  tracker: StatsTracker;
  flush(): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Crée une session de statistiques assemblant le stockage IndexedDB, l'expéditeur HTTP,
 * le gestionnaire de lots et le traqueur d'événements.
 *
 * @param options Paramètres de configuration (apiBase, channel, getLang, etc.).
 * @returns Instance de `StatsSession` avec tracker, flush et destroy.
 */
export function createStatsSession({
  apiBase,
  channel,
  getLang,
  getToken,
  storeFactory,
  flushMs,
  maxBatch,
  fetchFn,
  now,
  uuid,
  document: customDoc,
  dbName,
}: StatsSessionOptions): StatsSession {
  const store = createIdbEventStore({
    dbName,
    factory: storeFactory,
  });

  const sender = createEventSender({
    apiBase,
    getToken,
    fetchFn,
  });

  const batcher = createEventBatcher({
    send: sender,
    flushMs,
    maxBatch,
    store,
  });

  const tracker = createStatsTracker({
    batcher,
    channel,
    getLang,
    now,
    uuid,
  });

  let isDestroyed = false;
  let cleanupVisibility: (() => void) | null = null;

  const activeDoc: StatsSessionDocument | null =
    customDoc !== undefined
      ? customDoc
      : typeof document !== 'undefined'
        ? document
        : null;

  if (
    activeDoc !== null &&
    typeof activeDoc.addEventListener === 'function' &&
    typeof activeDoc.removeEventListener === 'function'
  ) {
    const onVisibilityChange = (): void => {
      try {
        if (activeDoc.visibilityState === 'hidden') {
          tracker.endSession();
          void batcher.flush();
        }
      } catch {
        // Résilience absolue : aucune exception ne remonte
      }
    };

    try {
      activeDoc.addEventListener('visibilitychange', onVisibilityChange);
      cleanupVisibility = (): void => {
        try {
          activeDoc.removeEventListener('visibilitychange', onVisibilityChange);
        } catch {
          // Résilience absolue
        }
      };
    } catch {
      cleanupVisibility = null;
    }
  }

  async function flush(): Promise<void> {
    if (isDestroyed) {
      return;
    }
    try {
      await batcher.flush();
    } catch {
      // Aucune exception ne remonte à l'appelant
    }
  }

  async function destroy(): Promise<void> {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    if (cleanupVisibility !== null) {
      cleanupVisibility();
      cleanupVisibility = null;
    }

    try {
      await batcher.flush();
    } catch {
      // flush sans lever d'exception
    } finally {
      batcher.destroy();
    }
  }

  return {
    tracker,
    flush,
    destroy,
  };
}
