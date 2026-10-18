import { dir, resources } from '@xplor/i18n';
import {
  LANGS,
  LocalizedTextSchema,
  localize,
  type KioskManifestTour,
  type Lang,
} from '@xplor/shared';

import type { buildHomeModel } from './home-model.js';

export interface HomeHandlers {
  onSelectTour(id: string): void;
  onSelectCategory(id: string | null): void;
  onSelectLang(lang: Lang): void;
}

function resolveTourTitle(tour: KioskManifestTour, lang: Lang): string {
  if ('title' in tour) {
    const parsed = LocalizedTextSchema.safeParse(tour.title);
    if (parsed.success) {
      return localize(parsed.data, lang);
    }
  }
  return tour.id;
}

/**
 * Rendu DOM pur de l'écran d'accueil du kiosque (F-61).
 *
 * Affiche :
 * - Le nom de l'hôtel et sa couleur de marque en variable CSS (--brand-color).
 * - Les boutons de langue avec le nom de la langue (sans emoji drapeau ambigu).
 * - La visite mise en avant si présente dans le modèle.
 * - Les filtres de catégories (toutes + chaque catégorie utilisée).
 * - La grille des visites de la sélection (ou état vide accessible).
 * - Gestion de l'orientation dir (rtl / ltr) et attributs d'accessibilité ARIA.
 * - Désactivation des boutons lors du clic pour éviter les doubles envois.
 */
