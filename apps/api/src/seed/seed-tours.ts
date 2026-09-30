import {
  AssetKind as PrismaAssetKind,
  HotspotIcon as PrismaHotspotIcon,
  HotspotType as PrismaHotspotType,
  Prisma,
  ProcessingStatus as PrismaProcessingStatus,
  TourStatus as PrismaTourStatus,
  type PrismaClient,
} from '@prisma/client';
import {
  AssetKind,
  HotspotType,
  ProcessingStatus,
  TourStatus,
  type LocalizedText,
} from '@xplor/shared';

import {
  type FindTargetTour,
  type TargetTourSnapshot,
  type TourSnapshot,
} from '../catalog/publication-rules.js';
import { localizedToJson } from '../catalog/localized-json.js';
import { SEED_CATEGORIES, SEED_CITIES } from './seed-catalog.js';

/** Compte EDITOR du seed, auteur des visites de démonstration. */
export const SEED_EDITOR_EMAIL = 'editor@xplor.local';

/** Date de publication fixe : un second seed ne la fait pas varier. */
export const SEED_TOUR_PUBLISHED_AT = '2026-09-29T00:00:00.000Z';

const DEMO_COPYRIGHT = 'Démonstration — aucun fichier stocké (pipeline M2).';

/** Média de démonstration. Upsert sur un UUID v7 fixe. Aucun fichier n'est déposé. */
export interface SeedAsset {
  id: string;
  kind: AssetKind;
  originalKey: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
  width: number;
  height: number;
  contentHash: string;
  processingStatus: ProcessingStatus;
  copyright: string;
}

/** Hotspot de navigation du seed (scène ou visite). */
export interface SeedHotspot {
  id: string;
  type: HotspotType.SCENE_LINK | HotspotType.TOUR_LINK;
  label: LocalizedText;
  yaw: number;
  pitch: number;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
}

/** Scène de démonstration, panorama compris. */
export interface SeedScene {
  id: string;
  title: LocalizedText;
  caption: LocalizedText;
  weight: number;
  panorama: SeedAsset;
  hotspots: readonly SeedHotspot[];
}

/** Visite publiée de démonstration. */
export interface SeedTour {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  description: LocalizedText;
  practicalInfo: LocalizedText;
  /** Nom français d'une ville de `SEED_CITIES`. */
  cityFr: string;
  /** Nom français d'une catégorie de `SEED_CATEGORIES`. */
  categoryFr: string;
  categoryLinkId: string;
  cover: SeedAsset;
  shareToken: string;
  lat: number;
  lng: number;
  durationMinutes: number;
  status: TourStatus;
  startSceneId: string;
  scenes: readonly SeedScene[];
}

/**
 * UUID v7 fixe, même préfixe que les autres seeds.
 * Le suffixe tient sur 3 hexadécimaux (groupe final de 12 caractères).
 */
function seedId(suffix: string): string {
  if (!/^[0-9a-f]{3}$/.test(suffix)) {
    throw new Error(`Suffixe d'UUID de seed invalide : ${suffix}`);
  }
  return `01990000-0000-7000-8000-000000000${suffix}`;
}

function text(fr: string, ar: string, en: string): LocalizedText {
  return { fr, ar, en };
}

function asset(id: string, kind: AssetKind, fileName: string, width: number, height: number): SeedAsset {
  return {
    id,
    kind,
    originalKey: `seed/${fileName}`,
    mimeType: 'image/jpeg',
    sizeBytes: kind === AssetKind.PANORAMA ? 1_048_576 : 204_800,
    width,
    height,
    contentHash: id.replaceAll('-', '').padEnd(64, '0'),
    processingStatus: ProcessingStatus.READY,
    copyright: DEMO_COPYRIGHT,
  };
}

function cover(id: string, fileName: string): SeedAsset {
  return asset(id, AssetKind.IMAGE, fileName, 1200, 800);
}

function panorama(id: string, fileName: string): SeedAsset {
  return asset(id, AssetKind.PANORAMA, fileName, 4096, 2048);
}

