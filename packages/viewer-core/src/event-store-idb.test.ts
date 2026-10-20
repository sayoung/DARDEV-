import { describe, it, expect, vi, afterEach } from 'vitest';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { EVENT_CHANNELS, EVENT_TYPES, type Event } from '@xplor/shared';
import { createIdbEventStore } from './event-store-idb.js';
import { createEventBatcher } from './event-batcher.js';

function createValidTestEvent(index = 1): Event {
  const hex = index.toString(16).padStart(12, '0');
  const event: Event = {
    sessionId: `01990000-0000-7000-8000-${hex}`,
    type: EVENT_TYPES.SCENE_VIEW,
    channel: EVENT_CHANNELS.WEB,
    tourId: '01990000-0000-7000-8000-000000000001',
    sceneId: '01990000-0000-7000-8000-000000000002',
    hotspotId: null,
    lang: 'fr',
    durationMs: 1200,
    occurredAt: '2026-10-20T12:00:00.000Z',
  };
  return event;
}

function writeRawToIndexedDb(
  factory: IDBFactory,
  dbName: string,
  rawContent: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let db: IDBDatabase | undefined;
    const req = factory.open(dbName, 1);
    req.onupgradeneeded = () => {
      const dbInstance = req.result;
      if (!dbInstance.objectStoreNames.contains('queue')) {
        dbInstance.createObjectStore('queue');
      }
    };
    req.onsuccess = () => {
      db = req.result;
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      store.put(rawContent, 'events');
      tx.oncomplete = () => {
        try {
          db?.close();
        } catch {
          // ignore
        }
        resolve();
      };
      tx.onerror = () => {
        try {
          db?.close();
        } catch {
          // ignore
        }
        reject(tx.error ?? new Error('Transaction failed'));
      };
    };
    req.onerror = () => {
      reject(req.error ?? new Error('Open failed'));
    };
  });
}

