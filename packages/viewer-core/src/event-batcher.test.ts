import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EVENT_CHANNELS, EVENT_TYPES, type Event } from '@xplor/shared';
import {
  createEventBatcher,
  type EventStore,
} from './event-batcher.js';

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

interface MockStoreState {
  events: Event[];
  loadCount: number;
  saveCalls: Event[][];
}

function createMockStore(initialEvents: Event[] = []): { store: EventStore; state: MockStoreState } {
  const state: MockStoreState = {
    events: [...initialEvents],
    loadCount: 0,
    saveCalls: [],
  };

  const store: EventStore = {
    load(): Promise<Event[]> {
      state.loadCount += 1;
      return Promise.resolve([...state.events]);
    },
    save(saved: Event[]): Promise<void> {
      state.saveCalls.push([...saved]);
      state.events = [...saved];
      return Promise.resolve();
    },
  };

  return { store, state };
}

describe('createEventBatcher (M7 F-80)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Temporisation et envoi par lot (60 s)', () => {
    it('ne transmet aucun lot si aucun événement n est en attente lors d un appel à flush', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      await batcher.flush();

      expect(sent).toHaveLength(0);
    });

    it('n envoie pas immédiatement si moins de 50 événements sont accumulés', () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      batcher.push(createValidTestEvent(1));
      batcher.push(createValidTestEvent(2));

      expect(sent).toHaveLength(0);
    });

    it('déclenche l envoi automatiquement après 60 s d inactivité', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      const e1 = createValidTestEvent(1);
      const e2 = createValidTestEvent(2);
      batcher.push(e1);
      batcher.push(e2);

      // À 59 secondes, aucun envoi
      await vi.advanceTimersByTimeAsync(59_000);
      expect(sent).toHaveLength(0);

      // À 60 secondes révolues, l'envoi a lieu
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sent).toHaveLength(1);

      const firstBatch = sent[0];
      expect(firstBatch).toBeDefined();
      if (firstBatch !== undefined) {
        expect(firstBatch).toHaveLength(2);
        expect(firstBatch[0]?.sessionId).toBe(e1.sessionId);
        expect(firstBatch[1]?.sessionId).toBe(e2.sessionId);
      }

      // 60 s supplémentaires sans nouvel événement : aucun nouvel envoi
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sent).toHaveLength(1);
    });

    it('respecte une durée flushMs personnalisée', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        flushMs: 5_000,
      });

      batcher.push(createValidTestEvent(1));

      await vi.advanceTimersByTimeAsync(4_999);
      expect(sent).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1);
      expect(sent).toHaveLength(1);
    });
  });

  describe('Seuil de lot immédiat (maxBatch = 50)', () => {
    it('déclenche un envoi immédiat dès que 50 événements sont en attente', () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      for (let i = 1; i <= 49; i += 1) {
        batcher.push(createValidTestEvent(i));
      }
      expect(sent).toHaveLength(0);

      // Le 50e événement déclenche l'envoi immédiat
      batcher.push(createValidTestEvent(50));
      expect(sent).toHaveLength(1);

      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(50);
      }
    });

    it('annule la minuterie de 60 s quand le seuil de 50 est atteint', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      for (let i = 1; i <= 50; i += 1) {
        batcher.push(createValidTestEvent(i));
      }
      expect(sent).toHaveLength(1);

      // Avancer de 60 secondes ne doit pas déclencher d'envoi vide résiduel
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sent).toHaveLength(1);
    });

    it('respecte un maxBatch personnalisé', () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        maxBatch: 10,
      });

      for (let i = 1; i <= 9; i += 1) {
        batcher.push(createValidTestEvent(i));
      }
      expect(sent).toHaveLength(0);

      batcher.push(createValidTestEvent(10));
      expect(sent).toHaveLength(1);
      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(10);
      }
    });

    it('découpe les gros volumes en lots d au plus maxBatch lors d un flush', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        maxBatch: 50,
      });

      // Pousser 120 événements
      for (let i = 1; i <= 120; i += 1) {
        batcher.push(createValidTestEvent(i));
      }

      await batcher.flush();

      // Doit découper en 50, 50, 20
      expect(sent).toHaveLength(3);
      const b1 = sent[0];
      const b2 = sent[1];
      const b3 = sent[2];
      expect(b1).toBeDefined();
      expect(b2).toBeDefined();
      expect(b3).toBeDefined();
      if (b1 !== undefined && b2 !== undefined && b3 !== undefined) {
        expect(b1).toHaveLength(50);
        expect(b2).toHaveLength(50);
        expect(b3).toHaveLength(20);
      }
    });
  });

  describe('Gestion des pannes réseau et persistance EventStore', () => {
    it('remet les événements en file et appelle store.save en cas d échec de send', async () => {
      let callCount = 0;
      const { store, state } = createMockStore();

      const batcher = createEventBatcher({
        send: () => {
          callCount += 1;
          return Promise.reject(new Error('Réseau indisponible'));
        },
        store,
      });

      const e1 = createValidTestEvent(1);
      const e2 = createValidTestEvent(2);
      batcher.push(e1);
      batcher.push(e2);

      // flush ne doit lever aucune exception
      await expect(batcher.flush()).resolves.toBeUndefined();
      expect(callCount).toBe(1);

      // Les événements ont été persistés via store.save
      expect(state.saveCalls).toHaveLength(1);
      const savedFirst = state.saveCalls[0];
      expect(savedFirst).toBeDefined();
      if (savedFirst !== undefined) {
        expect(savedFirst).toHaveLength(2);
        expect(savedFirst[0]?.sessionId).toBe(e1.sessionId);
        expect(savedFirst[1]?.sessionId).toBe(e2.sessionId);
      }
    });

    it('retente l envoi au prochain flush après échec et met à jour le store après succès', async () => {
      let shouldFail = true;
      const sent: Event[][] = [];
      const { store, state } = createMockStore();

      const batcher = createEventBatcher({
        send: (events) => {
          if (shouldFail) {
            return Promise.reject(new Error('Erreur temporaire'));
          }
          sent.push(events);
          return Promise.resolve();
        },
        store,
      });

      const e1 = createValidTestEvent(1);
      batcher.push(e1);

      // Premier essai : échec
      await batcher.flush();
      expect(sent).toHaveLength(0);
      expect(state.saveCalls).toHaveLength(1);

      // Rétablissement du réseau pour le prochain flush après 60 s
      shouldFail = false;
      await vi.advanceTimersByTimeAsync(60_000);

      // L'envoi automatique a réussi
      expect(sent).toHaveLength(1);
      const firstBatch = sent[0];
      expect(firstBatch).toBeDefined();
      if (firstBatch !== undefined) {
        expect(firstBatch).toHaveLength(1);
        expect(firstBatch[0]?.sessionId).toBe(e1.sessionId);
      }

      // Le store a été vidé suite au succès
      expect(state.saveCalls.length).toBeGreaterThanOrEqual(2);
      const lastSave = state.saveCalls[state.saveCalls.length - 1];
      expect(lastSave).toBeDefined();
      if (lastSave !== undefined) {
        expect(lastSave).toHaveLength(0);
      }
    });

    it('préserve l ordre chronologique : les anciens événements en échec précèdent les nouveaux', async () => {
      let shouldFail = true;
      const sent: Event[][] = [];
      const { store } = createMockStore();

      const batcher = createEventBatcher({
        send: (events) => {
          if (shouldFail) {
            return Promise.reject(new Error('Coupure réseau'));
          }
          sent.push(events);
          return Promise.resolve();
        },
        store,
      });

      const e1 = createValidTestEvent(1);
      batcher.push(e1);

      await batcher.flush();
      expect(sent).toHaveLength(0);

      // Ajout d'un nouvel événement après l'échec
      const e2 = createValidTestEvent(2);
      batcher.push(e2);

      // Rétablissement et envoi
      shouldFail = false;
      await batcher.flush();

      expect(sent).toHaveLength(1);
      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(2);
        expect(batch[0]?.sessionId).toBe(e1.sessionId);
        expect(batch[1]?.sessionId).toBe(e2.sessionId);
      }
    });
  });

  describe('Rechargement au démarrage depuis EventStore', () => {
    it('recharge les événements persistés au démarrage', async () => {
      const eStored1 = createValidTestEvent(101);
      const eStored2 = createValidTestEvent(102);
      const { store, state } = createMockStore([eStored1, eStored2]);

      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        store,
      });

      expect(state.loadCount).toBe(1);

      await batcher.flush();

      expect(sent).toHaveLength(1);
      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(2);
        expect(batch[0]?.sessionId).toBe(eStored1.sessionId);
        expect(batch[1]?.sessionId).toBe(eStored2.sessionId);
      }
    });

    it('déclenche un envoi immédiat si au moins 50 événements sont rechargés au démarrage', async () => {
      const initial: Event[] = [];
      for (let i = 1; i <= 50; i += 1) {
        initial.push(createValidTestEvent(i));
      }
      const { store } = createMockStore(initial);

      const sent: Event[][] = [];
      createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        store,
      });

      // Attendre la résolution de la microtâche de chargement
      await Promise.resolve();
      await Promise.resolve();

      expect(sent).toHaveLength(1);
      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(50);
      }
    });

    it('ignore les erreurs de store.load() sans lever d exception', async () => {
      const failingStore: EventStore = {
        load(): Promise<Event[]> {
          return Promise.reject(new Error('IndexedDB corrompue'));
        },
        save(): Promise<void> {
          return Promise.resolve();
        },
      };

      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
        store: failingStore,
      });

      const e1 = createValidTestEvent(1);
      batcher.push(e1);

      await expect(batcher.flush()).resolves.toBeUndefined();
      expect(sent).toHaveLength(1);
    });

    it('ignore les erreurs de store.save() sans lever d exception', async () => {
      const failingStore: EventStore = {
        load(): Promise<Event[]> {
          return Promise.resolve([]);
        },
        save(): Promise<void> {
          return Promise.reject(new Error('Stockage plein'));
        },
      };

      const batcher = createEventBatcher({
        send: () => Promise.reject(new Error('HTTP 500')),
        store: failingStore,
      });

      batcher.push(createValidTestEvent(1));

      // Ne doit jamais lever d'erreur
      await expect(batcher.flush()).resolves.toBeUndefined();
    });
  });

  describe('Méthode destroy()', () => {
    it('annule la minuterie active et empêche l envoi automatique futur', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      batcher.push(createValidTestEvent(1));
      batcher.destroy();

      // Même après 60 s, rien n'est envoyé
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sent).toHaveLength(0);
    });

    it('ignore les nouveaux événements après destroy()', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      batcher.destroy();
      batcher.push(createValidTestEvent(1));

      await batcher.flush();
      expect(sent).toHaveLength(0);
    });

    it('est idempotente et ne lève aucune exception sur appels répétés', () => {
      const batcher = createEventBatcher({
        send: () => Promise.resolve(),
      });

      expect(() => {
        batcher.destroy();
        batcher.destroy();
        batcher.destroy();
      }).not.toThrow();
    });
  });

  describe('Résilience absolue et conformité', () => {
    it('ne lève aucune exception si send lance une erreur synchrone', async () => {
      const batcher = createEventBatcher({
        send: () => {
          throw new Error('Crash synchrone inattendu');
        },
      });

      batcher.push(createValidTestEvent(1));
      await expect(batcher.flush()).resolves.toBeUndefined();
    });

    it('rejette silencieusement les événements invalides sans corrompre la file', async () => {
      const sent: Event[][] = [];
      const batcher = createEventBatcher({
        send: (events) => {
          sent.push(events);
          return Promise.resolve();
        },
      });

      // Événement non conforme aux schémas Zod partagés (mauvais format sessionId)
      const invalidEvent: Event = {
        sessionId: 'not-a-valid-uuid',
        type: EVENT_TYPES.SCENE_VIEW,
        channel: EVENT_CHANNELS.WEB,
        tourId: null,
        sceneId: null,
        hotspotId: null,
        lang: 'fr',
        durationMs: null,
        occurredAt: '2026-10-20T12:00:00.000Z',
      };

      batcher.push(invalidEvent);

      const valid = createValidTestEvent(1);
      batcher.push(valid);

      await batcher.flush();

      // Seul l'événement valide est envoyé
      expect(sent).toHaveLength(1);
      const batch = sent[0];
      expect(batch).toBeDefined();
      if (batch !== undefined) {
        expect(batch).toHaveLength(1);
        expect(batch[0]?.sessionId).toBe(valid.sessionId);
      }
    });

    it('gère les appels simultanés à flush sans requêtes concurrentes désordonnées', async () => {
      let inFlight = 0;
      let maxConcurrent = 0;
      const sent: Event[][] = [];

      const batcher = createEventBatcher({
        send: async (events) => {
          inFlight += 1;
          if (inFlight > maxConcurrent) {
            maxConcurrent = inFlight;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 50);
          });
          sent.push(events);
          inFlight -= 1;
        },
      });

      batcher.push(createValidTestEvent(1));
      batcher.push(createValidTestEvent(2));

      const p1 = batcher.flush();
      const p2 = batcher.flush();

      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([p1, p2]);

      expect(maxConcurrent).toBe(1);
      expect(sent).toHaveLength(1);
    });
  });
});
