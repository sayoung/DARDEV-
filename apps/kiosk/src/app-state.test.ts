import { KioskManifestSchema, type KioskManifest } from '@xplor/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  createAppState,
  reduce,
  type AppScreen,
  type AppState,
} from './app-state.js';

function createManifest(overrides: { serviceActive?: boolean } = {}): KioskManifest {
  return KioskManifestSchema.parse({
    manifestVersion: 'v1',
    kiosk: {
      id: '00000000-0000-4000-8000-000000000001',
      label: 'Borne Hall Réception',
      idleTimeoutSeconds: 90,
      deviceType: 'TOUCH_SCREEN',
    },
    hotel: {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Hôtel Rabat Salé',
      logoUrl: null,
      brandColor: '#6958A5',
      languages: ['fr'],
      serviceActive: overrides.serviceActive ?? true,
      maintenancePinHash: null,
    },
    selection: {
      featuredTourId: null,
      attractTourIds: [],
      tours: [],
    },
    categories: [],
  });
}

function createBaseState(overrides: Partial<AppState> = {}): AppState {
  const defaultState: AppState = {
    screen: 'ENROLL',
    manifest: null,
    categoryId: null,
    lang: 'fr',
    tourId: null,
    enrolled: false,
    disabled: false,
  };
  return {
    ...defaultState,
    ...overrides,
  };
}

