import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SceneCreate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  PANORAMA_ASSET_NOT_FOUND,
  PANORAMA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
  TOUR_NOT_FOUND,
  TOUR_NOT_FOUND_MESSAGE,
} from './catalog.errors.js';
import { ScenesService } from './scenes.service.js';

const TOUR_ID = '01990000-0000-7000-8000-000000000006';
const PANORAMA_ID = '01990000-0000-7000-8000-000000000004';
const PANORAMA_B = '01990000-0000-7000-8000-000000000014';
const USER_ID = '01990000-0000-7000-8000-000000000009';
const UNKNOWN_ID = '01990000-0000-7000-8000-0000000000aa';

const porte: SceneCreate = {
  title: { fr: 'La porte' },
  panoramaAssetId: PANORAMA_ID,
  initialYaw: 0,
  initialPitch: 0,
  initialZoom: 50,
  weight: 0,
};

interface StoredTour {
  id: string;
  startSceneId: string | null;
  contentVersion: number;
  deletedAt: Date | null;
}

interface StoredScene {
  id: string;
  tourId: string;
  title: Prisma.InputJsonValue;
  caption: Prisma.InputJsonValue | null;
  panoramaAssetId: string;
  initialYaw: number;
  initialPitch: number;
  initialZoom: number;
  weight: number;
  deletedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  hotspotCount: number;
}

interface SceneWhere {
  id?: string;
  tourId?: string;
  deletedAt?: null;
}

