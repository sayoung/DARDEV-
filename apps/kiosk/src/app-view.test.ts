import { resources } from '@xplor/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAppState,
  type AppScreen,
  type AppState,
  type AppStore,
} from './app-state.js';
import { createAppView } from './app-view.js';

interface FakeStore extends AppStore {
  setState(next: AppState): void;
}

function createFakeState(overrides: Partial<AppState> = {}): AppState {
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

function createFakeStore(initialState: AppState): FakeStore {
  let currentState = initialState;
  const listeners = new Set<(state: AppState) => void>();

  return {
    getState(): AppState {
      return currentState;
    },
    subscribe(listener: (state: AppState) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(): void {
      // Les tests unitaires du fake store pilotent les transitions directement via setState
    },
    setState(next: AppState): void {
      currentState = next;
      for (const listener of Array.from(listeners)) {
        listener(currentState);
      }
    },
  };
}

describe('apps/kiosk/src/app-view (F-60 / F-61)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  describe('Rendu initial des écrans gérés', () => {
    it('rend l’écran ENROLL avec son formulaire, libellés et gestionnaire onEnroll', async () => {
      const onEnroll = vi.fn().mockImplementation(() => Promise.resolve());
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
        deps: { onEnroll },
      });

      expect(root.classList.contains('kiosk-screen-enroll')).toBe(true);

      const title = root.querySelector('.kiosk-enroll-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.fr.kiosk.enroll.title);
      }

      const label = root.querySelector('.kiosk-enroll-label');
      expect(label).toBeInstanceOf(HTMLLabelElement);
      if (label instanceof HTMLLabelElement) {
        expect(label.textContent).toBe(resources.fr.kiosk.enroll.codeLabel);
      }

      const input = root.querySelector('.kiosk-enroll-input');
      expect(input).toBeInstanceOf(HTMLInputElement);

      const submitBtn = root.querySelector('.kiosk-enroll-btn');
      expect(submitBtn).toBeInstanceOf(HTMLButtonElement);

      if (input instanceof HTMLInputElement && submitBtn instanceof HTMLButtonElement) {
        const promise = Promise.resolve();
        onEnroll.mockReturnValue(promise);

        input.value = 'ABCDEF12';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const form = root.querySelector('form');
        expect(form).toBeInstanceOf(HTMLFormElement);
        if (form instanceof HTMLFormElement) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }

        expect(onEnroll).toHaveBeenCalledTimes(1);
        expect(onEnroll).toHaveBeenCalledWith('ABCDEF12');
        expect(submitBtn.disabled).toBe(true);

        await promise;
        await Promise.resolve();
        expect(submitBtn.disabled).toBe(false);
      }

      view.dispose();
    });

    it('gère les erreurs de validation du code sur l’écran ENROLL sans appeler onEnroll', () => {
      const onEnroll = vi.fn();
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
        deps: { onEnroll },
      });

      const input = root.querySelector('.kiosk-enroll-input');
      expect(input).toBeInstanceOf(HTMLInputElement);

      if (input instanceof HTMLInputElement) {
        input.value = 'TROPCOURT';
        input.value = 'ABC';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const form = root.querySelector('form');
        expect(form).toBeInstanceOf(HTMLFormElement);
        if (form instanceof HTMLFormElement) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }

        expect(onEnroll).not.toHaveBeenCalled();

        const errorDiv = root.querySelector('.kiosk-enroll-error');
        expect(errorDiv).toBeInstanceOf(HTMLDivElement);
        if (errorDiv instanceof HTMLDivElement) {
          expect(errorDiv.hidden).toBe(false);
          expect(errorDiv.textContent).toBe(resources.fr.kiosk.enroll.invalidCode);
        }
      }

      view.dispose();
    });

    it('rend l’écran LOADING avec indicateur textuel et attributs ARIA status', () => {
      const fakeState = createFakeState({ screen: 'LOADING', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);

      const statusContainer = root.querySelector('.kiosk-status-container');
      expect(statusContainer).toBeInstanceOf(HTMLElement);
      if (statusContainer instanceof HTMLElement) {
        expect(statusContainer.getAttribute('role')).toBe('status');
        expect(statusContainer.getAttribute('aria-live')).toBe('polite');
      }

      const text = root.querySelector('.kiosk-loading-text');
      expect(text).toBeInstanceOf(HTMLParagraphElement);
      if (text instanceof HTMLParagraphElement) {
        expect(text.textContent).toBe(resources.fr.kiosk.loading);
      }

      view.dispose();
    });

    it('rend l’écran UNAVAILABLE avec message neutre et attributs ARIA status', () => {
      const fakeState = createFakeState({ screen: 'UNAVAILABLE', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(true);

      const statusContainer = root.querySelector('.kiosk-status-container');
      expect(statusContainer).toBeInstanceOf(HTMLElement);
      if (statusContainer instanceof HTMLElement) {
        expect(statusContainer.getAttribute('role')).toBe('status');
        expect(statusContainer.getAttribute('aria-live')).toBe('polite');
      }

      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.fr.kiosk.unavailable);
      }

      view.dispose();
    });
  });

  describe('Support multilingue (fr, ar, en)', () => {
    it('applique la direction RTL et les libellés en arabe pour LOADING et UNAVAILABLE', () => {
      const fakeState = createFakeState({ screen: 'LOADING', lang: 'ar' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('dir')).toBe('rtl');

      const loadingText = root.querySelector('.kiosk-loading-text');
      expect(loadingText).toBeInstanceOf(HTMLParagraphElement);
      if (loadingText instanceof HTMLParagraphElement) {
        expect(loadingText.textContent).toBe(resources.ar.kiosk.loading);
      }

      store.setState(createFakeState({ screen: 'UNAVAILABLE', lang: 'ar' }));

      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(true);
      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.ar.kiosk.unavailable);
      }

      view.dispose();
    });

    it('applique la direction LTR et les libellés en anglais pour ENROLL', () => {
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'en' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('dir')).toBe('ltr');

      const title = root.querySelector('.kiosk-enroll-title');
      expect(title).toBeInstanceOf(HTMLHeadingElement);
      if (title instanceof HTMLHeadingElement) {
        expect(title.textContent).toBe(resources.en.kiosk.enroll.title);
      }

      view.dispose();
    });
  });

  describe('Repli sûr pour les autres écrans', () => {
    const screensNotHandledInStepOne: AppScreen[] = [
      'HOME',
      'ATTRACT',
      'MAINTENANCE_PIN',
      'MAINTENANCE',
      'TOUR',
    ];

    it.each(screensNotHandledInStepOne)(
      'vide root pour l’écran non encore branché %s',
      (screen) => {
        // Préremplissage de root pour vérifier que le conteneur est bien vidé
        const dummyChild = document.createElement('div');
        dummyChild.className = 'dummy-child';
        root.appendChild(dummyChild);

        const fakeState = createFakeState({ screen, lang: 'fr' });
        const store = createFakeStore(fakeState);

        const view = createAppView({
          doc: document,
          root,
          state: store,
        });

        expect(root.children.length).toBe(0);
        expect(root.textContent).toBe('');
        expect(root.className).toBe('');

        view.dispose();
      },
    );
  });

  describe('Transitions réactives et nettoyage entre écrans', () => {
    it('vide root et actualise l’affichage à chaque changement d’état', () => {
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-enroll')).toBe(true);
      expect(root.querySelector('.kiosk-enroll-card')).toBeInstanceOf(HTMLDivElement);

      // Transition vers LOADING
      store.setState(createFakeState({ screen: 'LOADING', lang: 'fr' }));

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);
      expect(root.querySelector('.kiosk-enroll-card')).toBeNull();
      expect(root.querySelector('.kiosk-loading-text')).toBeInstanceOf(HTMLParagraphElement);

      // Transition vers UNAVAILABLE
      store.setState(createFakeState({ screen: 'UNAVAILABLE', lang: 'fr' }));

      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(true);
      expect(root.querySelector('.kiosk-loading-text')).toBeNull();
      expect(root.querySelector('.kiosk-unavailable-message')).toBeInstanceOf(HTMLParagraphElement);

      // Transition vers un écran repli (ex: HOME)
      store.setState(createFakeState({ screen: 'HOME', lang: 'fr' }));

      expect(root.children.length).toBe(0);
      expect(root.className).toBe('');

      view.dispose();
    });
  });

  describe('Désabonnement via dispose() et destroy()', () => {
    it('arrête les mises à jour du DOM lorsque dispose() est appelé', () => {
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-enroll')).toBe(true);

      // Résiliation de l'abonnement
      view.dispose();

      // Émission d'un nouvel état vers LOADING
      store.setState(createFakeState({ screen: 'LOADING', lang: 'fr' }));

      // Root ne doit PAS avoir été actualisé vers LOADING, il conserve l'état d'avant dispose
      expect(root.classList.contains('kiosk-screen-enroll')).toBe(true);
      expect(root.classList.contains('kiosk-screen-loading')).toBe(false);
      expect(root.querySelector('.kiosk-loading-text')).toBeNull();
    });

    it('permet également d’utiliser destroy() comme équivalent de dispose()', () => {
      const fakeState = createFakeState({ screen: 'LOADING', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);

      view.destroy();

      store.setState(createFakeState({ screen: 'UNAVAILABLE', lang: 'fr' }));

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);
      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(false);
    });

    it('permet d’appeler dispose() plusieurs fois sans erreur', () => {
      const fakeState = createFakeState({ screen: 'ENROLL', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(() => {
        view.dispose();
        view.dispose();
        view.destroy();
      }).not.toThrow();
    });
  });

  describe('Intégration avec createAppState réel', () => {
    it('réagit aux actions dispatchées sur le store réel', () => {
      const store = createAppState({
        screen: 'LOADING',
        enrolled: false,
        disabled: false,
      });

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen-loading')).toBe(true);

      // Quand l'action DISABLED est dispatchée, resolveScreen bascule vers UNAVAILABLE
      store.dispatch({ type: 'DISABLED', disabled: true });

      expect(root.classList.contains('kiosk-screen-unavailable')).toBe(true);
      const message = root.querySelector('.kiosk-unavailable-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);

      view.dispose();
    });
  });
});
