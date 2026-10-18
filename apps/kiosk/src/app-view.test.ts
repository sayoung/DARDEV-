import { resources } from '@xplor/i18n';
import {
  KioskManifestSchema,
  type KioskManifest,
  type KioskManifestCategory,
  type KioskManifestTour,
} from '@xplor/shared';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
  createAppState,
  type AppAction,
  type AppScreen,
  type AppState,
  type AppStore,
} from './app-state.js';
import { createAppView } from './app-view.js';

const testCategoryMonuments: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000010',
  name: { fr: 'Monuments', ar: 'معالم', en: 'Monuments' },
  icon: 'landmark',
  color: '#1F6F8B',
};

const testCategoryMuseums: KioskManifestCategory = {
  id: '01990000-0000-7000-8000-000000000020',
  name: { fr: 'Musées', ar: 'متاحف', en: 'Museums' },
  icon: 'museum',
  color: '#8A5A2B',
};

const testTourOudayas: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000100',
  contentVersion: 1,
  sizeBytes: 150000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000100',
  categoryId: testCategoryMonuments.id,
};

const testTourHassan: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000200',
  contentVersion: 2,
  sizeBytes: 180000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000200',
  categoryId: testCategoryMuseums.id,
};

function createTestManifest(overrides?: {
  featuredTourId?: string | null;
  tours?: KioskManifestTour[];
  categories?: KioskManifestCategory[];
}): KioskManifest {
  const rawManifest = {
    manifestVersion: 'm-20261018-01',
    kiosk: {
      id: '01990000-0000-7000-8000-000000000001',
      label: 'Borne Hall Principal',
      idleTimeoutSeconds: 90,
      deviceType: 'TOUCH_SCREEN',
    },
    hotel: {
      id: '01990000-0000-7000-8000-000000000002',
      name: 'Hôtel La Tour Hassan Palace',
      logoUrl: 'https://media.xplor.ma/hotels/tour-hassan.png',
      brandColor: '#6958A5',
      languages: ['fr', 'ar', 'en'],
      serviceActive: true,
      maintenancePinHash: null,
    },
    selection: {
      featuredTourId:
        overrides?.featuredTourId !== undefined
          ? overrides.featuredTourId
          : testTourOudayas.id,
      attractTourIds: [testTourOudayas.id, testTourHassan.id],
      tours: overrides?.tours ?? [testTourOudayas, testTourHassan],
    },
    categories: overrides?.categories ?? [testCategoryMonuments, testCategoryMuseums],
  };

  return KioskManifestSchema.parse(rawManifest);
}

interface FakeStore extends AppStore {
  setState(next: AppState): void;
  dispatch: Mock<(action: AppAction) => void>;
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

function createFakeStore(
  initialState: AppState,
  onDispatch?: (action: AppAction) => void,
): FakeStore {
  let currentState = initialState;
  const listeners = new Set<(state: AppState) => void>();

  const dispatch = vi.fn((action: AppAction): void => {
    onDispatch?.(action);
  });

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
    dispatch,
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

    it('rend l’écran HOME avec sa structure complète (en-tête, navigation de catégories, visites)', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-home')).toBe(true);
      expect(root.style.getPropertyValue('--brand-color')).toBe(manifest.hotel.brandColor);

      const hotelName = root.querySelector('.kiosk-hotel-name');
      expect(hotelName).toBeInstanceOf(HTMLHeadingElement);
      if (hotelName instanceof HTMLHeadingElement) {
        expect(hotelName.textContent).toBe(manifest.hotel.name);
      }

      const categoryNav = root.querySelector('.kiosk-category-nav');
      expect(categoryNav).toBeInstanceOf(HTMLElement);

      const toursGrid = root.querySelector('.kiosk-tours-grid');
      expect(toursGrid).toBeInstanceOf(HTMLUListElement);

      const featuredSection = root.querySelector('.kiosk-featured-section');
      expect(featuredSection).toBeInstanceOf(HTMLElement);

      view.dispose();
    });