function harness(): {
  service: ScenesService;
  tours: Map<string, StoredTour>;
  scenes: Map<string, StoredScene>;
  assets: Set<string>;
  deleteTour: (id: string) => void;
  limitTourReads: (max: number) => void;
  failNextCreate: (error: Error, beforeReject?: () => void) => void;
  failNextSceneUpdate: (error: Error) => void;
  setHotspots: (id: string, count: number) => void;
  setCreatedAt: (id: string, at: Date) => void;
} {
  const tours = new Map<string, StoredTour>([
    [TOUR_ID, { id: TOUR_ID, startSceneId: null, contentVersion: 1, deletedAt: null }],
  ]);
  const scenes = new Map<string, StoredScene>();
  const assets = new Set<string>([PANORAMA_ID, PANORAMA_B]);
  let seq = 100;
  let tourReads = 0;
  let tourReadLimit = Number.POSITIVE_INFINITY;
  let createError: Error | null = null;
  let beforeCreateReject: (() => void) | null = null;
  let sceneUpdateError: Error | null = null;

  function nextId(): string {
    seq += 1;
    return `01990000-0000-7000-8000-${seq.toString(16).padStart(12, '0')}`;
  }

  function activeTour(id: string): StoredTour | undefined {
    const tour = tours.get(id);
    if (tour === undefined || tour.deletedAt !== null) {
      return undefined;
    }
    tourReads += 1;
    if (tourReads > tourReadLimit) {
      return undefined;
    }
    return tour;
  }

  function view(scene: StoredScene): StoredScene & {
    tour: { deletedAt: Date | null };
    _count: { hotspots: number };
  } {
    const tour = tours.get(scene.tourId);
    return {
      ...scene,
      tour: { deletedAt: tour === undefined ? new Date() : tour.deletedAt },
      _count: { hotspots: scene.hotspotCount },
    };
  }

  function matches(scene: StoredScene, where: SceneWhere): boolean {
    if (where.id !== undefined && scene.id !== where.id) {
      return false;
    }
    if (where.tourId !== undefined && scene.tourId !== where.tourId) {
      return false;
    }
    if (where.deletedAt === null && scene.deletedAt !== null) {
      return false;
    }
    return true;
  }

  const prisma = {
    asset: {
      findUnique: ({ where }: { where: { id: string } }): Promise<{ id: string } | null> =>
        Promise.resolve(assets.has(where.id) ? { id: where.id } : null),
    },
    tour: {
      findFirst: ({
        where,
      }: {
        where: { id: string };
      }): Promise<{ id: string; startSceneId: string | null } | null> => {
        const tour = activeTour(where.id);
        return Promise.resolve(
          tour === undefined ? null : { id: tour.id, startSceneId: tour.startSceneId },
        );
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
        if ('startSceneId' in data) {
          tour.startSceneId = data.startSceneId === null ? null : readString(data.startSceneId);
        }
        if (isRecord(data.contentVersion) && typeof data.contentVersion.increment === 'number') {
          tour.contentVersion += data.contentVersion.increment;
        }
        return Promise.resolve({ id: tour.id });
      },
    },
    scene: {
      findFirst: ({
        where,
      }: {
        where: SceneWhere;
      }): Promise<ReturnType<typeof view> | null> => {
        const scene = [...scenes.values()].find((row) => matches(row, where));
        return Promise.resolve(scene === undefined ? null : view(scene));
      },
      findMany: ({
        where,
        orderBy,
      }: {
        where: SceneWhere;
        orderBy: { weight?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }[];
      }): Promise<ReturnType<typeof view>[]> => {
        const rows = [...scenes.values()]
          .filter((scene) => matches(scene, where))
          .sort((left, right) => compareScenes(left, right, orderBy));
        return Promise.resolve(rows.map((scene) => view(scene)));
      },
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
        const createdAt = new Date(Date.UTC(2026, 8, 29, 0, 0, seq));
        const scene: StoredScene = {
          id,
          tourId: readString(data.tourId),
          title: readJsonRequired(data.title),
          caption: readJson(data.caption),
          panoramaAssetId: readString(data.panoramaAssetId),
          initialYaw: readNumber(data.initialYaw),
          initialPitch: readNumber(data.initialPitch),
          initialZoom: readNumber(data.initialZoom),
          weight: readNumber(data.weight),
          deletedAt: null,
          createdById: readString(data.createdById),
          createdAt,
          updatedAt: createdAt,
          hotspotCount: 0,
        };
        scenes.set(id, scene);
        return Promise.resolve({ id });
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<{ id: string }> => {
        if (sceneUpdateError !== null) {
          const error = sceneUpdateError;
          sceneUpdateError = null;
          return Promise.reject(error);
        }
        const scene = scenes.get(where.id);
        if (scene === undefined) {
          return Promise.reject(missingRecord());
        }
        applyScenePatch(scene, data);
        return Promise.resolve({ id: scene.id });
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(prisma),
  };

  return {
    service: new ScenesService(prisma as unknown as PrismaService),
    tours,
    scenes,
    assets,
    deleteTour: (id: string) => {
      const tour = tours.get(id);
      if (tour === undefined) {
        throw new Error('visite absente');
      }
      tour.deletedAt = new Date();
    },
    limitTourReads: (max: number) => {
      tourReadLimit = max;
    },
    failNextCreate: (error: Error, beforeReject?: () => void) => {
      createError = error;
      beforeCreateReject = beforeReject ?? null;
    },
    failNextSceneUpdate: (error: Error) => {
      sceneUpdateError = error;
    },
    setHotspots: (id: string, count: number) => {
      const scene = scenes.get(id);
      if (scene === undefined) {
        throw new Error('scène absente');
      }
      scene.hotspotCount = count;
    },
    setCreatedAt: (id: string, at: Date) => {
      const scene = scenes.get(id);
      if (scene === undefined) {
        throw new Error('scène absente');
      }
      scene.createdAt = at;
    },
  };
}

function applyScenePatch(scene: StoredScene, data: Record<string, unknown>): void {
  if ('title' in data) {
    scene.title = readJsonRequired(data.title);
  }
  if ('caption' in data) {
    scene.caption = readJson(data.caption);
  }
  if ('panoramaAssetId' in data) {
    scene.panoramaAssetId = readString(data.panoramaAssetId);
  }
  if ('initialYaw' in data) {
    scene.initialYaw = readNumber(data.initialYaw);
  }
  if ('initialPitch' in data) {
    scene.initialPitch = readNumber(data.initialPitch);
  }
  if ('initialZoom' in data) {
    scene.initialZoom = readNumber(data.initialZoom);
  }
  if ('weight' in data) {
    scene.weight = readNumber(data.weight);
  }
  if (data.deletedAt instanceof Date) {
    scene.deletedAt = data.deletedAt;
  }
  scene.updatedAt = new Date(scene.updatedAt.getTime() + 1000);
}

function compareScenes(
  left: StoredScene,
  right: StoredScene,
  orderBy: { weight?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }[],
): number {
  for (const key of orderBy) {
    if (key.weight !== undefined && left.weight !== right.weight) {
      const diff = left.weight - right.weight;
      return key.weight === 'asc' ? diff : -diff;
    }
    if (key.createdAt !== undefined && left.createdAt.getTime() !== right.createdAt.getTime()) {
      const diff = left.createdAt.getTime() - right.createdAt.getTime();
      return key.createdAt === 'asc' ? diff : -diff;
    }
  }
  return 0;
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

function readNumber(value: unknown): number {
  if (typeof value !== 'number') {
    throw new Error('nombre attendu');
  }
  return value;
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

describe('ScenesService', () => {
  it('fait de la première scène la scène de départ', async () => {
    const { service, tours, scenes } = harness();
    const created = await service.create(TOUR_ID, porte, USER_ID);
    expect(created.tourId).toBe(TOUR_ID);
    expect(created.title).toEqual({ fr: 'La porte' });
    expect(created.caption).toBeUndefined();
    expect(created.initialYaw).toBe(0);
    expect(created.initialPitch).toBe(0);
    expect(created.initialZoom).toBe(50);
    expect(created.hotspotCount).toBe(0);
    expect(created.createdAt).toBe(created.updatedAt);
    expect(scenes.get(created.id)?.createdById).toBe(USER_ID);
    expect(tours.get(TOUR_ID)?.startSceneId).toBe(created.id);
    expect(tours.get(TOUR_ID)?.contentVersion).toBe(2);

    const second = await service.create(
      TOUR_ID,
      { ...porte, title: { fr: 'Le jardin' }, weight: 1 },
      USER_ID,
    );
    expect(tours.get(TOUR_ID)?.startSceneId).toBe(created.id);
    expect(second.id).not.toBe(created.id);
    expect(tours.get(TOUR_ID)?.contentVersion).toBe(3);
    expect(await service.get(created.id)).toEqual(created);
  });

  it('trie par poids puis par date et ignore les scènes supprimées', async () => {
    const { service, setHotspots, setCreatedAt } = harness();
    const heavy = await service.create(
      TOUR_ID,
      { ...porte, title: { fr: 'Remparts' }, weight: 2 },
      USER_ID,
    );
    const olderInserted = await service.create(
      TOUR_ID,
      { ...porte, title: { fr: 'Porte' }, weight: 0 },
      USER_ID,
    );
    const newerInserted = await service.create(
      TOUR_ID,
      { ...porte, title: { fr: 'Jardin' }, weight: 0 },
      USER_ID,
    );
    setCreatedAt(newerInserted.id, new Date(Date.UTC(2020, 0, 1)));
    setHotspots(newerInserted.id, 3);

    const listed = await service.list(TOUR_ID);
    expect(listed.map((scene) => scene.id)).toEqual([newerInserted.id, olderInserted.id, heavy.id]);
    expect(listed[0]?.hotspotCount).toBe(3);

    await service.remove(newerInserted.id);
    const after = await service.list(TOUR_ID);
    expect(after.map((scene) => scene.id)).toEqual([olderInserted.id, heavy.id]);
  });

  it('répond 422 si le panorama est inconnu et n’écrit rien', async () => {
    const { service, scenes, tours } = harness();
    await expect(
      readHttp(service.create(TOUR_ID, { ...porte, panoramaAssetId: UNKNOWN_ID }, USER_ID)),
    ).resolves.toEqual({
      status: 422,
      code: PANORAMA_ASSET_NOT_FOUND,
      message: PANORAMA_ASSET_NOT_FOUND_MESSAGE,
    });
    expect(scenes.size).toBe(0);
    expect(tours.get(TOUR_ID)?.contentVersion).toBe(1);
    expect(tours.get(TOUR_ID)?.startSceneId).toBeNull();
  });

  it('traduit une clé étrangère apparue après la vérification en 422', async () => {
    const { service, assets, scenes, failNextCreate } = harness();
    failNextCreate(foreignKey(), () => {
      assets.delete(PANORAMA_ID);
    });
    await expect(readHttp(service.create(TOUR_ID, porte, USER_ID))).resolves.toEqual({
      status: 422,
      code: PANORAMA_ASSET_NOT_FOUND,
      message: PANORAMA_ASSET_NOT_FOUND_MESSAGE,
    });
    expect(scenes.size).toBe(0);
  });

  it('répond 404 pour une visite absente, supprimée, ou disparue dans la transaction', async () => {
    const { service, scenes, deleteTour } = harness();
    await expect(readHttp(service.list(UNKNOWN_ID))).resolves.toEqual({
      status: 404,
      code: TOUR_NOT_FOUND,
      message: TOUR_NOT_FOUND_MESSAGE,
    });
    await expect(readHttp(service.create(UNKNOWN_ID, porte, USER_ID))).resolves.toEqual({
      status: 404,
      code: TOUR_NOT_FOUND,
      message: TOUR_NOT_FOUND_MESSAGE,
    });

    const created = await service.create(TOUR_ID, porte, USER_ID);
    deleteTour(TOUR_ID);
    await expect(readHttp(service.get(created.id))).resolves.toEqual({
      status: 404,
      code: SCENE_NOT_FOUND,
      message: SCENE_NOT_FOUND_MESSAGE,
    });
    await expect(readHttp(service.list(TOUR_ID))).resolves.toEqual({
      status: 404,
      code: TOUR_NOT_FOUND,
      message: TOUR_NOT_FOUND_MESSAGE,
    });

    const fresh = harness();
    fresh.limitTourReads(1);
    await expect(readHttp(fresh.service.create(TOUR_ID, porte, USER_ID))).resolves.toEqual({
      status: 404,
      code: TOUR_NOT_FOUND,
      message: TOUR_NOT_FOUND_MESSAGE,
    });
    expect(fresh.scenes.size).toBe(0);
    expect(scenes.size).toBe(1);
  });

  it('remplace la scène et incrémente contentVersion', async () => {
    const { service, tours, scenes } = harness();
    const created = await service.create(TOUR_ID, { ...porte, caption: { fr: 'Entrée' } }, USER_ID);
    const updated = await service.update(created.id, {
      ...porte,
      title: { fr: 'Le jardin' },
      panoramaAssetId: PANORAMA_B,
      initialYaw: 1,
      initialPitch: -0.2,
      initialZoom: 20,
      weight: 4,
    });
    expect(updated.title).toEqual({ fr: 'Le jardin' });
    expect(updated.caption).toBeUndefined();
    expect(updated.panoramaAssetId).toBe(PANORAMA_B);
    expect(updated.initialYaw).toBe(1);
    expect(updated.initialZoom).toBe(20);
    expect(updated.weight).toBe(4);
    expect(updated.updatedAt).not.toBe(created.createdAt);
    expect(scenes.get(created.id)?.createdById).toBe(USER_ID);
    expect(tours.get(TOUR_ID)?.startSceneId).toBe(created.id);
    expect(tours.get(TOUR_ID)?.contentVersion).toBe(3);
  });

  it('supprime la scène de départ et remet startSceneId à null', async () => {
    const { service, tours, scenes } = harness();
    const start = await service.create(TOUR_ID, porte, USER_ID);
    const other = await service.create(
      TOUR_ID,
      { ...porte, title: { fr: 'Jardin' }, weight: 1 },
      USER_ID,
    );
    await service.remove(start.id);
    expect(scenes.get(start.id)?.deletedAt).toBeInstanceOf(Date);
    expect(tours.get(TOUR_ID)?.startSceneId).toBeNull();
    expect(tours.get(TOUR_ID)?.contentVersion).toBe(4);
    await expect(readHttp(service.get(start.id))).resolves.toEqual({
      status: 404,
      code: SCENE_NOT_FOUND,
      message: SCENE_NOT_FOUND_MESSAGE,
    });
    await expect(readHttp(service.remove(start.id))).resolves.toEqual({
      status: 404,
      code: SCENE_NOT_FOUND,
      message: SCENE_NOT_FOUND_MESSAGE,
    });
    const listed = await service.list(TOUR_ID);
    expect(listed.map((scene) => scene.id)).toEqual([other.id]);

    await service.remove(other.id);
    expect(tours.get(TOUR_ID)?.startSceneId).toBeNull();
  });

  it('répond 404 si la scène disparaît pendant la suppression', async () => {
    const { service, failNextSceneUpdate, scenes } = harness();
    const created = await service.create(TOUR_ID, porte, USER_ID);
    failNextSceneUpdate(missingRecord());
    await expect(readHttp(service.remove(created.id))).resolves.toEqual({
      status: 404,
      code: SCENE_NOT_FOUND,
      message: SCENE_NOT_FOUND_MESSAGE,
    });
    expect(scenes.get(created.id)?.deletedAt).toBeNull();
  });
});

async function readHttp(
  pending: Promise<unknown>,
): Promise<{ status: number; code: string; message: string }> {
  try {
    await pending;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) {
      throw error;
    }
    const body = error.getResponse();
    if (!isRecord(body) || !isRecord(body.error)) {
      throw new Error('corps inattendu');
    }
    const code = body.error.code;
    const message = body.error.message;
    if (typeof code !== 'string' || typeof message !== 'string') {
      throw new Error('corps inattendu');
    }
    return { status: error.getStatus(), code, message };
  }
  throw new Error('exception absente');
}
