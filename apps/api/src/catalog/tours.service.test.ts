import { HttpException, NotFoundException } from '@nestjs/common';
import { Prisma, TourStatus as PrismaTourStatus } from '@prisma/client';
import { TourStatus, type TourCreate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  CATEGORY_NOT_FOUND,
  CATEGORY_NOT_FOUND_MESSAGE,
  CITY_NOT_FOUND,
  CITY_NOT_FOUND_MESSAGE,
  COVER_ASSET_NOT_FOUND,
  COVER_ASSET_NOT_FOUND_MESSAGE,
} from './catalog.errors.js';
import { ToursService } from './tours.service.js';

const CITY_ID = '01990000-0000-7000-8000-000000000001';
const CITY_B = '01990000-0000-7000-8000-000000000011';
const CATEGORY_ID = '01990000-0000-7000-8000-000000000002';
const CATEGORY_B = '01990000-0000-7000-8000-000000000012';
const COVER_ID = '01990000-0000-7000-8000-000000000003';
const USER_ID = '01990000-0000-7000-8000-000000000009';
const UNKNOWN_ID = '01990000-0000-7000-8000-0000000000aa';

const kasbah: TourCreate = {
  title: { fr: 'Kasbah des Oudayas', ar: 'قصبة الأوداية', en: 'Oudayas Kasbah' },
  summary: { fr: 'Remparts face à la mer' },
  description: { fr: 'Texte long' },
  cityId: CITY_ID,
  categoryIds: [CATEGORY_ID],
  coverAssetId: COVER_ID,
  durationMinutes: 25,
  lat: 34.02,
  lng: -6.84,
};

const mehdia: TourCreate = {
  title: { fr: 'Plage de Mehdia' },
  summary: { fr: 'Embouchure du Sebou' },
  cityId: CITY_B,
  categoryIds: [CATEGORY_B],
  coverAssetId: COVER_ID,
};

interface Link {
  id: string;
  categoryId: string;
}

interface StoredHotspot {
  id: string;
  type: string;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTour: { title: Prisma.InputJsonValue; deletedAt: Date | null } | null;
}

interface StoredScene {
  id: string;
  tourId: string;
  title: Prisma.InputJsonValue;
  deletedAt: Date | null;
  hotspots: StoredHotspot[];
}

interface StoredTour {
  id: string;
  title: Prisma.InputJsonValue;
  summary: Prisma.InputJsonValue;
  description: Prisma.InputJsonValue | null;
  cityId: string;
  coverAssetId: string;
  durationMinutes: number | null;
  lat: number | null;
  lng: number | null;
  practicalInfo: Prisma.InputJsonValue | null;
  status: PrismaTourStatus;
  publicShare: boolean;
  shareToken: string;
  contentVersion: number;
  deletedAt: Date | null;
  startSceneId: string | null;
  publishedAt: Date | null;
  createdById: string;
  createdAt: Date;
  links: Link[];
  sceneCount: number;
}

interface ListWhere {
  deletedAt?: null;
  status?: string;
  cityId?: string;
  categories?: { some?: { categoryId?: string } };
  title?: { string_contains?: string; mode?: string };
}

