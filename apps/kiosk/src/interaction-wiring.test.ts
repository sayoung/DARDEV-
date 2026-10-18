import type { KioskManifest } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppState, type AppAction } from './app-state.js';
import { buildHomeModel } from './home-model.js';
import { wireInteractions } from './interaction-wiring.js';
import { renderHome } from './render-home.js';

class FakeTimers {
  time = 0;
  nextId = 0;
  readonly timers = new Map<number, { at: number; callback: () => void }>();

  readonly now = (): number => this.time;

  readonly setTimeout = (callback: () => void, delayMs: number): number => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.time + delayMs, callback });
    return id;
  };

  readonly clearTimeout = (handle: unknown): void => {
    if (typeof handle === 'number') {
      this.timers.delete(handle);
    }
  };

  advanceBy(milliseconds: number): void {
    const target = this.time + milliseconds;
    for (;;) {
      const candidates = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(([, left], [, right]) => left.at - right.at);
      const next = candidates[0];
      if (next === undefined) {
        break;
      }

      const [id, timer] = next;
      this.timers.delete(id);
      this.time = timer.at;
      timer.callback();
    }
    this.time = target;
  }
}

const mockManifest: KioskManifest = {
  manifestVersion: '1.0.0',
  hotel: {
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Hôtel La Tour Hassan Palace',
    logoUrl: 'https://media.xplor.ma/hotels/tour-hassan.png',
    brandColor: '#6958A5',
    languages: ['fr', 'ar', 'en'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  kiosk: {
    id: '01990000-0000-7000-8000-000000000002',
    label: 'Kiosque Réception',
    idleTimeoutSeconds: 10,
    deviceType: 'TOUCH_SCREEN',
  },
  selection: {
    featuredTourId: '01990000-0000-7000-8000-000000000100',
    attractTourIds: ['01990000-0000-7000-8000-000000000100'],
    tours: [
      {
        id: '01990000-0000-7000-8000-000000000100',
        contentVersion: 1,
        sizeBytes: 150000000,
        url: '/api/v1/tours/01990000-0000-7000-8000-000000000100',
        categoryId: '01990000-0000-7000-8000-000000000010',
      },
    ],
  },
  categories: [
    {
      id: '01990000-0000-7000-8000-000000000010',
      name: { fr: 'Monuments', ar: 'معالم', en: 'Monuments' },
      icon: 'landmark',
      color: '#1F6F8B',
    },
  ],
};

describe('wireInteractions (F-63 / F-67)', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  describe('inactivité → IDLE (F-63)', () => {
    it('dispatche IDLE à expiration du délai d’inactivité', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(9_999);
      expect(dispatchedActions).toEqual([]);

      timers.advanceBy(1);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      wiring.dispose();
    });

    it('bascule l’écran vers ATTRACT avec le store réel (createAppState)', () => {
      const timers = new FakeTimers();
      const store = createAppState({
        manifest: mockManifest,
        screen: 'HOME',
        enrolled: true,
      });

      const wiring = wireInteractions({
        doc: document,
        state: store,
        idleTimeoutSeconds: 5,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(store.getState().screen).toBe('HOME');
      timers.advanceBy(5_000);
      expect(store.getState().screen).toBe('ATTRACT');

      wiring.dispose();
    });

    it('ne redispatche pas IDLE tant qu’aucune interaction n’a eu lieu', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(30_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      wiring.dispose();
    });
  });

  describe('appui en veille → WAKE (F-63)', () => {
    it('dispatche WAKE lors d’un pointerdown sur le document pendant la veille', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      // Passage en veille
      timers.advanceBy(10_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      // Interaction utilisateur
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(dispatchedActions).toEqual([{ type: 'IDLE' }, { type: 'WAKE' }]);

      // Après réveil, le cycle d'inactivité est reprogrammé
      timers.advanceBy(10_000);
      expect(dispatchedActions).toEqual([
        { type: 'IDLE' },
        { type: 'WAKE' },
        { type: 'IDLE' },
      ]);

      wiring.dispose();
    });

    it('dispatche WAKE lors d’un keydown sur le document pendant la veille', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(10_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      document.dispatchEvent(new Event('keydown', { bubbles: true }));
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }, { type: 'WAKE' }]);

      wiring.dispose();
    });

    it('ramène l’écran d’ATTRACT vers HOME avec le store réel (createAppState)', () => {
      const timers = new FakeTimers();
      const store = createAppState({
        manifest: mockManifest,
        screen: 'HOME',
        enrolled: true,
      });

      const wiring = wireInteractions({
        doc: document,
        state: store,
        idleTimeoutSeconds: 5,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(5_000);
      expect(store.getState().screen).toBe('ATTRACT');

      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(store.getState().screen).toBe('HOME');

      wiring.dispose();
    });
  });

  describe('interactions en cours d’activité (réinitialisation du délai)', () => {
    it('repousse le passage en veille à chaque pointerdown', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(8_000);
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      // 8 s plus tard : 16 s au total, mais seulement 8 s depuis l'interaction
      timers.advanceBy(8_000);
      expect(dispatchedActions).toEqual([]);

      // 2 s plus tard : 10 s après l'interaction -> IDLE
      timers.advanceBy(2_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      wiring.dispose();
    });

    it('repousse le passage en veille à chaque keydown', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(7_000);
      document.dispatchEvent(new Event('keydown', { bubbles: true }));

      timers.advanceBy(7_000);
      expect(dispatchedActions).toEqual([]);

      timers.advanceBy(3_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      wiring.dispose();
    });

    it('permet d’appeler activity() manuellement pour signaler une interaction', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(8_000);
      wiring.activity();

      timers.advanceBy(8_000);
      expect(dispatchedActions).toEqual([]);

      timers.advanceBy(2_000);
      expect(dispatchedActions).toEqual([{ type: 'IDLE' }]);

      wiring.dispose();
    });
  });

  describe('geste caché : 5 appuis en 3 s sur [data-logo] → OPEN_MAINTENANCE (F-67)', () => {
    it('déclenche OPEN_MAINTENANCE après 5 appuis en 3 s sur l’élément [data-logo]', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logo = document.createElement('h1');
      logo.className = 'kiosk-hotel-name';
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      timers.advanceBy(500);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      timers.advanceBy(500);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      timers.advanceBy(500);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      timers.advanceBy(500);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(dispatchedActions).toEqual([]);

      timers.advanceBy(500);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(dispatchedActions).toEqual([{ type: 'OPEN_MAINTENANCE' }]);

      wiring.dispose();
    });

    it('déclenche OPEN_MAINTENANCE lorsqu’on clique sur un élément enfant de [data-logo]', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logoContainer = document.createElement('div');
      logoContainer.setAttribute('data-logo', 'hotel');
      const textSpan = document.createElement('span');
      textSpan.textContent = 'Nom hôtel';
      logoContainer.appendChild(textSpan);
      document.body.appendChild(logoContainer);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      for (let i = 0; i < 5; i++) {
        timers.advanceBy(200);
        textSpan.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }

      expect(dispatchedActions).toEqual([{ type: 'OPEN_MAINTENANCE' }]);

      wiring.dispose();
    });

    it('fait basculer l’état vers MAINTENANCE_PIN avec le store réel (createAppState)', () => {
      const timers = new FakeTimers();
      const store = createAppState({
        manifest: mockManifest,
        screen: 'HOME',
        enrolled: true,
      });

      const logo = document.createElement('h1');
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state: store,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(store.getState().screen).toBe('HOME');

      for (let i = 0; i < 5; i++) {
        timers.advanceBy(300);
        logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }

      expect(store.getState().screen).toBe('MAINTENANCE_PIN');

      wiring.dispose();
    });

    it('réinitialise la séquence : un 6e appui immédiat ne redéclenche pas immédiatement', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logo = document.createElement('h1');
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      for (let i = 0; i < 5; i++) {
        timers.advanceBy(200);
        logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }
      expect(dispatchedActions).toEqual([{ type: 'OPEN_MAINTENANCE' }]);

      // 6e appui
      timers.advanceBy(100);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(dispatchedActions).toEqual([{ type: 'OPEN_MAINTENANCE' }]);

      // 4 appuis supplémentaires pour compléter la 2e série de 5
      for (let i = 0; i < 4; i++) {
        timers.advanceBy(200);
        logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }
      expect(dispatchedActions).toEqual([
        { type: 'OPEN_MAINTENANCE' },
        { type: 'OPEN_MAINTENANCE' },
      ]);

      wiring.dispose();
    });

    it('ne déclenche pas si seulement 4 appuis ont lieu', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logo = document.createElement('h1');
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      for (let i = 0; i < 4; i++) {
        timers.advanceBy(300);
        logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }

      expect(dispatchedActions).toEqual([]);

      wiring.dispose();
    });

    it('ne déclenche pas si les 5 appuis sont étalés sur plus de 3 secondes', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logo = document.createElement('h1');
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      // Appui 1 à t=0
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      // Appui 2 à t=800
      timers.advanceBy(800);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      // Appui 3 à t=1600
      timers.advanceBy(800);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      // Appui 4 à t=2400
      timers.advanceBy(800);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      // Appui 5 à t=3200 (> 3000 ms depuis le premier appui)
      timers.advanceBy(800);
      logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(dispatchedActions).toEqual([]);

      wiring.dispose();
    });

    it('ne déclenche pas si les appuis ont lieu sur un élément autre que [data-logo]', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const button = document.createElement('button');
      button.textContent = 'Autre bouton';
      document.body.appendChild(button);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 60,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      for (let i = 0; i < 5; i++) {
        timers.advanceBy(200);
        button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }

      expect(dispatchedActions).toEqual([]);

      wiring.dispose();
    });
  });

  describe('dispose() retire les écouteurs', () => {
    it('retire les écouteurs pointerdown et keydown du document', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      wiring.dispose();

      expect(removeSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
      );
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeSpy.mockRestore();
    });

    it('n’émet aucune action après dispose() lors d’événements ou de ticks de minuterie', () => {
      const timers = new FakeTimers();
      const dispatchedActions: AppAction[] = [];
      const state = {
        dispatch: (action: AppAction): void => {
          dispatchedActions.push(action);
        },
      };

      const logo = document.createElement('h1');
      logo.setAttribute('data-logo', '');
      document.body.appendChild(logo);

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      wiring.dispose();

      // Événements sur logo
      for (let i = 0; i < 5; i++) {
        logo.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      }
      expect(dispatchedActions).toEqual([]);

      // Événement keydown
      document.dispatchEvent(new Event('keydown', { bubbles: true }));
      expect(dispatchedActions).toEqual([]);

      // Avancement du temps au-delà du délai d'inactivité
      timers.advanceBy(30_000);
      expect(dispatchedActions).toEqual([]);
    });

    it('est idempotent si appelé plusieurs fois', () => {
      const timers = new FakeTimers();
      const state = {
        dispatch: (): void => undefined,
      };

      const wiring = wireInteractions({
        doc: document,
        state,
        idleTimeoutSeconds: 10,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(() => {
        wiring.dispose();
        wiring.dispose();
        wiring.destroy();
      }).not.toThrow();
    });
  });

  describe('validation des options', () => {
    it('lève une RangeError si idleTimeoutSeconds est invalide (<= 0 ou non fini)', () => {
      const state = {
        dispatch: (): void => undefined,
      };

      expect(() =>
        wireInteractions({
          doc: document,
          state,
          idleTimeoutSeconds: 0,
        }),
      ).toThrow(RangeError);

      expect(() =>
        wireInteractions({
          doc: document,
          state,
          idleTimeoutSeconds: -5,
        }),
      ).toThrow(RangeError);

      expect(() =>
        wireInteractions({
          doc: document,
          state,
          idleTimeoutSeconds: Number.POSITIVE_INFINITY,
        }),
      ).toThrow(RangeError);
    });
  });

  describe('intégration complète avec renderHome dans le DOM réel', () => {
    it('déclenche OPEN_MAINTENANCE lors de 5 appuis sur le logo rendu par renderHome', () => {
      const timers = new FakeTimers();
      const root = document.createElement('div');
      root.id = 'app';
      document.body.appendChild(root);

      const store = createAppState({
        manifest: mockManifest,
        screen: 'HOME',
        enrolled: true,
      });

      const model = buildHomeModel(mockManifest, 'fr', null);
      renderHome(
        document,
        root,
        model,
        {
          onSelectTour: (): void => undefined,
          onSelectCategory: (): void => undefined,
          onSelectLang: (): void => undefined,
        },
        'fr',
      );

      const logoEl = root.querySelector('[data-logo]');
      expect(logoEl).toBeInstanceOf(HTMLElement);

      const wiring = wireInteractions({
        doc: document,
        state: store,
        idleTimeoutSeconds: 15,
        now: timers.now,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout,
      });

      expect(store.getState().screen).toBe('HOME');

      if (logoEl instanceof HTMLElement) {
        for (let i = 0; i < 5; i++) {
          timers.advanceBy(200);
          logoEl.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        }
      }

      expect(store.getState().screen).toBe('MAINTENANCE_PIN');

      wiring.dispose();
    });
  });
});