function sceneLink(id: string, targetSceneId: string, label: LocalizedText, yaw: number): SeedHotspot {
  return {
    id,
    type: HotspotType.SCENE_LINK,
    label,
    yaw,
    pitch: 0,
    targetSceneId,
    targetTourId: null,
    targetTourSceneId: null,
  };
}

function tourLink(
  id: string,
  targetTourId: string,
  targetTourSceneId: string,
  label: LocalizedText,
): SeedHotspot {
  return {
    id,
    type: HotspotType.TOUR_LINK,
    label,
    yaw: 2,
    pitch: 0.2,
    targetSceneId: null,
    targetTourId,
    targetTourSceneId,
  };
}

const OUDAYAS = seedId('301');
const SALE = seedId('302');
const MEHDIA = seedId('303');

const OUDAYAS_PORTE = seedId('311');
const OUDAYAS_JARDIN = seedId('312');
const OUDAYAS_REMPARTS = seedId('313');
const SALE_ENTREE = seedId('321');
const SALE_BASSIN = seedId('322');
const SALE_ORANGERS = seedId('323');
const MEHDIA_RIVAGE = seedId('331');
const MEHDIA_DUNES = seedId('332');

/**
 * Kasbah des Oudayas, Jardin de Salé et Plage de Mehdia.
 * Cycle de `TOUR_LINK` : Oudayas → Salé → Mehdia → Oudayas.
 * Chaque chaîne de `SCENE_LINK` part de la scène de départ et y revient.
 */
