import { resources } from '@xplor/i18n';
import type { KioskManifestTour } from '@xplor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HomeModel } from './home-model.js';
import { renderHome } from './render-home.js';

const tourMonuments: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000100',
  contentVersion: 1,
  sizeBytes: 150000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000100',
  categoryId: '01990000-0000-7000-8000-000000000010',
};

const tourMuseum: KioskManifestTour = {
  id: '01990000-0000-7000-8000-000000000200',
  contentVersion: 2,
  sizeBytes: 120000000,
  url: '/api/v1/tours/01990000-0000-7000-8000-000000000200',
  categoryId: '01990000-0000-7000-8000-000000000020',
};

function createMockModel(overrides?: Partial<HomeModel>): HomeModel {
  return {
    hotelName: 'Hôtel La Tour Hassan Palace',
    brandColor: '#6958A5',
    featured: tourMonuments,
    categories: [
      { id: '01990000-0000-7000-8000-000000000010', label: 'Monuments' },
      { id: '01990000-0000-7000-8000-000000000020', label: 'Musées' },
    ],
    tours: [tourMonuments, tourMuseum],
    selectedCategoryId: null,
    ...overrides,
  };
}

describe('renderHome', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  });

  it('rend l’accueil complet en français (nom hôtel, variable CSS, ltr, langue, featured, catégories, visites)', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(root.getAttribute('lang')).toBe('fr');
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.style.getPropertyValue('--brand-color')).toBe('#6958A5');
    expect(root.style.getPropertyValue('--hotel-brand-color')).toBe('#6958A5');

    const hotelHeading = root.querySelector('h1.kiosk-hotel-name');
    expect(hotelHeading).toBeInstanceOf(HTMLHeadingElement);
    if (hotelHeading instanceof HTMLHeadingElement) {
      expect(hotelHeading.textContent).toBe('Hôtel La Tour Hassan Palace');
    }

    const langButtons = root.querySelectorAll('.kiosk-lang-btn');
    expect(langButtons.length).toBe(3);

    const frBtn = root.querySelector('[data-lang="fr"]');
    expect(frBtn).toBeInstanceOf(HTMLButtonElement);
    if (frBtn instanceof HTMLButtonElement) {
      expect(frBtn.textContent).toBe('Français');
      expect(frBtn.getAttribute('aria-pressed')).toBe('true');
      expect(frBtn.classList.contains('is-active')).toBe(true);
      expect(frBtn.textContent.includes('🇫🇷')).toBe(false);
    }

    const arBtn = root.querySelector('[data-lang="ar"]');
    expect(arBtn).toBeInstanceOf(HTMLButtonElement);
    if (arBtn instanceof HTMLButtonElement) {
      expect(arBtn.textContent).toBe('العربية');
      expect(arBtn.getAttribute('aria-pressed')).toBe('false');
      expect(arBtn.textContent.includes('🇲🇦')).toBe(false);
    }

    const enBtn = root.querySelector('[data-lang="en"]');
    expect(enBtn).toBeInstanceOf(HTMLButtonElement);
    if (enBtn instanceof HTMLButtonElement) {
      expect(enBtn.textContent).toBe('English');
      expect(enBtn.getAttribute('aria-pressed')).toBe('false');
      expect(enBtn.textContent.includes('🇬🇧')).toBe(false);
    }

    const featuredBadge = root.querySelector('.kiosk-featured-badge');
    expect(featuredBadge).toBeInstanceOf(HTMLSpanElement);
    if (featuredBadge instanceof HTMLSpanElement) {
      expect(featuredBadge.textContent).toBe(resources.fr.kiosk.home.featured);
    }

    const featuredBtn = root.querySelector('[data-testid="featured-tour-button"]');
    expect(featuredBtn).toBeInstanceOf(HTMLButtonElement);
    if (featuredBtn instanceof HTMLButtonElement) {
      expect(featuredBtn.getAttribute('data-tour-id')).toBe(tourMonuments.id);
      expect(featuredBtn.textContent).toBe(resources.fr.kiosk.home.explore);
    }

    const categoryBtns = root.querySelectorAll('.kiosk-category-btn');
    expect(categoryBtns.length).toBe(3);

    const allCatBtn = root.querySelector('[data-category-id="all"]');
    expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
    if (allCatBtn instanceof HTMLButtonElement) {
      expect(allCatBtn.textContent).toBe(resources.fr.kiosk.home.allCategories);
      expect(allCatBtn.getAttribute('aria-pressed')).toBe('true');
      expect(allCatBtn.classList.contains('is-active')).toBe(true);
    }

    const tourItems = root.querySelectorAll('.kiosk-tour-item');
    expect(tourItems.length).toBe(2);

    const tourCards = root.querySelectorAll('.kiosk-tour-card');
    expect(tourCards.length).toBe(2);
  });

  it('applique dir="rtl", lang="ar" et les libellés arabes pour la langue ar', () => {
    const model = createMockModel({
      categories: [
        { id: '01990000-0000-7000-8000-000000000010', label: 'مآثر' },
      ],
    });
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'ar');

    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(root.getAttribute('lang')).toBe('ar');
    expect(root.getAttribute('dir')).toBe('rtl');

    const arBtn = root.querySelector('[data-lang="ar"]');
    expect(arBtn).toBeInstanceOf(HTMLButtonElement);
    if (arBtn instanceof HTMLButtonElement) {
      expect(arBtn.getAttribute('aria-pressed')).toBe('true');
      expect(arBtn.classList.contains('is-active')).toBe(true);
    }

    const featuredBadge = root.querySelector('.kiosk-featured-badge');
    expect(featuredBadge).toBeInstanceOf(HTMLSpanElement);
    if (featuredBadge instanceof HTMLSpanElement) {
      expect(featuredBadge.textContent).toBe(resources.ar.kiosk.home.featured);
    }

    const allCatBtn = root.querySelector('[data-category-id="all"]');
    expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
    if (allCatBtn instanceof HTMLButtonElement) {
      expect(allCatBtn.textContent).toBe(resources.ar.kiosk.home.allCategories);
    }

    const toursHeading = root.querySelector('.kiosk-tours-heading');
    expect(toursHeading).toBeInstanceOf(HTMLHeadingElement);
    if (toursHeading instanceof HTMLHeadingElement) {
      expect(toursHeading.textContent).toBe(resources.ar.kiosk.home.toursList);
    }
  });

  it('applique les libellés anglais pour la langue en', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'en');

    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');

    const enBtn = root.querySelector('[data-lang="en"]');
    expect(enBtn).toBeInstanceOf(HTMLButtonElement);
    if (enBtn instanceof HTMLButtonElement) {
      expect(enBtn.getAttribute('aria-pressed')).toBe('true');
    }

    const featuredBadge = root.querySelector('.kiosk-featured-badge');
    expect(featuredBadge).toBeInstanceOf(HTMLSpanElement);
    if (featuredBadge instanceof HTMLSpanElement) {
      expect(featuredBadge.textContent).toBe(resources.en.kiosk.home.featured);
    }

    const allCatBtn = root.querySelector('[data-category-id="all"]');
    expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
    if (allCatBtn instanceof HTMLButtonElement) {
      expect(allCatBtn.textContent).toBe(resources.en.kiosk.home.allCategories);
    }
  });

  it('n’affiche pas la section mise en avant quand featured est null', () => {
    const model = createMockModel({ featured: null });
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    expect(root.querySelector('.kiosk-featured-section')).toBeNull();
    expect(root.querySelector('[data-testid="featured-tour-button"]')).toBeNull();
  });

  it('affiche un message d’état vide accessible quand tours est vide', () => {
    const model = createMockModel({ tours: [] });
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const emptyEl = root.querySelector('.kiosk-tours-empty');
    expect(emptyEl).toBeInstanceOf(HTMLParagraphElement);
    if (emptyEl instanceof HTMLParagraphElement) {
      expect(emptyEl.getAttribute('role')).toBe('status');
      expect(emptyEl.textContent).toBe(resources.fr.kiosk.home.noTours);
    }
    expect(root.querySelector('.kiosk-tours-grid')).toBeNull();
  });

  it('déclenche onSelectTour lors du clic sur une visite de la grille', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const cardBtn = root.querySelector(`.kiosk-tour-card[data-tour-id="${tourMuseum.id}"]`);
    expect(cardBtn).toBeInstanceOf(HTMLButtonElement);
    if (cardBtn instanceof HTMLButtonElement) {
      cardBtn.click();
    }

    expect(handlers.onSelectTour).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectTour).toHaveBeenCalledWith(tourMuseum.id);
  });

  it('déclenche onSelectTour lors du clic sur la visite mise en avant', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const featuredBtn = root.querySelector('[data-testid="featured-tour-button"]');
    expect(featuredBtn).toBeInstanceOf(HTMLButtonElement);
    if (featuredBtn instanceof HTMLButtonElement) {
      featuredBtn.click();
    }

    expect(handlers.onSelectTour).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectTour).toHaveBeenCalledWith(tourMonuments.id);
  });

  it('déclenche onSelectCategory avec l’id lors du clic sur une catégorie', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const catBtn = root.querySelector(
      `[data-category-id="01990000-0000-7000-8000-000000000020"]`,
    );
    expect(catBtn).toBeInstanceOf(HTMLButtonElement);
    if (catBtn instanceof HTMLButtonElement) {
      catBtn.click();
    }

    expect(handlers.onSelectCategory).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectCategory).toHaveBeenCalledWith(
      '01990000-0000-7000-8000-000000000020',
    );
  });

  it('déclenche onSelectCategory(null) lors du clic sur Toutes les catégories', () => {
    const model = createMockModel({
      selectedCategoryId: '01990000-0000-7000-8000-000000000010',
    });
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const allCatBtn = root.querySelector('[data-category-id="all"]');
    expect(allCatBtn).toBeInstanceOf(HTMLButtonElement);
    if (allCatBtn instanceof HTMLButtonElement) {
      expect(allCatBtn.getAttribute('aria-pressed')).toBe('false');
      allCatBtn.click();
    }

    expect(handlers.onSelectCategory).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectCategory).toHaveBeenCalledWith(null);
  });

  it('déclenche onSelectLang lors du clic sur un bouton de langue', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const arBtn = root.querySelector('[data-lang="ar"]');
    expect(arBtn).toBeInstanceOf(HTMLButtonElement);
    if (arBtn instanceof HTMLButtonElement) {
      arBtn.click();
    }

    expect(handlers.onSelectLang).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectLang).toHaveBeenCalledWith('ar');
  });

  it('désactive tous les boutons d’action après un premier clic pour éviter le double envoi', () => {
    const model = createMockModel();
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const cardBtn = root.querySelector(`.kiosk-tour-card[data-tour-id="${tourMuseum.id}"]`);
    expect(cardBtn).toBeInstanceOf(HTMLButtonElement);
    if (cardBtn instanceof HTMLButtonElement) {
      cardBtn.click();
      // Deuxième clic immédiat
      cardBtn.click();
    }

    expect(handlers.onSelectTour).toHaveBeenCalledTimes(1);

    const allButtons = Array.from(root.querySelectorAll('button'));
    for (const btn of allButtons) {
      expect(btn.disabled).toBe(true);
    }
  });

  it('affiche le titre traduit si le tour contient un LocalizedText', () => {
    const tourWithTitle = {
      ...tourMonuments,
      title: { fr: 'Visite des Oudayas', ar: 'قصبة الأوداية', en: 'Oudayas Tour' },
    };
    const model = createMockModel({
      featured: tourWithTitle,
      tours: [tourWithTitle],
    });
    const handlers = {
      onSelectTour: vi.fn(),
      onSelectCategory: vi.fn(),
      onSelectLang: vi.fn(),
    };

    renderHome(document, root, model, handlers, 'fr');

    const featuredTitle = root.querySelector('.kiosk-featured-title');
    expect(featuredTitle?.textContent).toBe('Visite des Oudayas');

    renderHome(document, root, model, handlers, 'ar');
    const featuredTitleAr = root.querySelector('.kiosk-featured-title');
    expect(featuredTitleAr?.textContent).toBe('قصبة الأوداية');
  });
});