function harness(): {
  service: ToursService;
  tours: Map<string, StoredTour>;
  scenes: StoredScene[];
  cities: Set<string>;
  failNextCreate: (error: Error, beforeReject?: () => void) => void;
  sceneCount: (id: string, count: number) => void;
  markPublished: (id: string) => void;
  addScene: (
    tourId: string,
    data: { title: Prisma.InputJsonValue; deletedAt?: Date | null },
  ) => string;
  addHotspot: (
    sceneId: string,
    data: { type: string; targetSceneId?: string | null; targetTourId?: string | null },
  ) => void;
} {
  const tours = new Map<string, StoredTour>();
  const scenes: StoredScene[] = [];
  const cities = new Set<string>([CITY_ID, CITY_B]);
  const categories = new Set<string>([CATEGORY_ID, CATEGORY_B]);
  const assets = new Set<string>([COVER_ID]);
  let seq = 100;
  let createError: Error | null = null;
  let beforeCreateReject: (() => void) | null = null;

  function nextId(): string {
    seq += 1;
    return `01990000-0000-7000-8000-${seq.toString(16).padStart(12, '0')}`;
  }

  function view(tour: StoredTour): StoredTour & {
    categories: { categoryId: string }[];
    _count: { scenes: number };
  } {
    const links = [...tour.links].sort((left, right) => left.id.localeCompare(right.id));
    return {
      ...tour,
      categories: links.map((link) => ({ categoryId: link.categoryId })),
      _count: { scenes: tour.sceneCount },
    };
  }

  function findStored(where: { id?: string; deletedAt?: null }): StoredTour | undefined {
    return [...tours.values()].find((tour) => {
      if (where.id !== undefined && tour.id !== where.id) {
        return false;
      }
      if (where.deletedAt === null && tour.deletedAt !== null) {
        return false;
      }
      return true;
    });
  }

  function matches(tour: StoredTour, where: ListWhere): boolean {
    if (where.deletedAt === null && tour.deletedAt !== null) {
      return false;
    }
    if (where.status !== undefined && tour.status !== where.status) {
      return false;
    }
    if (where.cityId !== undefined && tour.cityId !== where.cityId) {
      return false;
    }
    const categoryId = where.categories?.some?.categoryId;
    if (categoryId !== undefined && !tour.links.some((link) => link.categoryId === categoryId)) {
      return false;
    }
    const needle = where.title?.string_contains;
    if (needle !== undefined) {
      const haystack = frenchTitle(tour.title);
      const compare = where.title?.mode === 'insensitive' ? 'lower' : 'raw';
      const left = compare === 'lower' ? haystack.toLowerCase() : haystack;
      const right = compare === 'lower' ? needle.toLowerCase() : needle;
      if (!left.includes(right)) {
        return false;
      }
    }
    return true;
  }

  const prisma = {
    city: {
      findUnique: ({ where }: { where: { id: string } }): Promise<{ id: string } | null> =>
        Promise.resolve(cities.has(where.id) ? { id: where.id } : null),
    },
    category: {
      findMany: ({ where }: { where: { id: { in: string[] } } }): Promise<{ id: string }[]> =>
        Promise.resolve(where.id.in.filter((id) => categories.has(id)).map((id) => ({ id }))),
    },
    asset: {
      findUnique: ({ where }: { where: { id: string } }): Promise<{ id: string } | null> =>
        Promise.resolve(assets.has(where.id) ? { id: where.id } : null),
    },
    scene: {
      findMany: ({
        where,
      }: {
        where: { tourId: string; [key: string]: unknown };
      }): Promise<unknown> => {
        const tourScenes = scenes.filter((s) => s.tourId === where.tourId);
        return Promise.resolve(
          tourScenes.map((s) => ({
            ...s,
            hotspots: s.hotspots.filter(
              (h) => h.type === 'SCENE_LINK' || h.type === 'TOUR_LINK',
            ),
          })),
        );
      },
    },
    tourCategory: {
      create: ({
        data,
      }: {
        data: { tourId: string; categoryId: string };
      }): Promise<{ id: string }> => {
        const tour = tours.get(data.tourId);
        if (tour === undefined) {
          return Promise.reject(foreignKey());
        }
        if (!categories.has(data.categoryId)) {
          return Promise.reject(foreignKey());
        }
        const link = { id: nextId(), categoryId: data.categoryId };
        tour.links.push(link);
        return Promise.resolve(link);
      },
      deleteMany: ({ where }: { where: { tourId: string } }): Promise<{ count: number }> => {
        const tour = tours.get(where.tourId);
        if (tour === undefined) {
          return Promise.resolve({ count: 0 });
        }
        const count = tour.links.length;
        tour.links = [];
        return Promise.resolve({ count });
      },
    },
    tour: {
      findFirst: ({
        where,
      }: {
        where: { id?: string; deletedAt?: null };
      }): Promise<ReturnType<typeof view> | null> => {
        const tour = findStored(where);
        return Promise.resolve(tour === undefined ? null : view(tour));
      },
      findMany: ({
        where,
        skip,
        take,
      }: {
        where: ListWhere;
        skip: number;
        take: number;
      }): Promise<ReturnType<typeof view>[]> => {
        const rows = [...tours.values()]
          .filter((tour) => matches(tour, where))
          .sort((left, right) => {
            const time = right.createdAt.getTime() - left.createdAt.getTime();
            return time === 0 ? left.id.localeCompare(right.id) : time;
          });
        return Promise.resolve(rows.slice(skip, skip + take).map((tour) => view(tour)));
      },
      count: ({ where }: { where: ListWhere }): Promise<number> =>
        Promise.resolve([...tours.values()].filter((tour) => matches(tour, where)).length),
      create: ({ data }: { data: Record<string, unknown> }): Promise<{ id: string }> => {
        if (createError !== null) {
          const error = createError;
          const before = beforeCreateReject;
          createError = null;
          beforeCreateReject = null;
          before?.();
          return Promise.reject(error);
        }
        const id = nextId();
        const tour: StoredTour = {
          id,
          title: readJsonRequired(data.title),
          summary: readJsonRequired(data.summary),
          description: readJson(data.description),
          cityId: readString(data.cityId),
          coverAssetId: readString(data.coverAssetId),
          durationMinutes: readNumber(data.durationMinutes),
          lat: readNumber(data.lat),
          lng: readNumber(data.lng),
          practicalInfo: readJson(data.practicalInfo),
          status: readStatus(data.status),
          publicShare: data.publicShare === true,
          shareToken: readString(data.shareToken),
          contentVersion: 1,
          deletedAt: null,
          startSceneId: null,
          publishedAt: null,
          createdById: readString(data.createdById),
          createdAt: new Date(Date.UTC(2026, 8, 29, 0, 0, seq)),
          links: [],
          sceneCount: 0,
        };
        tours.set(id, tour);
        return Promise.resolve({ id });
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<{ id: string }> => {
        const tour = tours.get(where.id);
        if (tour === undefined) {
          return Promise.reject(missingRecord());
        }
        applyPatch(tour, data);
        return Promise.resolve({ id: tour.id });
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(prisma),
  };

  return {
    service: new ToursService(prisma as unknown as PrismaService),
    tours,
    scenes,
    cities,
    failNextCreate: (error: Error, beforeReject?: () => void) => {
      createError = error;
      beforeCreateReject = beforeReject ?? null;
    },
    sceneCount: (id: string, count: number) => {
      const tour = tours.get(id);
      if (tour === undefined) {
        throw new Error('visite absente');
      }
      tour.sceneCount = count;
    },
    markPublished: (id: string) => {
      const tour = tours.get(id);
      if (tour === undefined) {
        throw new Error('visite absente');
      }
      tour.status = PrismaTourStatus.PUBLISHED;
    },
    addScene: (tourId, data) => {
      const id = nextId();
      scenes.push({
        id,
        tourId,
        title: data.title,
        deletedAt: data.deletedAt ?? null,
        hotspots: [],
      });
      return id;
    },
    addHotspot: (sceneId, data) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (scene === undefined) {
        throw new Error('scène absente');
      }
      const hotspot: StoredHotspot = {
        id: nextId(),
        type: data.type,
        targetSceneId: data.targetSceneId ?? null,
        targetTourId: data.targetTourId ?? null,
        targetTour: null,
      };
      if (data.type === 'TOUR_LINK' && typeof data.targetTourId === 'string') {
        const targetTour = tours.get(data.targetTourId);
        if (targetTour !== undefined) {
          hotspot.targetTour = {
            title: targetTour.title,
            deletedAt: targetTour.deletedAt,
          };
        }
      }
      scene.hotspots.push(hotspot);
    },
  };
}

function applyPatch(tour: StoredTour, data: Record<string, unknown>): void {
  if ('title' in data) {
    tour.title = readJsonRequired(data.title);
  }
  if ('summary' in data) {
    tour.summary = readJsonRequired(data.summary);
  }
  if ('description' in data) {
    tour.description = readJson(data.description);
  }
  if ('cityId' in data) {
    tour.cityId = readString(data.cityId);
  }
  if ('coverAssetId' in data) {
    tour.coverAssetId = readString(data.coverAssetId);
  }
  if ('durationMinutes' in data) {
    tour.durationMinutes = readNumber(data.durationMinutes);
  }
  if ('lat' in data) {
    tour.lat = readNumber(data.lat);
  }
  if ('lng' in data) {
    tour.lng = readNumber(data.lng);
  }
  if ('practicalInfo' in data) {
    tour.practicalInfo = readJson(data.practicalInfo);
  }
  if ('publicShare' in data && typeof data.publicShare === 'boolean') {
    tour.publicShare = data.publicShare;
  }
  if (data.deletedAt instanceof Date) {
    tour.deletedAt = data.deletedAt;
  }
  if (isRecord(data.contentVersion) && typeof data.contentVersion.increment === 'number') {
    tour.contentVersion += data.contentVersion.increment;
  }
}

function readJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === Prisma.DbNull || value === Prisma.JsonNull) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (!isRecord(value)) {
    return null;
  }
  const json: { [key: string]: Prisma.InputJsonValue } = {};
  for (const [key, entry] of Object.entries(value)) {
    const nested = readJson(entry);
    if (nested !== null) {
      json[key] = nested;
    }
  }
  return json;
}