export const SEED_TOURS: readonly SeedTour[] = [
  {
    id: OUDAYAS,
    title: text('Kasbah des Oudayas', 'قصبة الأوداية', 'Kasbah of the Udayas'),
    summary: text(
      "Remparts, porte et jardin andalou de la Kasbah des Oudayas, face à l'embouchure du Bouregreg.",
      'أسوار وباب وحديقة أندلسية في قصبة الأوداية، قبالة مصب أبي رقراق.',
      'Ramparts, gate and Andalusian garden of the Kasbah of the Udayas, facing the Bouregreg mouth.',
    ),
    description: text(
      'Une promenade dans la kasbah : la porte monumentale, le jardin andalou, puis les remparts sur le fleuve.',
      'نزهة في القصبة: الباب الأثري، ثم الحديقة الأندلسية، ثم الأسوار المطلة على النهر.',
      'A walk through the kasbah: the monumental gate, the Andalusian garden, then the ramparts above the river.',
    ),
    practicalInfo: text(
      'Accès à pied depuis le Bouregreg. Prévoir de l’ombre en été.',
      'الوصول سيرا من أبي رقراق. يُستحسن الظل في الصيف.',
      'Reachable on foot from the Bouregreg. Seek shade in summer.',
    ),
    cityFr: 'Rabat',
    categoryFr: 'Monuments',
    categoryLinkId: seedId('511'),
    cover: cover(seedId('201'), 'kasbah-des-oudayas/cover.jpg'),
    shareToken: 'seedkasbahoudayas00001',
    lat: 34.0325,
    lng: -6.8364,
    durationMinutes: 15,
    status: TourStatus.PUBLISHED,
    startSceneId: OUDAYAS_PORTE,
    scenes: [
      {
        id: OUDAYAS_PORTE,
        title: text('La porte', 'الباب', 'The gate'),
        caption: text(
          'Porte monumentale de la kasbah.',
          'الباب الأثري للقصبة.',
          'Monumental gate of the kasbah.',
        ),
        weight: 0,
        panorama: panorama(seedId('211'), 'kasbah-des-oudayas/porte.jpg'),
        hotspots: [
          sceneLink(
            seedId('411'),
            OUDAYAS_JARDIN,
            text('Vers le jardin andalou', 'نحو الحديقة الأندلسية', 'To the Andalusian garden'),
            0.4,
          ),
          tourLink(
            seedId('414'),
            SALE,
            SALE_ENTREE,
            text('Vers le Jardin de Salé', 'نحو حديقة سلا', 'To the Sale Garden'),
          ),
        ],
      },
      {
        id: OUDAYAS_JARDIN,
        title: text('Le jardin andalou', 'الحديقة الأندلسية', 'The Andalusian garden'),
        caption: text(
          'Allées et bassins du jardin.',
          'ممرات وأحواض الحديقة.',
          'Paths and basins of the garden.',
        ),
        weight: 1,
        panorama: panorama(seedId('212'), 'kasbah-des-oudayas/jardin.jpg'),
        hotspots: [
          sceneLink(
            seedId('412'),
            OUDAYAS_REMPARTS,
            text('Vers les remparts', 'نحو الأسوار', 'To the ramparts'),
            0.8,
          ),
        ],
      },
      {
        id: OUDAYAS_REMPARTS,
        title: text('Les remparts', 'الأسوار', 'The ramparts'),
        caption: text(
          'Remparts face au Bouregreg.',
          'أسوار قبالة أبي رقراق.',
          'Ramparts facing the Bouregreg.',
        ),
        weight: 2,
        panorama: panorama(seedId('213'), 'kasbah-des-oudayas/remparts.jpg'),
        hotspots: [
          sceneLink(
            seedId('413'),
            OUDAYAS_PORTE,
            text('Retour à la porte', 'العودة إلى الباب', 'Back to the gate'),
            -0.6,
          ),
        ],
      },
    ],
  },
  {
    id: SALE,
    title: text('Jardin de Salé', 'حديقة سلا', 'Sale Garden'),
    summary: text(
      "Allées, bassin et orangers d'un jardin de Salé, à deux pas de la médina.",
      'ممرات وحوض وأشجار برتقال في حديقة بسلا، على مقربة من المدينة العتيقة.',
      'Paths, a basin and orange trees in a garden in Sale, a short walk from the medina.',
    ),
    description: text(
      "De l'entrée au bassin, puis sous les orangers.",
      'من المدخل إلى الحوض، ثم تحت أشجار البرتقال.',
      'From the entrance to the basin, then under the orange trees.',
    ),
    practicalInfo: text(
      'Ouvert dans la journée. Entrée à pied depuis la médina.',
      'مفتوح نهارا. الدخول سيرا من المدينة العتيقة.',
      'Open during the day. Enter on foot from the medina.',
    ),
    cityFr: 'Salé',
    categoryFr: 'Nature',
    categoryLinkId: seedId('512'),
    cover: cover(seedId('202'), 'jardin-de-sale/cover.jpg'),
    shareToken: 'seedjardindesale000001',
    lat: 34.0405,
    lng: -6.812,
    durationMinutes: 12,
    status: TourStatus.PUBLISHED,
    startSceneId: SALE_ENTREE,
    scenes: [
      {
        id: SALE_ENTREE,
        title: text("L'entrée", 'المدخل', 'The entrance'),
        caption: text('Seuil du jardin.', 'عتبة الحديقة.', 'Threshold of the garden.'),
        weight: 0,
        panorama: panorama(seedId('221'), 'jardin-de-sale/entree.jpg'),
        hotspots: [
          sceneLink(
            seedId('421'),
            SALE_BASSIN,
            text('Vers le bassin', 'نحو الحوض', 'To the basin'),
            0.5,
          ),
          tourLink(
            seedId('424'),
            MEHDIA,
            MEHDIA_RIVAGE,
            text('Vers la plage de Mehdia', 'نحو شاطئ مهدية', 'To Mehdia beach'),
          ),
        ],
      },
      {
        id: SALE_BASSIN,
        title: text('Le bassin', 'الحوض', 'The basin'),
        caption: text('Bassin au centre du jardin.', 'حوض في وسط الحديقة.', 'Basin in the middle of the garden.'),
        weight: 1,
        panorama: panorama(seedId('222'), 'jardin-de-sale/bassin.jpg'),
        hotspots: [
          sceneLink(
            seedId('422'),
            SALE_ORANGERS,
            text('Vers les orangers', 'نحو أشجار البرتقال', 'To the orange trees'),
            1,
          ),
        ],
      },
      {
        id: SALE_ORANGERS,
        title: text('Les orangers', 'أشجار البرتقال', 'The orange trees'),
        caption: text('Ombre des orangers.', 'ظل أشجار البرتقال.', 'Shade of the orange trees.'),
        weight: 2,
        panorama: panorama(seedId('223'), 'jardin-de-sale/orangers.jpg'),
        hotspots: [
          sceneLink(
            seedId('423'),
            SALE_ENTREE,
            text("Retour à l'entrée", 'العودة إلى المدخل', 'Back to the entrance'),
            -0.5,
          ),
        ],
      },
    ],
  },
  {
    id: MEHDIA,
    title: text('Plage de Mehdia', 'شاطئ مهدية', 'Mehdia Beach'),
    summary: text(
      'Rivage et dunes de la plage de Mehdia, sur la côte atlantique près de Kénitra.',
      'شاطئ وكثبان مهدية على الساحل الأطلسي قرب القنيطرة.',
      'Shore and dunes of Mehdia beach, on the Atlantic coast near Kenitra.',
    ),
    description: text(
      'Le rivage, puis les dunes qui ferment la plage.',
      'الشاطئ، ثم الكثبان التي تغلق الرمال.',
      'The shore, then the dunes that close the beach.',
    ),
    practicalInfo: text(
      'Vent fréquent. Pas de vestiaire sur place.',
      'الرياح متكررة. لا توجد غرف تبديل في المكان.',
      'Often windy. No changing rooms on site.',
    ),
    cityFr: 'Kénitra',
    categoryFr: 'Plages',
    categoryLinkId: seedId('513'),
    cover: cover(seedId('203'), 'plage-de-mehdia/cover.jpg'),
    shareToken: 'seedplagedemehdia00001',
    lat: 34.2597,
    lng: -6.6754,
    durationMinutes: 10,
    status: TourStatus.PUBLISHED,
    startSceneId: MEHDIA_RIVAGE,
    scenes: [
      {
        id: MEHDIA_RIVAGE,
        title: text('Le rivage', 'الشاطئ', 'The shore'),
        caption: text('Bord de l’Atlantique.', 'حافة المحيط الأطلسي.', 'Edge of the Atlantic.'),
        weight: 0,
        panorama: panorama(seedId('231'), 'plage-de-mehdia/rivage.jpg'),
        hotspots: [
          sceneLink(
            seedId('431'),
            MEHDIA_DUNES,
            text('Vers les dunes', 'نحو الكثبان', 'To the dunes'),
            0.6,
          ),
          tourLink(
            seedId('433'),
            OUDAYAS,
            OUDAYAS_PORTE,
            text('Vers la Kasbah des Oudayas', 'نحو قصبة الأوداية', 'To the Kasbah of the Udayas'),
          ),
        ],
      },
      {
        id: MEHDIA_DUNES,
        title: text('Les dunes', 'الكثبان', 'The dunes'),
        caption: text('Dunes en retrait du rivage.', 'كثبان خلف الشاطئ.', 'Dunes set back from the shore.'),
        weight: 1,
        panorama: panorama(seedId('232'), 'plage-de-mehdia/dunes.jpg'),
        hotspots: [
          sceneLink(
            seedId('432'),
            MEHDIA_RIVAGE,
            text('Retour au rivage', 'العودة إلى الشاطئ', 'Back to the shore'),
            -0.4,
          ),
        ],
      },
    ],
  },
];

