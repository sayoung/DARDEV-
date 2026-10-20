import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  EVENT_CHANNELS,
  EVENT_TYPES,
  eventsBatchSchema,
  type Event,
} from '@xplor/shared';
import { createIdbEventStore } from './event-store-idb.js';
import {
  createStatsSession,
  type StatsSessionDocument,
} from './stats-session.js';

class FakeDocument extends EventTarget implements StatsSessionDocument {
  visibilityState: DocumentVisibilityState = 'visible';
}

function generateUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `01990000-0000-7000-8000-${hex}`;
}

function extractEventsFromCall(
  call: Parameters<typeof fetch> | undefined,
): Event[] {
  if (call === undefined) {
    throw new Error('Call is undefined');
  }
  const [, init] = call;
  const bodyRaw = init?.body;
  if (typeof bodyRaw !== 'string') {
    throw new Error('Expected body to be a string');
  }
  const parsedJson: unknown = JSON.parse(bodyRaw);
  const result = eventsBatchSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(`Batch parsing failed: ${result.error.message}`);
  }
  return result.data.events;
}

function extractHeader(
  init: RequestInit | undefined,
  headerName: string,
): string | undefined {
  const headers = init?.headers;
  if (headers === undefined) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return headers.get(headerName) ?? undefined;
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([k]) => k.toLowerCase() === headerName.toLowerCase());
    return entry?.[1];
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === headerName.toLowerCase()) {
      return v;
    }
  }
  return undefined;
}