describe('createIdbEventStore (M7 F-80)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('effectue un aller-retour save et load avec les événements conformes', async () => {
    const factory = new IDBFactory();
    const store = createIdbEventStore({ dbName: 'test-save-load', factory });

    const initial = await store.load();
    expect(initial).toEqual([]);

    const e1 = createValidTestEvent(1);
    const e2 = createValidTestEvent(2);

    await store.save([e1, e2]);

    const loaded = await store.load();
    expect(loaded).toEqual([e1, e2]);
  });

  it('remplace le contenu existant lors d un nouveau save', async () => {
    const factory = new IDBFactory();
    const store = createIdbEventStore({ dbName: 'test-replace', factory });

    const e1 = createValidTestEvent(1);
    const e2 = createValidTestEvent(2);
    const e3 = createValidTestEvent(3);

    await store.save([e1, e2]);
    const firstLoad = await store.load();
    expect(firstLoad).toHaveLength(2);

    await store.save([e3]);
    const secondLoad = await store.load();
    expect(secondLoad).toEqual([e3]);
  });

  it('vide le contenu persistant lors de l appel à save avec un tableau vide', async () => {
    const factory = new IDBFactory();
    const store = createIdbEventStore({ dbName: 'test-empty', factory });

    const e1 = createValidTestEvent(1);
    const e2 = createValidTestEvent(2);

    await store.save([e1, e2]);
    const beforeEmpty = await store.load();
    expect(beforeEmpty).toHaveLength(2);

    await store.save([]);
    const afterEmpty = await store.load();
    expect(afterEmpty).toEqual([]);
  });

  it('ignore les entrées invalides et ne conserve que les événements conformes', async () => {
    const factory = new IDBFactory();
    const dbName = 'test-invalid-entries';

    const e1 = createValidTestEvent(1);
    const e2 = createValidTestEvent(2);

    const corruptData = [
      e1,
      { sessionId: 'invalid-session', type: 'INVALID_TYPE' },
      null,
      'chaine-invalide',
      42,
      { sessionId: '01990000-0000-7000-8000-000000000099' },
      e2,
    ];

    await writeRawToIndexedDb(factory, dbName, corruptData);

    const store = createIdbEventStore({ dbName, factory });
    const loaded = await store.load();

    expect(loaded).toEqual([e1, e2]);
  });

  it('renvoie un tableau vide lorsque la valeur brute persistée n est pas un tableau', async () => {
    const factory = new IDBFactory();
    const dbName = 'test-non-array';

    await writeRawToIndexedDb(factory, dbName, { corrupt: 'payload' });

    const store = createIdbEventStore({ dbName, factory });
    const loaded = await store.load();

    expect(loaded).toEqual([]);
  });

  it('gère une factory indisponible (null ou undefined) sans lever d exception', async () => {
    const storeNull = createIdbEventStore({ factory: null });
    const loadedNull = await storeNull.load();
    expect(loadedNull).toEqual([]);

    await expect(storeNull.save([createValidTestEvent(1)])).resolves.toBeUndefined();

    const storeUndefined = createIdbEventStore({ factory: undefined });
    const loadedUndefined = await storeUndefined.load();
    expect(loadedUndefined).toEqual([]);

    await expect(storeUndefined.save([createValidTestEvent(2)])).resolves.toBeUndefined();
  });

  it('utilise xplor-events par défaut et ne lève pas d exception si factory par défaut indisponible', async () => {
    const store = createIdbEventStore();
    const loaded = await store.load();
    expect(loaded).toEqual([]);

    await expect(store.save([createValidTestEvent(1)])).resolves.toBeUndefined();
  });

  it('gère une erreur d ouverture de base sans propager d exception à load et save', async () => {
    const factory = new IDBFactory();
    const store = createIdbEventStore({ dbName: 'test-open-failure', factory });

    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new Error('Storage disabled by security policy');
    });

    const loaded = await store.load();
    expect(loaded).toEqual([]);

    await expect(store.save([createValidTestEvent(1)])).resolves.toBeUndefined();
  });

  it('ferme la connexion IndexedDB après chaque appel à save et load (évite l accumulation de connexions)', async () => {
    const factory = new IDBFactory();
    const closeSpy = vi.spyOn(IDBDatabase.prototype, 'close');
    const store = createIdbEventStore({ dbName: 'test-close-spy', factory });

    const e1 = createValidTestEvent(1);
    const initialCloseCount = closeSpy.mock.calls.length;

    await store.save([e1]);
    expect(closeSpy.mock.calls.length).toBeGreaterThan(initialCloseCount);
    const countAfterSave = closeSpy.mock.calls.length;

    const loaded = await store.load();
    expect(loaded).toEqual([e1]);
    expect(closeSpy.mock.calls.length).toBeGreaterThan(countAfterSave);
    const countAfterLoad = closeSpy.mock.calls.length;

    await store.save([]);
    expect(closeSpy.mock.calls.length).toBeGreaterThan(countAfterLoad);
  });

  it('ferme la connexion dans le bloc finally même si une étape échoue', async () => {
    const factory = new IDBFactory();
    const closeSpy = vi.spyOn(IDBDatabase.prototype, 'close');
    const store = createIdbEventStore({ dbName: 'test-close-on-error', factory });

    // Initialiser la base
    await store.save([createValidTestEvent(1)]);
    const countBefore = closeSpy.mock.calls.length;

    // Provoquer une erreur dans la transaction
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => {
      throw new Error('Simulated transaction failure');
    });

    const loaded = await store.load();
    expect(loaded).toEqual([]);
    expect(closeSpy.mock.calls.length).toBeGreaterThan(countBefore);
  });

  it('permet la suppression de la base après plusieurs save et load sans être bloqué par des connexions ouvertes', async () => {
    const factory = new IDBFactory();
    const dbName = 'test-delete-unblocked';
    const store = createIdbEventStore({ dbName, factory });

    await store.save([createValidTestEvent(1)]);
    await store.load();
    await store.save([createValidTestEvent(2), createValidTestEvent(3)]);
    await store.load();
    await store.save([]);

    let deleteBlocked = false;
    await new Promise<void>((resolve, reject) => {
      const deleteReq = factory.deleteDatabase(dbName);
      deleteReq.onsuccess = () => {
        resolve();
      };
      deleteReq.onerror = () => {
        reject(deleteReq.error ?? new Error('deleteDatabase failed'));
      };
      deleteReq.onblocked = () => {
        deleteBlocked = true;
        reject(new Error('deleteDatabase was blocked: unclosed connections'));
      };
    });

    expect(deleteBlocked).toBe(false);
  });

  it('s intègre avec createEventBatcher pour restaurer les événements persistés', async () => {
    const factory = new IDBFactory();
    const store = createIdbEventStore({ dbName: 'test-batcher-integration', factory });

    const e1 = createValidTestEvent(1);
    const e2 = createValidTestEvent(2);

    await store.save([e1, e2]);

    const sent: Event[][] = [];
    const batcher = createEventBatcher({
      send: (events) => {
        sent.push(events);
        return Promise.resolve();
      },
      store,
    });

    await batcher.flush();
    expect(sent).toHaveLength(1);
    const firstBatch = sent[0];
    expect(firstBatch).toBeDefined();
    expect(firstBatch).toEqual([e1, e2]);

    const remaining = await store.load();
    expect(remaining).toEqual([]);
  });
});