describe('apps/kiosk/src/app-state', () => {
  describe('reduce', () => {
    describe('MANIFEST_LOADED', () => {
      it('passe de LOADING à HOME avec un manifeste actif et un kiosque enrôlé', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'LOADING',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('HOME');
        expect(nextState.manifest).toBe(manifest);
        expect(nextState.tourId).toBeNull();
      });

      it('reste à HOME si déjà sur HOME lors de la réception du manifeste', () => {
        const initialManifest = createManifest({ serviceActive: true });
        const updatedManifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'HOME',
          manifest: initialManifest,
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest: updatedManifest,
        });

        expect(nextState.screen).toBe('HOME');
        expect(nextState.manifest).toBe(updatedManifest);
      });

      it('bascule vers UNAVAILABLE si le service hôtel devient inactif', () => {
        const activeManifest = createManifest({ serviceActive: true });
        const inactiveManifest = createManifest({ serviceActive: false });
        const initialState = createBaseState({
          screen: 'TOUR',
          manifest: activeManifest,
          tourId: 'tour-123',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest: inactiveManifest,
        });

        expect(nextState.screen).toBe('UNAVAILABLE');
        expect(nextState.manifest).toBe(inactiveManifest);
        expect(nextState.tourId).toBeNull();
      });

      it('maintient l écran TOUR et le tourId si le manifeste reçu reste actif', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'TOUR',
          tourId: 'tour-123',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('TOUR');
        expect(nextState.tourId).toBe('tour-123');
        expect(nextState.manifest).toBe(manifest);
      });

      it('maintient l écran ATTRACT lors de la réception d un nouveau manifeste actif', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'ATTRACT',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('ATTRACT');
        expect(nextState.manifest).toBe(manifest);
      });

      it('maintient l écran MAINTENANCE_PIN lors de la réception d un manifeste actif', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'MAINTENANCE_PIN',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('MAINTENANCE_PIN');
        expect(nextState.manifest).toBe(manifest);
      });

      it('maintient l écran MAINTENANCE lors de la réception d un manifeste actif', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'MAINTENANCE',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('MAINTENANCE');
        expect(nextState.manifest).toBe(manifest);
      });

      it('maintient l écran ENROLL si le kiosque n est pas enrôlé', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'MANIFEST_LOADED',
          manifest,
        });

        expect(nextState.screen).toBe('ENROLL');
        expect(nextState.manifest).toBe(manifest);
      });
    });

    describe('ENROLLED', () => {
      it('marque enrolled à true et bascule vers LOADING si le manifeste est absent', () => {
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
          manifest: null,
        });

        const nextState = reduce(initialState, { type: 'ENROLLED' });

        expect(nextState.enrolled).toBe(true);
        expect(nextState.screen).toBe('LOADING');
      });

      it('marque enrolled à true et bascule vers HOME si le manifeste est déjà présent et actif', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
          manifest,
        });

        const nextState = reduce(initialState, { type: 'ENROLLED' });

        expect(nextState.enrolled).toBe(true);
        expect(nextState.screen).toBe('HOME');
      });

      it('enregistre le manifeste fourni en payload optionnel lors de ENROLLED', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
          manifest: null,
        });

        const nextState = reduce(initialState, {
          type: 'ENROLLED',
          manifest,
        });

        expect(nextState.enrolled).toBe(true);
        expect(nextState.manifest).toBe(manifest);
        expect(nextState.screen).toBe('HOME');
      });

      it('bascule vers UNAVAILABLE lors de ENROLLED si le kiosque est désactivé', () => {
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
          disabled: true,
        });

        const nextState = reduce(initialState, { type: 'ENROLLED' });

        expect(nextState.enrolled).toBe(true);
        expect(nextState.screen).toBe('UNAVAILABLE');
      });
    });

    describe('DISABLED', () => {
      it('marque disabled à true et bascule immédiatement vers UNAVAILABLE', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'TOUR',
          tourId: 'tour-123',
          enrolled: true,
          disabled: false,
          manifest,
        });

        const nextState = reduce(initialState, { type: 'DISABLED' });

        expect(nextState.disabled).toBe(true);
        expect(nextState.screen).toBe('UNAVAILABLE');
        expect(nextState.tourId).toBeNull();
      });

      it('accepte le payload disabled: true explicitement', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          enrolled: true,
          disabled: false,
        });

        const nextState = reduce(initialState, {
          type: 'DISABLED',
          disabled: true,
        });

        expect(nextState.disabled).toBe(true);
        expect(nextState.screen).toBe('UNAVAILABLE');
      });

      it('permet de réactiver le kiosque avec disabled: false et recalcule via resolveScreen', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'UNAVAILABLE',
          enrolled: true,
          disabled: true,
          manifest,
        });

        const nextState = reduce(initialState, {
          type: 'DISABLED',
          disabled: false,
        });

        expect(nextState.disabled).toBe(false);
        expect(nextState.screen).toBe('HOME');
      });
    });

    describe('SELECT_TOUR', () => {
      it('met à jour tourId et bascule sur l écran TOUR', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          tourId: null,
          enrolled: true,
        });

        const nextState = reduce(initialState, {
          type: 'SELECT_TOUR',
          tourId: 'tour-oudayas',
        });

        expect(nextState.screen).toBe('TOUR');
        expect(nextState.tourId).toBe('tour-oudayas');
      });
    });

    describe('SELECT_CATEGORY', () => {
      it('met à jour categoryId avec un identifiant de catégorie', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          categoryId: null,
        });

        const nextState = reduce(initialState, {
          type: 'SELECT_CATEGORY',
          categoryId: 'cat-patrimoine',
        });

        expect(nextState.categoryId).toBe('cat-patrimoine');
        expect(nextState.screen).toBe('HOME');
      });

      it('réinitialise categoryId à null pour afficher toutes les catégories', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          categoryId: 'cat-patrimoine',
        });

        const nextState = reduce(initialState, {
          type: 'SELECT_CATEGORY',
          categoryId: null,
        });

        expect(nextState.categoryId).toBeNull();
      });
    });

    describe('SELECT_LANG', () => {
      it('met à jour la langue de l application', () => {
        const initialState = createBaseState({ lang: 'fr' });

        const arState = reduce(initialState, {
          type: 'SELECT_LANG',
          lang: 'ar',
        });
        expect(arState.lang).toBe('ar');

        const enState = reduce(arState, {
          type: 'SELECT_LANG',
          lang: 'en',
        });
        expect(enState.lang).toBe('en');
      });
    });

    describe('IDLE', () => {
      it('bascule vers ATTRACT depuis HOME et efface tourId', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          tourId: null,
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState.screen).toBe('ATTRACT');
        expect(nextState.tourId).toBeNull();
      });

      it('bascule vers ATTRACT depuis TOUR et réinitialise tourId', () => {
        const initialState = createBaseState({
          screen: 'TOUR',
          tourId: 'tour-123',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState.screen).toBe('ATTRACT');
        expect(nextState.tourId).toBeNull();
      });

      it('ignore IDLE si l écran courant est MAINTENANCE', () => {
        const initialState = createBaseState({
          screen: 'MAINTENANCE',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState.screen).toBe('MAINTENANCE');
      });

      it('ignore IDLE si l écran courant est MAINTENANCE_PIN', () => {
        const initialState = createBaseState({
          screen: 'MAINTENANCE_PIN',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState.screen).toBe('MAINTENANCE_PIN');
      });

      it('ignore IDLE si l écran courant est UNAVAILABLE', () => {
        const initialState = createBaseState({
          screen: 'UNAVAILABLE',
          disabled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState).toBe(initialState);
        expect(nextState.screen).toBe('UNAVAILABLE');
      });

      it('ignore IDLE si l écran courant est ENROLL', () => {
        const initialState = createBaseState({
          screen: 'ENROLL',
          enrolled: false,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState).toBe(initialState);
        expect(nextState.screen).toBe('ENROLL');
      });

      it('ignore IDLE si l écran courant est LOADING', () => {
        const initialState = createBaseState({
          screen: 'LOADING',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'IDLE' });

        expect(nextState).toBe(initialState);
        expect(nextState.screen).toBe('LOADING');
      });
    });

    describe('WAKE', () => {
      it('réveille le kiosque depuis ATTRACT vers HOME en réutilisant resolveScreen', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'ATTRACT',
          enrolled: true,
          disabled: false,
          manifest,
          tourId: null,
        });

        const nextState = reduce(initialState, { type: 'WAKE' });

        expect(nextState.screen).toBe('HOME');
        expect(nextState.tourId).toBeNull();
      });

      it('bascule vers UNAVAILABLE lors de WAKE si le service est désactivé', () => {
        const manifest = createManifest({ serviceActive: false });
        const initialState = createBaseState({
          screen: 'ATTRACT',
          enrolled: true,
          disabled: false,
          manifest,
        });

        const nextState = reduce(initialState, { type: 'WAKE' });

        expect(nextState.screen).toBe('UNAVAILABLE');
      });
    });

    describe('OPEN_MAINTENANCE', () => {
      it('bascule vers l écran de saisie du PIN de maintenance depuis HOME', () => {
        const initialState = createBaseState({
          screen: 'HOME',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'OPEN_MAINTENANCE' });

        expect(nextState.screen).toBe('MAINTENANCE_PIN');
      });

      it('bascule vers l écran de saisie du PIN de maintenance depuis ATTRACT', () => {
        const initialState = createBaseState({
          screen: 'ATTRACT',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'OPEN_MAINTENANCE' });

        expect(nextState.screen).toBe('MAINTENANCE_PIN');
      });

      it('ignore OPEN_MAINTENANCE si l écran courant n est ni HOME ni ATTRACT', () => {
        const disallowedScreens: AppScreen[] = [
          'LOADING',
          'ENROLL',
          'UNAVAILABLE',
          'MAINTENANCE',
          'MAINTENANCE_PIN',
          'TOUR',
        ];

        for (const screen of disallowedScreens) {
          const initialState = createBaseState({
            screen,
            enrolled: true,
          });

          const nextState = reduce(initialState, { type: 'OPEN_MAINTENANCE' });

          expect(nextState).toBe(initialState);
          expect(nextState.screen).toBe(screen);
        }
      });
    });

    describe('UNLOCK', () => {
      it('déverrouille l écran technique de maintenance depuis MAINTENANCE_PIN', () => {
        const initialState = createBaseState({
          screen: 'MAINTENANCE_PIN',
          enrolled: true,
        });

        const nextState = reduce(initialState, { type: 'UNLOCK' });

        expect(nextState.screen).toBe('MAINTENANCE');
      });

      it('ignore UNLOCK si l écran courant n est pas MAINTENANCE_PIN', () => {
        const invalidScreens: AppScreen[] = [
          'HOME',
          'ATTRACT',
          'TOUR',
          'LOADING',
          'ENROLL',
          'UNAVAILABLE',
          'MAINTENANCE',
        ];

        for (const screen of invalidScreens) {
          const initialState = createBaseState({
            screen,
            enrolled: true,
          });

          const nextState = reduce(initialState, { type: 'UNLOCK' });

          expect(nextState).toBe(initialState);
          expect(nextState.screen).toBe(screen);
        }
      });
    });

    describe('CLOSE_MAINTENANCE', () => {
      it('ferme la maintenance et revient vers l écran de base HOME via resolveScreen', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'MAINTENANCE',
          enrolled: true,
          disabled: false,
          manifest,
          tourId: null,
        });

        const nextState = reduce(initialState, { type: 'CLOSE_MAINTENANCE' });

        expect(nextState.screen).toBe('HOME');
        expect(nextState.tourId).toBeNull();
      });

      it('ferme la saisie PIN et revient vers l écran de base', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'MAINTENANCE_PIN',
          enrolled: true,
          disabled: false,
          manifest,
        });

        const nextState = reduce(initialState, { type: 'CLOSE_MAINTENANCE' });

        expect(nextState.screen).toBe('HOME');
      });
    });

    describe('BACK_HOME', () => {
      it('quitte une visite pour revenir vers HOME en préservant la catégorie et la langue', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = createBaseState({
          screen: 'TOUR',
          tourId: 'tour-123',
          categoryId: 'cat-nature',
          lang: 'ar',
          enrolled: true,
          disabled: false,
          manifest,
        });

        const nextState = reduce(initialState, { type: 'BACK_HOME' });

        expect(nextState.screen).toBe('HOME');
        expect(nextState.tourId).toBeNull();
        expect(nextState.categoryId).toBe('cat-nature');
        expect(nextState.lang).toBe('ar');
      });
    });

    describe('immuabilité', () => {
      it('ne modifie pas l objet d état initial passé en paramètre', () => {
        const manifest = createManifest({ serviceActive: true });
        const initialState = Object.freeze(
          createBaseState({
            screen: 'HOME',
            enrolled: true,
            manifest,
          }),
        );

        const nextState = reduce(initialState, {
          type: 'SELECT_TOUR',
          tourId: 'tour-new',
        });

        expect(nextState).not.toBe(initialState);
        expect(initialState.screen).toBe('HOME');
        expect(initialState.tourId).toBeNull();
      });
    });
  });

  describe('createAppState', () => {
    it('initialise le store avec des options par défaut (ENROLL, fr)', () => {
      const store = createAppState();
      const state = store.getState();

      expect(state.screen).toBe('ENROLL');
      expect(state.lang).toBe('fr');
      expect(state.manifest).toBeNull();
      expect(state.categoryId).toBeNull();
      expect(state.tourId).toBeNull();
      expect(state.enrolled).toBe(false);
      expect(state.disabled).toBe(false);
    });

    it('initialise le store avec les options fournies', () => {
      const manifest = createManifest({ serviceActive: true });
      const store = createAppState({
        lang: 'en',
        enrolled: true,
        manifest,
        categoryId: 'cat-1',
      });
      const state = store.getState();

      expect(state.screen).toBe('HOME');
      expect(state.lang).toBe('en');
      expect(state.manifest).toBe(manifest);
      expect(state.categoryId).toBe('cat-1');
      expect(state.enrolled).toBe(true);
    });

    it('permet de forcer l écran initial si spécifié', () => {
      const store = createAppState({
        screen: 'LOADING',
      });

      expect(store.getState().screen).toBe('LOADING');
    });

    it('met à jour l état via dispatch', () => {
      const store = createAppState({ lang: 'fr' });

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'ar',
      });

      expect(store.getState().lang).toBe('ar');
    });

    it('notifie les abonnés lors d un dispatch avec le nouvel état', () => {
      const store = createAppState({ lang: 'fr' });
      const listener = vi.fn();

      store.subscribe(listener);

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'ar',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'ar',
        }),
      );
    });

    it('notifie plusieurs abonnés dans l ordre d enregistrement', () => {
      const store = createAppState({ lang: 'fr' });
      const events: string[] = [];

      store.subscribe(() => {
        events.push('first');
      });
      store.subscribe(() => {
        events.push('second');
      });

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'en',
      });

      expect(events).toEqual(['first', 'second']);
    });

    it('arrête de notifier un abonné après désabonnement', () => {
      const store = createAppState({ lang: 'fr' });
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'ar',
      });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'en',
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('est idempotent lors d appels multiples à unsubscribe', () => {
      const store = createAppState({ lang: 'fr' });
      const listener = vi.fn();

      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      expect(() => {
        unsubscribe();
      }).not.toThrow();

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'en',
      });
      expect(listener).not.toHaveBeenCalled();
    });

    it('permet à un abonné de se désabonner pendant la notification sans provoquer d erreur', () => {
      const store = createAppState({ lang: 'fr' });
      let unsubscribeFirst: () => void = () => undefined;
      const firstCalls: number[] = [];
      const secondCalls: number[] = [];

      unsubscribeFirst = store.subscribe(() => {
        firstCalls.push(1);
        unsubscribeFirst();
      });

      store.subscribe(() => {
        secondCalls.push(2);
      });

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'ar',
      });

      expect(firstCalls).toHaveLength(1);
      expect(secondCalls).toHaveLength(1);

      store.dispatch({
        type: 'SELECT_LANG',
        lang: 'en',
      });

      expect(firstCalls).toHaveLength(1);
      expect(secondCalls).toHaveLength(2);
    });
  });
});
