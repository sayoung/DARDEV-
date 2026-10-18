import {
  localize,
  type KioskManifest,
  type KioskManifestTour,
  type Lang,
} from '@xplor/shared';

/** Élément de catégorie affiché sur l'écran d'accueil du kiosque. */
export interface HomeCategoryItem {
  id: string;
  label: string;
}

/** Modèle d'affichage de l'écran d'accueil du kiosque (F-61). */
export interface HomeModel {
  hotelName: string;
  brandColor: string;
  featured: KioskManifestTour | null;
  categories: HomeCategoryItem[];
  tours: KioskManifestTour[];
  selectedCategoryId: string | null;
}

function tourMatchesCategory(tour: KioskManifestTour, categoryId: string): boolean {
  if (tour.categoryId === categoryId) {
    return true;
  }
  if (tour.categoryIds !== undefined && tour.categoryIds.includes(categoryId)) {
    return true;
  }
  return false;
}

/**
 * Construit le modèle d'affichage de l'écran d'accueil à partir du manifeste synchronisé (F-61).
 *
 * - `hotelName` et `brandColor` proviennent de la configuration de l'hôtel.
 * - `featured` est la visite mise en avant de la sélection (ou `null` si absente ou introuvable).
 * - `categories` liste uniquement les catégories utilisées par au moins une visite de la sélection,
 *   avec leur libellé traduit (repli automatique sur le français).
 * - `tours` liste les visites dans l'ordre du manifeste, filtrées par `categoryId` si non nul.
 */
export function buildHomeModel(
  manifest: KioskManifest,
  lang: Lang,
  categoryId: string | null,
): HomeModel {
  const usedCategoryIds = new Set<string>();
  for (const tour of manifest.selection.tours) {
    if (tour.categoryId !== undefined && tour.categoryId !== null) {
      usedCategoryIds.add(tour.categoryId);
    }
    if (tour.categoryIds !== undefined) {
      for (const catId of tour.categoryIds) {
        usedCategoryIds.add(catId);
      }
    }
  }

  const seenCategoryIds = new Set<string>();
  const categories: HomeCategoryItem[] = [];

  for (const category of manifest.categories) {
    if (usedCategoryIds.has(category.id) && !seenCategoryIds.has(category.id)) {
      seenCategoryIds.add(category.id);
      categories.push({
        id: category.id,
        label: localize(category.name, lang),
      });
    }
  }

  const tours: KioskManifestTour[] =
    categoryId === null
      ? [...manifest.selection.tours]
      : manifest.selection.tours.filter((tour) => tourMatchesCategory(tour, categoryId));

  const featured: KioskManifestTour | null =
    manifest.selection.featuredTourId === null
      ? null
      : (manifest.selection.tours.find(
          (tour) => tour.id === manifest.selection.featuredTourId,
        ) ?? null);

  return {
    hotelName: manifest.hotel.name,
    brandColor: manifest.hotel.brandColor,
    featured,
    categories,
    tours,
    selectedCategoryId: categoryId,
  };
}