/** Vignettes et panoramas des visites de démonstration, sans doublon d'identifiant. */
export function listSeedAssets(): readonly SeedAsset[] {
  const assets: SeedAsset[] = [];
  for (const tour of SEED_TOURS) {
    assets.push(tour.cover);
    for (const scene of tour.scenes) {
      assets.push(scene.panorama);
    }
  }
  return assets;
}

/** Instantané consommé par `validateTour` : scènes vivantes, panoramas prêts. */
export function seedTourSnapshot(tour: SeedTour): TourSnapshot {
  return {
    id: tour.id,
    startSceneId: tour.startSceneId,
    scenes: tour.scenes.map((scene) => ({
      id: scene.id,
      deleted: false,
      panoramaStatus: scene.panorama.processingStatus,
      hotspots: scene.hotspots.map((hotspot) => ({
        id: hotspot.id,
        type: hotspot.type,
        targetSceneId: hotspot.targetSceneId,
        targetTourId: hotspot.targetTourId,
        targetTourSceneId: hotspot.targetTourSceneId,
      })),
    })),
  };
}

/** Visite cible du seed. `undefined` si l'identifiant n'est pas une visite de démonstration. */
export const findSeedTargetTour: FindTargetTour = (tourId: string): TargetTourSnapshot | undefined => {
  const tour = SEED_TOURS.find((item) => item.id === tourId);
  if (tour === undefined) {
    return undefined;
  }
  return {
    status: tour.status,
    deleted: false,
    sceneIds: tour.scenes.map((scene) => scene.id),
  };
};

