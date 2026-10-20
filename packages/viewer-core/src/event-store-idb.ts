/**
 * @file event-store-idb.ts
 * Implémentation IndexedDB du stockage persistant d'événements statistiques (M7 F-80).
 *
 * Fonctionnalités :
 * - Stockage persistant hors ligne des événements statistiques en attente
 * - Object store unique 'queue' avec une clé fixe 'events'
 * - Remplacement du contenu lors de save (tableau vide = efface)
 * - Revalidation stricte par eventSchema lors de load (entrées invalides ignorées)
 * - Résilience absolue : aucune exception ne remonte si IndexedDB est indisponible ou échoue
 * - Fermeture systématique des connexions ouvertes (db.close()) dans un bloc finally
 */

import { eventSchema, type Event } from '@xplor/shared';
import type { EventStore } from './event-batcher.js';

const QUEUE_STORE_NAME = 'queue';
const QUEUE_FIXED_KEY = 'events';
const DB_VERSION = 1;

/**
 * Options de configuration pour le magasin d'événements IndexedDB.
 */
export interface IdbEventStoreOptions {
  dbName?: string;
  factory?: IDBFactory | null | undefined;
}

function toError(reason: unknown, fallbackMessage: string): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error(fallbackMessage);
}

function isIdbFactory(value: unknown): value is IDBFactory {
  return typeof value === 'object' && value !== null && 'open' in value;
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const openReq = factory.open(name, DB_VERSION);

      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
          db.createObjectStore(QUEUE_STORE_NAME);
        }
      };

      openReq.onsuccess = () => {
        resolve(openReq.result);
      };

      openReq.onerror = () => {
        reject(openReq.error ?? new Error('IndexedDB open error'));
      };

      openReq.onblocked = () => {
        reject(new Error('IndexedDB open blocked'));
      };
    } catch (err) {
      reject(toError(err, 'IndexedDB open failed'));
    }
  });
}

/**
 * Crée un magasin persistant d'événements statistiques basé sur IndexedDB.
 *
 * @param options Options incluant le nom de la base et la factory IndexedDB.
 * @returns Instance de `EventStore` compatible avec `EventBatcher`.
 */
export function createIdbEventStore({
  dbName = 'xplor-events',
  factory = globalThis.indexedDB,
}: IdbEventStoreOptions = {}): EventStore {
  async function load(): Promise<Event[]> {
    let db: IDBDatabase | undefined;
    try {
      if (!isIdbFactory(factory)) {
        return [];
      }

      db = await openDatabase(factory, dbName);

      const rawItems = await new Promise<unknown>((resolve, reject) => {
        try {
          if (!db) {
            resolve(undefined);
            return;
          }
          const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
          const store = tx.objectStore(QUEUE_STORE_NAME);
          const getReq = store.get(QUEUE_FIXED_KEY);

          getReq.onsuccess = () => {
            resolve(getReq.result);
          };

          getReq.onerror = () => {
            reject(getReq.error ?? new Error('IndexedDB get error'));
          };

          tx.onerror = () => {
            reject(tx.error ?? new Error('IndexedDB transaction error'));
          };
        } catch (err) {
          reject(toError(err, 'IndexedDB read failed'));
        }
      });

      if (!Array.isArray(rawItems)) {
        return [];
      }

      const validEvents: Event[] = [];
      for (const item of rawItems) {
        const parsed = eventSchema.safeParse(item);
        if (parsed.success) {
          validEvents.push(parsed.data);
        }
      }

      return validEvents;
    } catch {
      return [];
    } finally {
      try {
        db?.close();
      } catch {
        // Ignorer toute erreur lors de la fermeture
      }
    }
  }

  async function save(events: Event[]): Promise<void> {
    let db: IDBDatabase | undefined;
    try {
      if (!isIdbFactory(factory)) {
        return;
      }

      db = await openDatabase(factory, dbName);

      await new Promise<void>((resolve, reject) => {
        try {
          if (!db) {
            resolve();
            return;
          }
          const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
          const store = tx.objectStore(QUEUE_STORE_NAME);

          if (events.length === 0) {
            store.delete(QUEUE_FIXED_KEY);
          } else {
            store.put(events, QUEUE_FIXED_KEY);
          }

          tx.oncomplete = () => {
            resolve();
          };

          tx.onerror = () => {
            reject(tx.error ?? new Error('IndexedDB transaction error'));
          };

          tx.onabort = () => {
            reject(tx.error ?? new Error('IndexedDB transaction aborted'));
          };
        } catch (err) {
          reject(toError(err, 'IndexedDB write failed'));
        }
      });
    } catch {
      // Aucune exception ne doit remonter à l'appelant
    } finally {
      try {
        db?.close();
      } catch {
        // Ignorer toute erreur lors de la fermeture
      }
    }
  }

  return {
    load,
    save,
  };
}
