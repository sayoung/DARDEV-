/**
 * @file event-batcher.ts
 * Collecteur et expéditeur d'événements statistiques par lots (M7 F-80).
 *
 * Fonctionnalités :
 * - Accumulation des événements en file d'attente
 * - Envoi immédiat dès que le seuil de 50 événements est atteint (maxBatch)
 * - Envoi automatique au bout de 60 secondes (flushMs)
 * - Persistance locale via EventStore (ex. IndexedDB) en cas d'échec du réseau
 * - Rechargement des événements non envoyés au démarrage
 * - Résilience absolue : aucune exception ne remonte à l'appelant
 */

import { eventSchema, type Event } from '@xplor/shared';

/**
 * Interface pour le stockage persistant des événements hors ligne (IndexedDB).
 */
export interface EventStore {
  load(): Promise<Event[]>;
  save(events: Event[]): Promise<void>;
}

/**
 * Options de configuration du gestionnaire de lots d'événements.
 */
export interface EventBatcherOptions {
  send: (events: Event[]) => Promise<void>;
  maxBatch?: number;
  flushMs?: number;
  store?: EventStore;
}

/**
 * Interface publique du collecteur d'événements statistiques.
 */
export interface EventBatcher {
  push(event: Event): void;
  flush(): Promise<void>;
  destroy(): void;
}

interface BatcherState {
  isDestroyed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  hasPersisted: boolean;
  flushAgainNeeded: boolean;
  drainAllRequested: boolean;
  currentFlush: Promise<void> | null;
}

/**
 * Crée un gestionnaire de lots d'événements statistiques.
 *
 * @param options Paramètres de configuration (send, maxBatch, flushMs, store).
 * @returns Instance de `EventBatcher` avec les méthodes `push`, `flush` et `destroy`.
 */
export function createEventBatcher({
  send,
  maxBatch = 50,
  flushMs = 60_000,
  store,
}: EventBatcherOptions): EventBatcher {
  const batchLimit = maxBatch > 0 ? maxBatch : 50;
  const intervalMs = flushMs > 0 ? flushMs : 60_000;

  const queue: Event[] = [];
  const state: BatcherState = {
    isDestroyed: false,
    timer: null,
    hasPersisted: false,
    flushAgainNeeded: false,
    drainAllRequested: false,
    currentFlush: null,
  };

  let initPromise: Promise<void> | null = null;

  function clearTimer(): void {
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function scheduleTimer(): void {
    if (state.timer !== null || state.isDestroyed) {
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      void executeFlush(true);
    }, intervalMs);
  }

  if (store !== undefined) {
    initPromise = (async () => {
      try {
        const loaded = await store.load();
        if (state.isDestroyed) {
          return;
        }
        if (Array.isArray(loaded) && loaded.length > 0) {
          const validEvents: Event[] = [];
          for (const item of loaded) {
            const parsed = eventSchema.safeParse(item);
            if (parsed.success) {
              validEvents.push(parsed.data);
            }
          }
          if (validEvents.length > 0) {
            queue.unshift(...validEvents);
            state.hasPersisted = true;
            if (queue.length >= batchLimit) {
              clearTimer();
              void executeFlush(false);
            } else {
              scheduleTimer();
            }
          }
        }
      } catch {
        // Aucune exception ne doit remonter à l'appelant
      } finally {
        initPromise = null;
      }
    })();
  }

  function push(event: Event): void {
    if (state.isDestroyed) {
      return;
    }

    const parsed = eventSchema.safeParse(event);
    if (!parsed.success) {
      return;
    }

    queue.push(parsed.data);

    if (queue.length >= batchLimit) {
      clearTimer();
      void executeFlush(false);
    } else {
      scheduleTimer();
    }
  }

  async function executeFlush(drainAll: boolean): Promise<void> {
    if (state.isDestroyed) {
      return;
    }

    if (drainAll) {
      state.drainAllRequested = true;
    }

    if (state.currentFlush !== null) {
      state.flushAgainNeeded = true;
      try {
        await state.currentFlush;
      } catch {
        // Aucune exception ne remonte à l'appelant
      }
      return;
    }

    state.currentFlush = (async () => {
      try {
        if (initPromise !== null) {
          try {
            await initPromise;
          } catch {
            // Aucune exception ne remonte à l'appelant
          }
        }

        clearTimer();

        while (queue.length > 0 && !state.isDestroyed) {
          if (!state.drainAllRequested && queue.length < batchLimit) {
            break;
          }

          const batch = queue.splice(0, batchLimit);
          try {
            await send(batch);

            if (store !== undefined && state.hasPersisted) {
              try {
                await store.save([...queue]);
                if (queue.length === 0) {
                  state.hasPersisted = false;
                }
              } catch {
                // Aucune exception ne remonte à l'appelant
              }
            }
          } catch {
            // Remise des événements en tête de file
            queue.unshift(...batch);
            state.hasPersisted = true;
            state.flushAgainNeeded = false;
            state.drainAllRequested = false;

            if (store !== undefined) {
              try {
                await store.save([...queue]);
              } catch {
                // Aucune exception ne remonte à l'appelant
              }
            }

            // Nouvel essai planifié au prochain flush
            scheduleTimer();
            break;
          }
        }

        if (queue.length > 0) {
          scheduleTimer();
        }
      } catch {
        // Garde-fou global : aucune exception ne remonte
      } finally {
        state.currentFlush = null;
      }

      if (state.flushAgainNeeded && queue.length > 0 && !state.isDestroyed) {
        state.flushAgainNeeded = false;
        const nextDrain = state.drainAllRequested;
        state.drainAllRequested = false;
        await executeFlush(nextDrain);
      } else {
        state.flushAgainNeeded = false;
        state.drainAllRequested = false;
      }
    })();

    try {
      await state.currentFlush;
    } catch {
      // Aucune exception ne remonte à l'appelant
    }
  }

  function flush(): Promise<void> {
    return executeFlush(true);
  }

  function destroy(): void {
    if (state.isDestroyed) {
      return;
    }
    state.isDestroyed = true;
    clearTimer();
  }

  return {
    push,
    flush,
    destroy,
  };
}