/**
 * Trois visites publiées, leurs médias, scènes et hotspots.
 * Une seconde exécution ne duplique pas les lignes.
 * Les fichiers de `prisma/seed-assets/` restent pour le pipeline M2 (D-77).
 */
export async function seedTours(prisma: PrismaClient): Promise<void> {
  const editor = await prisma.user.findUnique({ where: { email: SEED_EDITOR_EMAIL } });
  if (editor === null) {
    throw new Error(
      `L'utilisateur ${SEED_EDITOR_EMAIL} est absent. Le seed des comptes doit passer avant les visites.`,
    );
  }
  for (const row of listSeedAssets()) {
    await upsertAsset(prisma, row);
  }
  for (const tour of SEED_TOURS) {
    await upsertTour(prisma, tour, editor.id);
    await upsertTourCategory(prisma, tour);
  }
  for (const tour of SEED_TOURS) {
    for (const scene of tour.scenes) {
      await upsertScene(prisma, tour.id, scene, editor.id);
    }
  }
  for (const tour of SEED_TOURS) {
    for (const scene of tour.scenes) {
      for (const hotspot of scene.hotspots) {
        await upsertHotspot(prisma, scene.id, hotspot, editor.id);
      }
    }
  }
  for (const tour of SEED_TOURS) {
    await prisma.tour.update({
      where: { id: tour.id },
      data: { startSceneId: tour.startSceneId },
    });
  }
}

async function upsertAsset(prisma: PrismaClient, row: SeedAsset): Promise<void> {
  const data = {
    kind: toPrismaKind(row.kind),
    originalKey: row.originalKey,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    contentHash: row.contentHash,
    processingStatus: toPrismaStatus(row.processingStatus),
    derivatives: {},
    copyright: row.copyright,
  };
  await prisma.asset.upsert({
    where: { id: row.id },
    create: { id: row.id, ...data },
    update: data,
  });
}

async function upsertTour(prisma: PrismaClient, tour: SeedTour, createdById: string): Promise<void> {
  const data = {
    title: localizedToJson(tour.title),
    summary: localizedToJson(tour.summary),
    description: localizedToJson(tour.description),
    cityId: requireCityId(tour.cityFr),
    coverAssetId: tour.cover.id,
    durationMinutes: tour.durationMinutes,
    lat: tour.lat,
    lng: tour.lng,
    practicalInfo: localizedToJson(tour.practicalInfo),
    shareToken: tour.shareToken,
    publicShare: false,
    contentVersion: 1,
    status: toPrismaTourStatus(tour.status),
    publishedAt: new Date(SEED_TOUR_PUBLISHED_AT),
    deletedAt: null,
    createdById,
  };
  await prisma.tour.upsert({
    where: { id: tour.id },
    create: { id: tour.id, ...data, startSceneId: null },
    update: data,
  });
}