export function renderHome(
  doc: Document,
  root: HTMLElement,
  model: ReturnType<typeof buildHomeModel>,
  handlers: {
    onSelectTour(id: string): void;
    onSelectCategory(id: string | null): void;
    onSelectLang(lang: Lang): void;
  },
  lang: Lang,
): void {
  const direction = dir(lang);
  doc.documentElement.setAttribute('dir', direction);
  doc.documentElement.setAttribute('lang', lang);
  root.setAttribute('dir', direction);
  root.setAttribute('lang', lang);

  root.style.setProperty('--brand-color', model.brandColor);
  root.style.setProperty('--hotel-brand-color', model.brandColor);
  root.className = 'kiosk-home';

  root.replaceChildren();

  const actionButtons: HTMLButtonElement[] = [];
  let isActionPending = false;

  function runGuardedAction(action: () => void): void {
    if (isActionPending) {
      return;
    }
    isActionPending = true;
    for (const button of actionButtons) {
      button.disabled = true;
    }
    action();
  }

  // --- En-tête : Nom de l'hôtel + Sélecteur de langue ---
  const header = doc.createElement('header');
  header.className = 'kiosk-home-header';
  header.setAttribute('role', 'banner');

  const brandingDiv = doc.createElement('div');
  brandingDiv.className = 'kiosk-hotel-branding';

  const hotelTitle = doc.createElement('h1');
  hotelTitle.className = 'kiosk-hotel-name';
  hotelTitle.textContent = model.hotelName;
  brandingDiv.appendChild(hotelTitle);

  const langNav = doc.createElement('nav');
  langNav.className = 'kiosk-lang-nav';
  langNav.setAttribute('aria-label', resources[lang].kiosk.home.languagesLabel);

  for (const l of LANGS) {
    const langBtn = doc.createElement('button');
    langBtn.type = 'button';
    langBtn.className = l === lang ? 'kiosk-lang-btn is-active' : 'kiosk-lang-btn';
    langBtn.setAttribute('data-lang', l);
    langBtn.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
    langBtn.textContent = resources[lang].common.language[l];
    langBtn.addEventListener('click', () => {
      runGuardedAction(() => {
        handlers.onSelectLang(l);
      });
    });
    actionButtons.push(langBtn);
    langNav.appendChild(langBtn);
  }

  header.appendChild(brandingDiv);
  header.appendChild(langNav);
  root.appendChild(header);

  // --- Corps principal ---
  const main = doc.createElement('main');
  main.className = 'kiosk-home-main';

  // --- Visite mise en avant (si présente) ---
  if (model.featured !== null) {
    const featuredTour = model.featured;
    const featuredSection = doc.createElement('section');
    featuredSection.className = 'kiosk-featured-section';
    featuredSection.setAttribute('aria-labelledby', 'kiosk-featured-heading');

    const featuredBadge = doc.createElement('span');
    featuredBadge.id = 'kiosk-featured-heading';
    featuredBadge.className = 'kiosk-featured-badge';
    featuredBadge.textContent = resources[lang].kiosk.home.featured;

    const featuredCard = doc.createElement('div');
    featuredCard.className = 'kiosk-featured-card';

    const featuredTitle = doc.createElement('h2');
    featuredTitle.className = 'kiosk-featured-title';
    featuredTitle.textContent = resolveTourTitle(featuredTour, lang);

    const featuredBtn = doc.createElement('button');
    featuredBtn.type = 'button';
    featuredBtn.className = 'kiosk-featured-btn';
    featuredBtn.setAttribute('data-tour-id', featuredTour.id);
    featuredBtn.setAttribute('data-testid', 'featured-tour-button');
    featuredBtn.setAttribute(
      'aria-label',
      `${resources[lang].kiosk.home.explore}: ${resolveTourTitle(featuredTour, lang)}`,
    );
    featuredBtn.textContent = resources[lang].kiosk.home.explore;
    featuredBtn.addEventListener('click', () => {
      runGuardedAction(() => {
        handlers.onSelectTour(featuredTour.id);
      });
    });
    actionButtons.push(featuredBtn);

    featuredCard.appendChild(featuredBadge);
    featuredCard.appendChild(featuredTitle);
    featuredCard.appendChild(featuredBtn);
    featuredSection.appendChild(featuredCard);
    main.appendChild(featuredSection);
  }

  // --- Filtres de catégories ---
  const categoriesNav = doc.createElement('nav');
  categoriesNav.className = 'kiosk-category-nav';
  categoriesNav.setAttribute('aria-label', resources[lang].kiosk.home.categoriesLabel);

  const isAllSelected = model.selectedCategoryId === null;
  const allCategoryBtn = doc.createElement('button');
  allCategoryBtn.type = 'button';
  allCategoryBtn.className = isAllSelected
    ? 'kiosk-category-btn is-active'
    : 'kiosk-category-btn';
  allCategoryBtn.setAttribute('data-category-id', 'all');
  allCategoryBtn.setAttribute('aria-pressed', isAllSelected ? 'true' : 'false');
  allCategoryBtn.textContent = resources[lang].kiosk.home.allCategories;
  allCategoryBtn.addEventListener('click', () => {
    runGuardedAction(() => {
      handlers.onSelectCategory(null);
    });
  });
  actionButtons.push(allCategoryBtn);
  categoriesNav.appendChild(allCategoryBtn);

  for (const category of model.categories) {
    const isCategorySelected = model.selectedCategoryId === category.id;
    const catBtn = doc.createElement('button');
    catBtn.type = 'button';
    catBtn.className = isCategorySelected
      ? 'kiosk-category-btn is-active'
      : 'kiosk-category-btn';
    catBtn.setAttribute('data-category-id', category.id);
    catBtn.setAttribute('aria-pressed', isCategorySelected ? 'true' : 'false');
    catBtn.textContent = category.label;
    catBtn.addEventListener('click', () => {
      runGuardedAction(() => {
        handlers.onSelectCategory(category.id);
      });
    });
    actionButtons.push(catBtn);
    categoriesNav.appendChild(catBtn);
  }

  main.appendChild(categoriesNav);

  // --- Grille de visites ---
  const toursSection = doc.createElement('section');
  toursSection.className = 'kiosk-tours-section';
  toursSection.setAttribute('aria-labelledby', 'kiosk-tours-heading');

  const toursHeading = doc.createElement('h2');
  toursHeading.id = 'kiosk-tours-heading';
  toursHeading.className = 'kiosk-tours-heading';
  toursHeading.textContent = resources[lang].kiosk.home.toursList;
  toursSection.appendChild(toursHeading);

  if (model.tours.length === 0) {
    const emptyParagraph = doc.createElement('p');
    emptyParagraph.className = 'kiosk-tours-empty';
    emptyParagraph.setAttribute('role', 'status');
    emptyParagraph.textContent = resources[lang].kiosk.home.noTours;
    toursSection.appendChild(emptyParagraph);
  } else {
    const toursGrid = doc.createElement('ul');
    toursGrid.className = 'kiosk-tours-grid';
    toursGrid.setAttribute('role', 'list');

    for (const tour of model.tours) {
      const tourItem = doc.createElement('li');
      tourItem.className = 'kiosk-tour-item';
      tourItem.setAttribute('data-tour-id', tour.id);

      const tourBtn = doc.createElement('button');
      tourBtn.type = 'button';
      tourBtn.className = 'kiosk-tour-card';
      tourBtn.setAttribute('data-tour-id', tour.id);
      tourBtn.setAttribute(
        'aria-label',
        `${resources[lang].kiosk.home.explore}: ${resolveTourTitle(tour, lang)}`,
      );

      const titleEl = doc.createElement('h3');
      titleEl.className = 'kiosk-tour-title';
      titleEl.textContent = resolveTourTitle(tour, lang);

      const ctaEl = doc.createElement('span');
      ctaEl.className = 'kiosk-tour-cta';
      ctaEl.textContent = resources[lang].kiosk.home.explore;

      tourBtn.appendChild(titleEl);
      tourBtn.appendChild(ctaEl);

      tourBtn.addEventListener('click', () => {
        runGuardedAction(() => {
          handlers.onSelectTour(tour.id);
        });
      });
      actionButtons.push(tourBtn);

      tourItem.appendChild(tourBtn);
      toursGrid.appendChild(tourItem);
    }

    toursSection.appendChild(toursGrid);
  }

  main.appendChild(toursSection);
  root.appendChild(main);
}
