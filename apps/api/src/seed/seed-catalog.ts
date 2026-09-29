import type { PrismaClient } from '@prisma/client';
import type { CategoryCreate, CityCreate } from '@xplor/shared';

import { localizedToJson } from '../catalog/localized-json.js';

/** Ville de démonstration, upsert sur un UUID v7 fixe. */
export interface SeedCity extends CityCreate {
  id: string;
}

/** Catégorie de démonstration, upsert sur un UUID v7 fixe. */
export interface SeedCategory extends CategoryCreate {
  id: string;
}

const REGION = 'Rabat-Salé-Kénitra';

/**
 * Centres approximatifs (WGS84). Icônes, couleurs et traductions : D-69.
 * Monuments reprend l'exemple du manifeste (`landmark`, `#1F6F8B`).
 */
export const SEED_CITIES: readonly SeedCity[] = [
  {
    id: '01990000-0000-7000-8000-000000000001',
    name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
    region: REGION,
    lat: 34.02088,
    lng: -6.84165,
  },
  {
    id: '01990000-0000-7000-8000-000000000002',
    name: { fr: 'Salé', ar: 'سلا', en: 'Sale' },
    region: REGION,
    lat: 34.03723,
    lng: -6.79846,
  },
  {
    id: '01990000-0000-7000-8000-000000000003',
    name: { fr: 'Kénitra', ar: 'القنيطرة', en: 'Kenitra' },
    region: REGION,
    lat: 34.26101,
    lng: -6.5802,
  },
  {
    id: '01990000-0000-7000-8000-000000000004',
    name: { fr: 'Témara', ar: 'تمارة', en: 'Temara' },
    region: REGION,
    lat: 33.92866,
    lng: -6.90656,
  },
];

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  {
    id: '01990000-0000-7000-8000-000000000011',
    name: { fr: 'Monuments', ar: 'مآثر', en: 'Monuments' },
    icon: 'landmark',
    color: '#1F6F8B',
    weight: 1,
  },
  {
    id: '01990000-0000-7000-8000-000000000012',
    name: { fr: 'Médina', ar: 'المدينة', en: 'Medina' },
    icon: 'city',
    color: '#C4A35A',
    weight: 2,
  },
  {
    id: '01990000-0000-7000-8000-000000000013',
    name: { fr: 'Plages', ar: 'الشواطئ', en: 'Beaches' },
    icon: 'beach',
    color: '#2E86AB',
    weight: 3,
  },
  {
    id: '01990000-0000-7000-8000-000000000014',
    name: { fr: 'Gastronomie', ar: 'المطبخ', en: 'Gastronomy' },
    icon: 'utensils',
    color: '#8A5A2B',
    weight: 4,
  },
  {
    id: '01990000-0000-7000-8000-000000000015',
    name: { fr: 'Nature', ar: 'الطبيعة', en: 'Nature' },
    icon: 'tree',
    color: '#2D6A4F',
    weight: 5,
  },
  {
    id: '01990000-0000-7000-8000-000000000016',
    name: { fr: 'Artisanat', ar: 'الصناعة التقليدية', en: 'Crafts' },
    icon: 'palette',
    color: '#9B2226',
    weight: 6,
  },
];

/** Upsert par identifiant fixe : une seconde exécution ne duplique pas les lignes. */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const city of SEED_CITIES) {
    const data = {
      name: localizedToJson(city.name),
      region: city.region,
      lat: city.lat,
      lng: city.lng,
    };
    await prisma.city.upsert({
      where: { id: city.id },
      create: { id: city.id, ...data },
      update: data,
    });
  }
  for (const category of SEED_CATEGORIES) {
    const data = {
      name: localizedToJson(category.name),
      icon: category.icon,
      color: category.color,
      weight: category.weight,
    };
    await prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data },
      update: data,
    });
  }
}