    it('rend l’écran ATTRACT avec le message invitant au toucher et le conteneur d’aperçu', () => {
      const fakeState = createFakeState({ screen: 'ATTRACT', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-screen')).toBe(true);
      expect(root.classList.contains('kiosk-screen-attract')).toBe(true);
      expect(root.getAttribute('role')).toBe('region');
      expect(root.getAttribute('tabindex')).toBe('0');
      expect(root.getAttribute('aria-label')).toBe(resources.fr.kiosk.touchToExplore);

      const message = root.querySelector('.kiosk-attract-message');
      expect(message).toBeInstanceOf(HTMLParagraphElement);
      if (message instanceof HTMLParagraphElement) {
        expect(message.textContent).toBe(resources.fr.kiosk.touchToExplore);
      }

      const preview = root.querySelector('[data-testid="kiosk-attract-preview"]');
      expect(preview).toBeInstanceOf(HTMLDivElement);

      view.dispose();
    });
  });

  describe('Écran HOME (F-61) et interactions de sélection', () => {
    it('un clic sur une visite de la grille dispatche SELECT_TOUR avec le bon tourId', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const tourBtn = root.querySelector(
        `.kiosk-tour-card[data-tour-id="${testTourOudayas.id}"]`,
      );
      expect(tourBtn).toBeInstanceOf(HTMLButtonElement);
      if (tourBtn instanceof HTMLButtonElement) {
        tourBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
          type: 'SELECT_TOUR',
          tourId: testTourOudayas.id,
        });
      }

      view.dispose();
    });

    it('un clic sur la visite mise en avant dispatche SELECT_TOUR avec le bon tourId', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const featuredBtn = root.querySelector('[data-testid="featured-tour-button"]');
      expect(featuredBtn).toBeInstanceOf(HTMLButtonElement);
      if (featuredBtn instanceof HTMLButtonElement) {
        featuredBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
          type: 'SELECT_TOUR',
          tourId: testTourOudayas.id,
        });
      }

      view.dispose();
    });

    it('un clic sur un filtre de catégorie dispatche SELECT_CATEGORY avec son identifiant', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const catBtn = root.querySelector(
        `.kiosk-category-btn[data-category-id="${testCategoryMuseums.id}"]`,
      );
      expect(catBtn).toBeInstanceOf(HTMLButtonElement);
      if (catBtn instanceof HTMLButtonElement) {
        catBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
          type: 'SELECT_CATEGORY',
          categoryId: testCategoryMuseums.id,
        });
      }

      view.dispose();
    });

    it('un clic sur la catégorie "Toutes" dispatche SELECT_CATEGORY avec null', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({
        screen: 'HOME',
        manifest,
        lang: 'fr',
        categoryId: testCategoryMuseums.id,
      });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const allBtn = root.querySelector('.kiosk-category-btn[data-category-id="all"]');
      expect(allBtn).toBeInstanceOf(HTMLButtonElement);
      if (allBtn instanceof HTMLButtonElement) {
        allBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
          type: 'SELECT_CATEGORY',
          categoryId: null,
        });
      }

      view.dispose();
    });

    it('un clic sur un sélecteur de langue dispatche SELECT_LANG avec la langue choisie', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const langBtn = root.querySelector('.kiosk-lang-btn[data-lang="ar"]');
      expect(langBtn).toBeInstanceOf(HTMLButtonElement);
      if (langBtn instanceof HTMLButtonElement) {
        langBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({
          type: 'SELECT_LANG',
          lang: 'ar',
        });
      }

      view.dispose();
    });

    it('vide le conteneur root si le manifeste est absent sur l’écran HOME (repli sûr)', () => {
      const dummyChild = document.createElement('div');
      dummyChild.className = 'dummy-child';
      root.appendChild(dummyChild);

      const fakeState = createFakeState({ screen: 'HOME', manifest: null, lang: 'fr' });
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
    });
  });

  describe('Écran ATTRACT (F-63) et interactions de réveil', () => {
    it('un clic sur l’écran ATTRACT dispatche WAKE', () => {
      const fakeState = createFakeState({ screen: 'ATTRACT', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(store.dispatch).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith({ type: 'WAKE' });

      view.dispose();
    });

    it('un toucher (pointerdown) sur l’overlay de veille dispatche WAKE', () => {
      const fakeState = createFakeState({ screen: 'ATTRACT', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const overlay = root.querySelector('.kiosk-attract-overlay');
      expect(overlay).toBeInstanceOf(HTMLDivElement);
      if (overlay instanceof HTMLDivElement) {
        overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith({ type: 'WAKE' });
      }

      view.dispose();
    });

    it('un appui clavier accessible (Entrée ou Espace) sur l’écran ATTRACT dispatche WAKE', () => {
      const fakeState = createFakeState({ screen: 'ATTRACT', lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(store.dispatch).toHaveBeenCalledTimes(1);
      expect(store.dispatch).toHaveBeenCalledWith({ type: 'WAKE' });

      view.dispose();
    });

    it('transmet l’URL de visite fournie par deps.getAttractTourUrl à l’écran ATTRACT', () => {
      const fakeState = createFakeState({ screen: 'ATTRACT', lang: 'fr' });
      const store = createFakeStore(fakeState);
      const getAttractTourUrl = vi.fn().mockReturnValue('/api/v1/tours/attract-preview-1');

      const view = createAppView({
        doc: document,
        root,
        state: store,
        deps: { getAttractTourUrl },
      });

      expect(getAttractTourUrl).toHaveBeenCalledTimes(1);
      const preview = root.querySelector('[data-testid="kiosk-attract-preview"]');
      expect(preview).toBeInstanceOf(HTMLDivElement);
      if (preview instanceof HTMLDivElement) {
        expect(preview.getAttribute('data-tour-url')).toBe('/api/v1/tours/attract-preview-1');
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

    it('applique la direction RTL et les libellés traduits en arabe pour HOME et ATTRACT', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'ar' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('dir')).toBe('rtl');

      const allCatBtn = root.querySelector('.kiosk-category-btn[data-category-id="all"]');
      expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
      if (allCatBtn instanceof HTMLButtonElement) {
        expect(allCatBtn.textContent).toBe(resources.ar.kiosk.home.allCategories);
      }

      store.setState(createFakeState({ screen: 'ATTRACT', manifest, lang: 'ar' }));

      expect(root.getAttribute('dir')).toBe('rtl');
      const attractMessage = root.querySelector('.kiosk-attract-message');
      expect(attractMessage).toBeInstanceOf(HTMLParagraphElement);
      if (attractMessage instanceof HTMLParagraphElement) {
        expect(attractMessage.textContent).toBe(resources.ar.kiosk.touchToExplore);
      }

      view.dispose();
    });

    it('applique la direction LTR et les libellés traduits en anglais pour HOME et ATTRACT', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'en' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(root.getAttribute('dir')).toBe('ltr');

      const allCatBtn = root.querySelector('.kiosk-category-btn[data-category-id="all"]');
      expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
      if (allCatBtn instanceof HTMLButtonElement) {
        expect(allCatBtn.textContent).toBe(resources.en.kiosk.home.allCategories);
      }

      store.setState(createFakeState({ screen: 'ATTRACT', manifest, lang: 'en' }));

      expect(root.getAttribute('dir')).toBe('ltr');
      const attractMessage = root.querySelector('.kiosk-attract-message');
      expect(attractMessage).toBeInstanceOf(HTMLParagraphElement);
      if (attractMessage instanceof HTMLParagraphElement) {
        expect(attractMessage.textContent).toBe(resources.en.kiosk.touchToExplore);
      }

      view.dispose();
    });
  });

  describe('Repli sûr pour les autres écrans', () => {
    const screensNotHandledInStepTwo: AppScreen[] = [
      'MAINTENANCE_PIN',
      'MAINTENANCE',
      'TOUR',
    ];

    it.each(screensNotHandledInStepTwo)(
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

      // Transition vers un écran non branché (ex: TOUR)
      store.setState(createFakeState({ screen: 'TOUR', lang: 'fr' }));

      expect(root.children.length).toBe(0);
      expect(root.className).toBe('');

      view.dispose();
    });

    it('transitionne de manière fluide entre HOME et ATTRACT avec mise à jour du DOM', () => {
      const manifest = createTestManifest();
      const fakeState = createFakeState({ screen: 'HOME', manifest, lang: 'fr' });
      const store = createFakeStore(fakeState);

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(root.classList.contains('kiosk-home')).toBe(true);
      expect(root.querySelector('.kiosk-hotel-name')).toBeInstanceOf(HTMLHeadingElement);

      // Transition vers ATTRACT
      store.setState(createFakeState({ screen: 'ATTRACT', manifest, lang: 'fr' }));

      expect(root.classList.contains('kiosk-screen-attract')).toBe(true);
      expect(root.querySelector('.kiosk-hotel-name')).toBeNull();
      expect(root.querySelector('.kiosk-attract-message')).toBeInstanceOf(HTMLParagraphElement);

      // Transition de retour vers HOME
      store.setState(createFakeState({ screen: 'HOME', manifest, lang: 'fr' }));

      expect(root.classList.contains('kiosk-home')).toBe(true);
      expect(root.querySelector('.kiosk-attract-message')).toBeNull();
      expect(root.querySelector('.kiosk-hotel-name')).toBeInstanceOf(HTMLHeadingElement);

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

    it('sélection d’une visite depuis HOME transite vers l’écran TOUR avec le tourId sur le store réel', () => {
      const manifest = createTestManifest();
      const store = createAppState({
        screen: 'HOME',
        manifest,
        enrolled: true,
        disabled: false,
      });

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(store.getState().screen).toBe('HOME');
      expect(root.classList.contains('kiosk-home')).toBe(true);

      const tourBtn = root.querySelector(
        `.kiosk-tour-card[data-tour-id="${testTourOudayas.id}"]`,
      );
      expect(tourBtn).toBeInstanceOf(HTMLButtonElement);
      if (tourBtn instanceof HTMLButtonElement) {
        tourBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      expect(store.getState().screen).toBe('TOUR');
      expect(store.getState().tourId).toBe(testTourOudayas.id);

      view.dispose();
    });

    it('réveil depuis ATTRACT transite vers l’écran HOME sur le store réel', () => {
      const manifest = createTestManifest();
      const store = createAppState({
        screen: 'ATTRACT',
        manifest,
        enrolled: true,
        disabled: false,
      });

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      expect(store.getState().screen).toBe('ATTRACT');
      expect(root.classList.contains('kiosk-screen-attract')).toBe(true);

      root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(store.getState().screen).toBe('HOME');
      expect(root.classList.contains('kiosk-home')).toBe(true);

      view.dispose();
    });

    it('sélection de catégorie et de langue depuis HOME met à jour le store réel et l’affichage', () => {
      const manifest = createTestManifest();
      const store = createAppState({
        screen: 'HOME',
        manifest,
        enrolled: true,
        disabled: false,
        lang: 'fr',
      });

      const view = createAppView({
        doc: document,
        root,
        state: store,
      });

      const catBtn = root.querySelector(
        `.kiosk-category-btn[data-category-id="${testCategoryMuseums.id}"]`,
      );
      expect(catBtn).toBeInstanceOf(HTMLButtonElement);
      if (catBtn instanceof HTMLButtonElement) {
        catBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      expect(store.getState().categoryId).toBe(testCategoryMuseums.id);

      const langBtn = root.querySelector('.kiosk-lang-btn[data-lang="ar"]');
      expect(langBtn).toBeInstanceOf(HTMLButtonElement);
      if (langBtn instanceof HTMLButtonElement) {
        langBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      expect(store.getState().lang).toBe('ar');
      expect(root.getAttribute('dir')).toBe('rtl');
      expect(root.getAttribute('lang')).toBe('ar');

      view.dispose();
    });
  });
});