function readJsonRequired(value: unknown): Prisma.InputJsonValue {
  const json = readJson(value);
  if (json === null) {
    throw new Error('json obligatoire absent');
  }
  return json;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('chaîne attendue');
  }
  return value;
}

function readNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'number') {
    throw new Error('nombre attendu');
  }
  return value;
}

function readStatus(value: unknown): PrismaTourStatus {
  if (value === PrismaTourStatus.PUBLISHED) {
    return PrismaTourStatus.PUBLISHED;
  }
  return PrismaTourStatus.DRAFT;
}

function frenchTitle(title: Prisma.InputJsonValue): string {
  const snapshot: unknown = JSON.parse(JSON.stringify(title));
  if (typeof snapshot !== 'object' || snapshot === null || !('fr' in snapshot)) {
    return '';
  }
  const fr = snapshot.fr;
  return typeof fr === 'string' ? fr : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missingRecord(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('missing', {
    code: 'P2025',
    clientVersion: '6.19.3',
  });
}

function foreignKey(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('fk', {
    code: 'P2003',
    clientVersion: '6.19.3',
  });
}

const listAll = { page: 1, pageSize: 20 } as const;

describe('ToursService', () => {
  it('crée une visite en brouillon, sans partage, avec un jeton de 22 caractères', async () => {
    const { service } = harness();
    const created = await service.create(kasbah, USER_ID);
    expect(created.status).toBe(TourStatus.DRAFT);
    expect(created.publicShare).toBe(false);
    expect(created.shareToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(created.createdById).toBe(USER_ID);
    expect(created.contentVersion).toBe(1);
    expect(created.sceneCount).toBe(0);
    expect(created.startSceneId).toBeNull();
    expect(created.publishedAt).toBeNull();
    expect(created.categoryIds).toEqual([CATEGORY_ID]);
    expect(created.description).toEqual({ fr: 'Texte long' });
    expect(created.durationMinutes).toBe(25);
    expect(await service.get(created.id)).toEqual(created);
  });

  it('formate publishedAt en chaîne ISO', async () => {
    const { service, tours } = harness();
    const created = await service.create(kasbah, USER_ID);
    const date = new Date('2026-09-30T10:00:00Z');
    
    const tour = tours.get(created.id);
    if (!tour) throw new Error('Tour introuvable');
    tour.publishedAt = date;

    const response = await service.get(created.id);
    expect(response.publishedAt).toBe('2026-09-30T10:00:00.000Z');
  });

  it('ignore un categoryId répété', async () => {
    const { service } = harness();
    const created = await service.create(
      { ...kasbah, categoryIds: [CATEGORY_ID, CATEGORY_ID] },
      USER_ID,
    );
    expect(created.categoryIds).toEqual([CATEGORY_ID]);
  });

  it('répond 422 si la ville, une catégorie ou la vignette est inconnue', async () => {
    const { service, tours } = harness();
    await expect(
      readReference(service.create({ ...kasbah, cityId: UNKNOWN_ID }, USER_ID)),
    ).resolves.toEqual({
      code: CITY_NOT_FOUND,
      message: CITY_NOT_FOUND_MESSAGE,
    });
    await expect(
      readReference(service.create({ ...kasbah, categoryIds: [UNKNOWN_ID] }, USER_ID)),
    ).resolves.toEqual({
      code: CATEGORY_NOT_FOUND,
      message: CATEGORY_NOT_FOUND_MESSAGE,
    });
    await expect(
      readReference(service.create({ ...kasbah, coverAssetId: UNKNOWN_ID }, USER_ID)),
    ).resolves.toEqual({
      code: COVER_ASSET_NOT_FOUND,
      message: COVER_ASSET_NOT_FOUND_MESSAGE,
    });
    expect(tours.size).toBe(0);
  });

  it('traduit une clé étrangère apparue après la vérification en 422', async () => {
    const { service, cities, failNextCreate } = harness();
    failNextCreate(foreignKey(), () => {
      cities.delete(CITY_ID);
    });
    await expect(readReference(service.create(kasbah, USER_ID))).resolves.toEqual({
      code: CITY_NOT_FOUND,
      message: CITY_NOT_FOUND_MESSAGE,
    });
  });

  it('exclut les visites supprimées et filtre par ville, statut, catégorie et titre', async () => {
    const { service, sceneCount, markPublished } = harness();
    const first = await service.create(kasbah, USER_ID);
    const second = await service.create(mehdia, USER_ID);
    sceneCount(first.id, 2);
    expect((await service.get(first.id)).sceneCount).toBe(2);

    const byCity = await service.list({ ...listAll, cityId: CITY_ID });
    expect(byCity.total).toBe(1);
    expect(byCity.items.map((item) => item.id)).toEqual([first.id]);

    const byCategory = await service.list({ ...listAll, categoryId: CATEGORY_B });
    expect(byCategory.items.map((item) => item.id)).toEqual([second.id]);

    const byTitle = await service.list({ ...listAll, q: '  KASBAH  ' });
    expect(byTitle.items.map((item) => item.id)).toEqual([first.id]);

    const published = await service.list({ ...listAll, status: TourStatus.PUBLISHED });
    expect(published.total).toBe(0);
    markPublished(first.id);
    const after = await service.list({ ...listAll, status: TourStatus.PUBLISHED });
    expect(after.items.map((item) => item.id)).toEqual([first.id]);

    await service.remove(second.id);
    const remaining = await service.list(listAll);
    expect(remaining.items.map((item) => item.id)).toEqual([first.id]);
    expect(remaining.total).toBe(1);
  });

  it('pagine par date de création décroissante', async () => {
    const { service } = harness();
    const first = await service.create(kasbah, USER_ID);
    const second = await service.create(mehdia, USER_ID);
    const page = await service.list({ page: 1, pageSize: 1 });
    expect(page).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(page.items.map((item) => item.id)).toEqual([second.id]);
    const next = await service.list({ page: 2, pageSize: 1 });
    expect(next.items.map((item) => item.id)).toEqual([first.id]);
  });

  it('remplace les catégories et incrémente contentVersion', async () => {
    const { service } = harness();
    const created = await service.create(kasbah, USER_ID);
    const token = created.shareToken;
    const updated = await service.update(created.id, {
      ...mehdia,
      categoryIds: [CATEGORY_B, CATEGORY_ID],
    });
    expect(updated.categoryIds).toEqual([CATEGORY_B, CATEGORY_ID]);
    expect(updated.title.fr).toBe('Plage de Mehdia');
    expect(updated.description).toBeUndefined();
    expect(updated.cityId).toBe(CITY_B);
    expect(updated.contentVersion).toBe(2);
    expect(updated.shareToken).toBe(token);
    expect(updated.publicShare).toBe(false);
    expect(updated.status).toBe(TourStatus.DRAFT);
    expect(updated.createdById).toBe(USER_ID);
  });

  it('met à jour publicShare (à true)', async () => {
    const { service } = harness();
    const created = await service.create(kasbah, USER_ID);
    const updated = await service.update(created.id, {
      ...kasbah,
      publicShare: true,
    });
    expect(updated.publicShare).toBe(true);
  });

  it('ne modifie pas publicShare si absent de la mise à jour', async () => {
    const { service } = harness();
    const created = await service.create(kasbah, USER_ID);
    const update1 = await service.update(created.id, {
      ...kasbah,
      publicShare: true,
    });
    expect(update1.publicShare).toBe(true);
    
    const update2 = await service.update(created.id, {
      ...kasbah,
    });
    expect(update2.publicShare).toBe(true);
  });

  it('répond 404 pour une visite absente ou déjà supprimée', async () => {
    const { service, tours } = harness();
    await expect(service.get(UNKNOWN_ID)).rejects.toBeInstanceOf(NotFoundException);
    const created = await service.create(kasbah, USER_ID);
    await service.remove(created.id);
    expect(tours.get(created.id)?.deletedAt).toBeInstanceOf(Date);
    await expect(service.get(created.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(created.id, kasbah)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(created.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(tours.has(created.id)).toBe(true);
  });

  it('rejette NotFoundException pour une visite inconnue lors de getLinkMap', async () => {
    const { service } = harness();
    await expect(service.getLinkMap(UNKNOWN_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('génère la carte des liens (scène isolée a orphan true)', async () => {
    const { service, addScene, addHotspot, tours } = harness();
    const created = await service.create(kasbah, USER_ID);

    const scene1 = addScene(created.id, { title: { fr: 'Scène 1' } });
    const scene2 = addScene(created.id, { title: { fr: 'Scène isolée' } });
    
    // Test avec startSceneId null
    const mapWithoutStart = await service.getLinkMap(created.id);
    expect(mapWithoutStart.nodes).toContainEqual(expect.objectContaining({ id: scene1, orphan: true }));
    expect(mapWithoutStart.nodes).toContainEqual(expect.objectContaining({ id: scene2, orphan: true }));

    // Test avec startSceneId pointant sur scene1
    const tourObj = tours.get(created.id);
    if (tourObj) tourObj.startSceneId = scene1;
    const mapWithStart = await service.getLinkMap(created.id);
    expect(mapWithStart.nodes).toContainEqual(expect.objectContaining({ id: scene1, orphan: false, isStart: true }));
    expect(mapWithStart.nodes).toContainEqual(expect.objectContaining({ id: scene2, orphan: true, isStart: false }));
    
    // Ajout d'un lien vers une autre visite
    const secondTour = await service.create(mehdia, USER_ID);
    addHotspot(scene1, { type: 'TOUR_LINK', targetTourId: secondTour.id });
    
    const mapWithExternal = await service.getLinkMap(created.id);
    expect(mapWithExternal.nodes).toContainEqual(expect.objectContaining({
      id: secondTour.id,
      kind: 'external',
      label: 'Plage de Mehdia'
    }));
  });

  it('génère la carte des liens : scène A (start) liée à scène B et à une autre visite active', async () => {
    const { service, addScene, addHotspot, tours } = harness();
    const tour1 = await service.create(kasbah, USER_ID);
    const tour2 = await service.create(mehdia, USER_ID);

    const sceneA = addScene(tour1.id, { title: { fr: 'Scène A' } });
    const sceneB = addScene(tour1.id, { title: { fr: 'Scène B' } });
    
    const tourObj = tours.get(tour1.id);
    if (tourObj) tourObj.startSceneId = sceneA;

    addHotspot(sceneA, { type: 'SCENE_LINK', targetSceneId: sceneB });
    addHotspot(sceneA, { type: 'TOUR_LINK', targetTourId: tour2.id });

    const map = await service.getLinkMap(tour1.id);

    expect(map.nodes).toHaveLength(3);
    expect(map.nodes).toContainEqual(expect.objectContaining({
      id: sceneA,
      kind: 'scene',
      label: 'Scène A',
      isStart: true,
      orphan: false,
    }));
    expect(map.nodes).toContainEqual(expect.objectContaining({
      id: sceneB,
      kind: 'scene',
      label: 'Scène B',
      orphan: false,
    }));
    expect(map.nodes).toContainEqual(expect.objectContaining({
      id: tour2.id,
      kind: 'external',
      label: 'Plage de Mehdia',
    }));

    expect(map.edges).toHaveLength(2);
    expect(map.edges).toContainEqual(expect.objectContaining({
      source: sceneA,
      target: sceneB,
      kind: 'scene_link',
    }));
    expect(map.edges).toContainEqual(expect.objectContaining({
      source: sceneA,
      target: tour2.id,
      kind: 'tour_link',
    }));
  });

  it('génère la carte des liens : TOUR_LINK vers une visite supprimée a pour label l\'id de la cible', async () => {
    const { service, addScene, addHotspot } = harness();
    const tour1 = await service.create(kasbah, USER_ID);
    const tour2 = await service.create(mehdia, USER_ID);
    await service.remove(tour2.id);

    const sceneA = addScene(tour1.id, { title: { fr: 'Scène A' } });
    addHotspot(sceneA, { type: 'TOUR_LINK', targetTourId: tour2.id });

    const map = await service.getLinkMap(tour1.id);
    
    expect(map.nodes).toContainEqual(expect.objectContaining({
      id: tour2.id,
      kind: 'external',
      label: tour2.id,
    }));
  });

  it('génère la carte des liens : une scène supprimée n\'apparaît pas dans les nœuds', async () => {
    const { service, addScene } = harness();
    const tour1 = await service.create(kasbah, USER_ID);

    const activeId = addScene(tour1.id, { title: { fr: 'Scène active' } });
    const deletedId = addScene(tour1.id, { title: { fr: 'Scène supprimée' }, deletedAt: new Date() });

    const map = await service.getLinkMap(tour1.id);
    
    expect(map.nodes).toHaveLength(1);
    expect(map.nodes).toContainEqual(expect.objectContaining({ id: activeId }));
    
    const deletedNode = map.nodes.find(n => n.id === deletedId);
    expect(deletedNode).toBeUndefined();
  });
});

async function readReference(
  pending: Promise<unknown>,
): Promise<{ code: string; message: string }> {
  try {
    await pending;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) {
      throw error;
    }
    expect(error.getStatus()).toBe(422);
    const body = error.getResponse();
    if (!isRecord(body) || !isRecord(body.error)) {
      throw new Error('corps 422 inattendu');
    }
    const code = body.error.code;
    const message = body.error.message;
    if (typeof code !== 'string' || typeof message !== 'string') {
      throw new Error('corps 422 inattendu');
    }
    return { code, message };
  }
  throw new Error('réponse 422 absente');
}