async function upsertTourCategory(prisma: PrismaClient, tour: SeedTour): Promise<void> {
  const categoryId = requireCategoryId(tour.categoryFr);
  await prisma.tourCategory.upsert({
    where: { tourId_categoryId: { tourId: tour.id, categoryId } },
    create: { id: tour.categoryLinkId, tourId: tour.id, categoryId },
    update: {},
  });
}

async function upsertScene(
  prisma: PrismaClient,
  tourId: string,
  scene: SeedScene,
  createdById: string,
): Promise<void> {
  const data = {
    tourId,
    title: localizedToJson(scene.title),
    caption: localizedToJson(scene.caption),
    panoramaAssetId: scene.panorama.id,
    initialYaw: 0,
    initialPitch: 0,
    initialZoom: 50,
    weight: scene.weight,
    deletedAt: null,
    createdById,
  };
  await prisma.scene.upsert({
    where: { id: scene.id },
    create: { id: scene.id, ...data },
    update: data,
  });
}

async function upsertHotspot(
  prisma: PrismaClient,
  sceneId: string,
  hotspot: SeedHotspot,
  createdById: string,
): Promise<void> {
  const data = {
    sceneId,
    type: toPrismaHotspotType(hotspot.type),
    yaw: hotspot.yaw,
    pitch: hotspot.pitch,
    label: localizedToJson(hotspot.label),
    targetSceneId: hotspot.targetSceneId,
    targetTourId: hotspot.targetTourId,
    targetTourSceneId: hotspot.targetTourSceneId,
    body: Prisma.DbNull,
    url: null,
    mediaAssetIds: [],
    icon: toPrismaIcon(hotspot.type),
    arrivalYaw: null,
    createdById,
  };
  await prisma.hotspot.upsert({
    where: { id: hotspot.id },
    create: { id: hotspot.id, ...data },
    update: data,
  });
}

function requireCityId(nameFr: string): string {
  const city = SEED_CITIES.find((item) => item.name.fr === nameFr);
  if (city === undefined) {
    throw new Error(`Ville de démonstration absente du seed catalogue : ${nameFr}`);
  }
  return city.id;
}

function requireCategoryId(nameFr: string): string {
  const category = SEED_CATEGORIES.find((item) => item.name.fr === nameFr);
  if (category === undefined) {
    throw new Error(`Catégorie de démonstration absente du seed catalogue : ${nameFr}`);
  }
  return category.id;
}

function toPrismaKind(kind: AssetKind): PrismaAssetKind {
  switch (kind) {
    case AssetKind.PANORAMA:
      return PrismaAssetKind.PANORAMA;
    case AssetKind.IMAGE:
      return PrismaAssetKind.IMAGE;
    case AssetKind.AUDIO:
    case AssetKind.VIDEO:
      throw new Error(`Le seed de visites n'écrit pas de média ${kind}.`);
  }
}

function toPrismaStatus(status: ProcessingStatus): PrismaProcessingStatus {
  if (status !== ProcessingStatus.READY) {
    throw new Error("Le seed de visites n'écrit que des médias READY.");
  }
  return PrismaProcessingStatus.READY;
}

function toPrismaTourStatus(status: TourStatus): PrismaTourStatus {
  if (status !== TourStatus.PUBLISHED) {
    throw new Error("Le seed de visites n'écrit que des visites publiées.");
  }
  return PrismaTourStatus.PUBLISHED;
}

function toPrismaHotspotType(
  type: HotspotType.SCENE_LINK | HotspotType.TOUR_LINK,
): PrismaHotspotType {
  switch (type) {
    case HotspotType.SCENE_LINK:
      return PrismaHotspotType.SCENE_LINK;
    case HotspotType.TOUR_LINK:
      return PrismaHotspotType.TOUR_LINK;
  }
}

function toPrismaIcon(type: HotspotType.SCENE_LINK | HotspotType.TOUR_LINK): PrismaHotspotIcon {
  switch (type) {
    case HotspotType.SCENE_LINK:
      return PrismaHotspotIcon.ARROW;
    case HotspotType.TOUR_LINK:
      return PrismaHotspotIcon.PORTAL;
  }
}