describe('createStatsSession (M7 F-80)', () => {
  let fakeIdb: IDBFactory;
  let uuidCounter: number;
  let nowTimestamp: number;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
    fakeIdb = new IDBFactory();
    uuidCounter = 1;
    nowTimestamp = 1_771_000_000_000;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const TOUR_ID_1 = '01990000-0000-7000-8000-000000000001';
  const SCENE_ID_1 = '01990000-0000-7000-8000-000000000002';

  it('assemble les modules et expose tracker, flush et destroy', () => {
    const session = createStatsSession({
      apiBase: 'https://api.xplor.test',
      channel: EVENT_CHANNELS.WEB,
      getLang: () => 'fr',
      storeFactory: fakeIdb,
    });

    expect(session).toBeDefined();
    expect(typeof session.tracker).toBe('object');
    expect(typeof session.tracker.startSession).toBe('function');
    expect(typeof session.tracker.endSession).toBe('function');
    expect(typeof session.tracker.tourOpen).toBe('function');
    expect(typeof session.tracker.sceneView).toBe('function');
    expect(typeof session.tracker.hotspotClick).toBe('function');
    expect(typeof session.tracker.audioPlay).toBe('function');
    expect(typeof session.tracker.vrEnter).toBe('function');
    expect(typeof session.tracker.vrExit).toBe('function');
    expect(typeof session.tracker.qrShown).toBe('function');
    expect(typeof session.tracker.langChange).toBe('function');
    expect(typeof session.flush).toBe('function');
    expect(typeof session.destroy).toBe('function');
  });

  describe('(1) Envoi automatique après 60 s', () => {
    it('envoie un événement poussé après 60 s d inactivité', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        now: () => nowTimestamp,
        uuid: () => generateUuid(uuidCounter++),
        flushMs: 60_000,
      });

      session.tracker.tourOpen(TOUR_ID_1);

      // À 59 secondes : aucun appel fetch
      await vi.advanceTimersByTimeAsync(59_000);
      expect(mockFetch).not.toHaveBeenCalled();

      // À 60 secondes : l'envoi a lieu
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall to be defined');
      }

      const [url, init] = firstCall;
      expect(url).toBe('https://api.xplor.test/events');
      expect(init?.method).toBe('POST');
      expect(init?.credentials).toBe('omit');

      const events = extractEventsFromCall(firstCall);
      expect(events).toHaveLength(1);
      const firstEvent = events[0];
      if (firstEvent === undefined) {
        throw new Error('Expected firstEvent to be defined');
      }

      expect(firstEvent.type).toBe(EVENT_TYPES.TOUR_OPEN);
      expect(firstEvent.tourId).toBe(TOUR_ID_1);
      expect(firstEvent.channel).toBe(EVENT_CHANNELS.WEB);
      expect(firstEvent.lang).toBe('fr');
      expect(firstEvent.occurredAt).toBe(new Date(nowTimestamp).toISOString());

      // 60 secondes suivantes sans nouvel événement : aucun nouvel appel
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('(2) Échec réseau et persistance IndexedDB', () => {
    it('un échec réseau conserve les événements dans IndexedDB', async () => {
      const dbName = 'test-idb-network-failure';
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('Connexion réseau interrompue')),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.KIOSK,
        getLang: () => 'ar',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        dbName,
        now: () => nowTimestamp,
        uuid: () => generateUuid(uuidCounter++),
      });

      session.tracker.tourOpen(TOUR_ID_1);

      // Déclenchement du flush : échec de transmission
      await session.flush();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Vérification que l'événement a bien été persisté dans IndexedDB
      const verifyStore = createIdbEventStore({ factory: fakeIdb, dbName });
      const storedEvents = await verifyStore.load();
      expect(storedEvents).toHaveLength(1);

      const stored = storedEvents[0];
      if (stored === undefined) {
        throw new Error('Expected stored event');
      }
      expect(stored.type).toBe(EVENT_TYPES.TOUR_OPEN);
      expect(stored.tourId).toBe(TOUR_ID_1);
      expect(stored.channel).toBe(EVENT_CHANNELS.KIOSK);
      expect(stored.lang).toBe('ar');
    });

    it('retransmet les événements sauvegardés dans IndexedDB lorsque le réseau redevient disponible', async () => {
      const dbName = 'test-idb-recovery';
      let networkOnline = false;

      const mockFetch = vi.fn<typeof fetch>(() => {
        if (!networkOnline) {
          return Promise.reject(new Error('Connexion réseau interrompue'));
        }
        return Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        }));
      });

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        dbName,
        now: () => nowTimestamp,
        uuid: () => generateUuid(uuidCounter++),
      });

      session.tracker.tourOpen(TOUR_ID_1);

      // Tentative échouée
      await session.flush();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const verifyStore = createIdbEventStore({ factory: fakeIdb, dbName });
      const storedBefore = await verifyStore.load();
      expect(storedBefore).toHaveLength(1);

      // Rétablissement du réseau
      networkOnline = true;
      await session.flush();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const eventsSent = extractEventsFromCall(mockFetch.mock.calls[1]);
      expect(eventsSent).toHaveLength(1);
      const sentItem = eventsSent[0];
      if (sentItem === undefined) {
        throw new Error('Expected sentItem');
      }
      expect(sentItem.tourId).toBe(TOUR_ID_1);

      // IndexedDB est maintenant vidée
      const storedAfter = await verifyStore.load();
      expect(storedAfter).toHaveLength(0);
    });
  });

  describe('(3) Méthode destroy() et flush final', () => {
    it('destroy fait un flush final et arrête la minuterie', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.VR,
        getLang: () => 'en',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        now: () => nowTimestamp,
        uuid: () => generateUuid(uuidCounter++),
      });

      session.tracker.tourOpen(TOUR_ID_1);

      // Avancement de 10 secondes seulement (seuil de 60 s non atteint)
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockFetch).not.toHaveBeenCalled();

      // Appel de destroy() : flush final immédiat
      await session.destroy();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const eventsSent = extractEventsFromCall(mockFetch.mock.calls[0]);
      expect(eventsSent).toHaveLength(1);
      const sentItem = eventsSent[0];
      if (sentItem === undefined) {
        throw new Error('Expected sentItem');
      }
      expect(sentItem.type).toBe(EVENT_TYPES.TOUR_OPEN);
      expect(sentItem.channel).toBe(EVENT_CHANNELS.VR);

      // Avancement du temps : aucun appel ultérieur car la minuterie est arrêtée
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Les nouveaux événements après destroy sont ignorés
      session.tracker.tourOpen(TOUR_ID_1);
      await session.flush();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('destroy ne lève aucune exception même si le flush final échoue', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.reject(new Error('Panne réseau complète lors de la fermeture')),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
      });

      session.tracker.tourOpen(TOUR_ID_1);

      await expect(session.destroy()).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('destroy est idempotent', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
      });

      session.tracker.tourOpen(TOUR_ID_1);

      await session.destroy();
      await session.destroy();
      await session.destroy();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('(4) Écouteur visibilitychange', () => {
    it('l état hidden déclenche tracker.endSession() puis flush', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 2 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const fakeDoc = new FakeDocument();
      fakeDoc.visibilityState = 'visible';

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        document: fakeDoc,
        now: () => nowTimestamp,
        uuid: () => generateUuid(uuidCounter++),
      });

      session.tracker.startSession();
      session.tracker.sceneView(TOUR_ID_1, SCENE_ID_1);

      // Simulation d'une navigation de 4000 ms
      nowTimestamp += 4000;

      // Passage de l'onglet à l'état caché
      fakeDoc.visibilityState = 'hidden';
      fakeDoc.dispatchEvent(new Event('visibilitychange'));

      // Flush asynchrone déclenché
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const eventsSent = extractEventsFromCall(mockFetch.mock.calls[0]);
      // Attendu : SESSION_START, SCENE_VIEW (avec durationMs = 4000) et SESSION_END (avec durationMs = 4000)
      expect(eventsSent.length).toBeGreaterThanOrEqual(3);

      const sceneViewEvent = eventsSent.find((e) => e.type === EVENT_TYPES.SCENE_VIEW);
      expect(sceneViewEvent).toBeDefined();
      if (sceneViewEvent !== undefined) {
        expect(sceneViewEvent.durationMs).toBe(4000);
        expect(sceneViewEvent.sceneId).toBe(SCENE_ID_1);
      }

      const sessionEndEvent = eventsSent.find((e) => e.type === EVENT_TYPES.SESSION_END);
      expect(sessionEndEvent).toBeDefined();
      if (sessionEndEvent !== undefined) {
        expect(sessionEndEvent.durationMs).toBe(4000);
      }
    });

    it('l état visible n entraîne aucun endSession ni flush', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const fakeDoc = new FakeDocument();
      fakeDoc.visibilityState = 'visible';

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        document: fakeDoc,
      });

      session.tracker.startSession();

      // Dispatch avec visibilityState à visible
      fakeDoc.dispatchEvent(new Event('visibilitychange'));

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retire l écouteur visibilitychange lors de destroy()', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const fakeDoc = new FakeDocument();
      fakeDoc.visibilityState = 'visible';

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        document: fakeDoc,
      });

      session.tracker.startSession();
      await session.destroy();

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Simulation d'un événement hidden après destroy
      fakeDoc.visibilityState = 'hidden';
      fakeDoc.dispatchEvent(new Event('visibilitychange'));

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('(5) Environnement sans DOM', () => {
    it('fonctionne sans DOM lorsque document est absent ou null', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        document: null,
      });

      session.tracker.tourOpen(TOUR_ID_1);
      await session.flush();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await expect(session.destroy()).resolves.toBeUndefined();
    });
  });

  describe('(6) Options supplémentaires (jeton, taille de lot)', () => {
    it('transmet l en-tête Authorization: Bearer quand getToken renvoie un jeton', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.KIOSK,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        getToken: () => 'secret-kiosk-token-999',
      });

      session.tracker.tourOpen(TOUR_ID_1);
      await session.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall');
      }

      const [, init] = firstCall;
      const authHeader = extractHeader(init, 'Authorization');
      expect(authHeader).toBe('Bearer secret-kiosk-token-999');
    });

    it('n inclut aucun en-tête Authorization si getToken renvoie null ou n est pas défini', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 1 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        getToken: () => null,
      });

      session.tracker.tourOpen(TOUR_ID_1);
      await session.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall).toBeDefined();
      if (firstCall === undefined) {
        throw new Error('Expected firstCall');
      }

      const [, init] = firstCall;
      const authHeader = extractHeader(init, 'Authorization');
      expect(authHeader).toBeUndefined();
    });

    it('déclenche un envoi immédiat lorsque maxBatch est atteint', async () => {
      const mockFetch = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ ingested: 2 }), {
          status: 200,
          statusText: 'OK',
        })),
      );

      const session = createStatsSession({
        apiBase: 'https://api.xplor.test',
        channel: EVENT_CHANNELS.WEB,
        getLang: () => 'fr',
        storeFactory: fakeIdb,
        fetchFn: mockFetch,
        maxBatch: 2,
      });

      session.tracker.tourOpen(TOUR_ID_1);
      expect(mockFetch).not.toHaveBeenCalled();

      session.tracker.tourOpen(TOUR_ID_1);
      // Seuil maxBatch = 2 atteint : envoi immédiat
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });
  });
});
