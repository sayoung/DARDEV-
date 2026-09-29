import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HotspotIcon, HotspotType, type HotspotCreate } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  HOTSPOT_NOT_FOUND,
  HOTSPOT_NOT_FOUND_MESSAGE,
  MEDIA_ASSET_NOT_FOUND,
  MEDIA_ASSET_NOT_FOUND_MESSAGE,
  SCENE_LINK_FOREIGN,
  SCENE_LINK_FOREIGN_MESSAGE,
  SCENE_LINK_SELF,
  SCENE_LINK_SELF_MESSAGE,
  SCENE_LINK_TARGET_MISSING,
  SCENE_LINK_TARGET_MISSING_MESSAGE,
  SCENE_NOT_FOUND,
  SCENE_NOT_FOUND_MESSAGE,
  TOUR_LINK_SCENE_FOREIGN,
  TOUR_LINK_SCENE_FOREIGN_MESSAGE,
  TOUR_LINK_SELF,
  TOUR_LINK_SELF_MESSAGE,
  TOUR_LINK_TARGET_MISSING,
  TOUR_LINK_TARGET_MISSING_MESSAGE,
} from './catalog.errors.js';
import { HotspotsService } from './hotspots.service.js';

const TOUR_A = '01990000-0000-7000-8000-000000000006';
const TOUR_B = '01990000-0000-7000-8000-00000000000b';
const TOUR_GONE = '01990000-0000-7000-8000-00000000000c';
const SCENE_A = '01990000-0000-7000-8000-000000000021';
const SCENE_B = '01990000-0000-7000-8000-000000000022';
const SCENE_C = '01990000-0000-7000-8000-000000000023';
const SCENE_DELETED = '01990000-0000-7000-8000-000000000024';
const SCENE_ON_GONE = '01990000-0000-7000-8000-000000000025';
const SCENE_B_DELETED = '01990000-0000-7000-8000-000000000026';
const USER_ID = '01990000-0000-7000-8000-000000000009';
const MEDIA_ID = '01990000-0000-7000-8000-000000000004';
const MEDIA_B = '01990000-0000-7000-8000-000000000014';
const UNKNOWN_ID = '01990000-0000-7000-8000-0000000000aa';

interface StoredTour {
  id: string;
  deletedAt: Date | null;
  contentVersion: number;
}

interface StoredScene {
  id: string;
  tourId: string;
  deletedAt: Date | null;
}

interface StoredHotspot {
  id: string;
  sceneId: string;
  type: string;
  yaw: number;
  pitch: number;
  label: Prisma.InputJsonValue;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  body: Prisma.InputJsonValue | null;
  mediaAssetIds: string[];
  url: string | null;
  icon: string;
  arrivalYaw: number | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SceneWhere {
  id?: string;
  tourId?: string;
  deletedAt?: null;
}

function harness(): {
  service: HotspotsService;
  tours: Map<string, StoredTour>;
  scenes: Map<string, StoredScene>;
  hotspots: Map<string, StoredHotspot>;
  setCreatedAt: (id: string, at: Date) => void;
  failNextCreate: (error: Error, beforeReject?: () => void) => void;
  failNextUpdate: (error: Error, beforeReject?: () => void) => void;
} {
  const tours = new Map<string, StoredTour>([
    [TOUR_A, { id: TOUR_A, deletedAt: null, contentVersion: 1 }],
    [TOUR_B, { id: TOUR_B, deletedAt: null, contentVersion: 1 }],
    [TOUR_GONE, { id: TOUR_GONE, deletedAt: new Date(), contentVersion: 1 }],
  ]);
  const scenes = new Map<string, StoredScene>([
    [SCENE_A, { id: SCENE_A, tourId: TOUR_A, deletedAt: null }],
    [SCENE_B, { id: SCENE_B, tourId: TOUR_A, deletedAt: null }],
    [SCENE_C, { id: SCENE_C, tourId: TOUR_B, deletedAt: null }],
    [SCENE_DELETED, { id: SCENE_DELETED, tourId: TOUR_A, deletedAt: new Date() }],
    [SCENE_ON_GONE, { id: SCENE_ON_GONE, tourId: TOUR_GONE, deletedAt: null }],
    [SCENE_B_DELETED, { id: SCENE_B_DELETED, tourId: TOUR_B, deletedAt: new Date() }],
  ]);
  const assets = new Set<string>([MEDIA_ID, MEDIA_B]);
  const hotspots = new Map<string, StoredHotspot>();
  let seq = 0x100;
  let createError: Error | null = null;
  let beforeCreateReject: (() => void) | null = null;
  let updateError: Error | null = null;
  let beforeUpdateReject: (() => void) | null = null;

  function nextId(): string {
    seq += 1;
    return `01990000-0000-7000-8000-${seq.toString(16).padStart(12, '0')}`;
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
      findMany: ({ where }: { where: { id: { in: string[] } } }): Promise<{ id: string }[]> =>
        Promise.resolve(where.id.in.filter((id) => assets.has(id)).map((id) => ({ id }))),
    },
    tour: {
      findFirst: ({
        where,
      }: {
        where: { id: string; deletedAt?: null };
      }): Promise<{ id: string } | null> => {
        const tour = tours.get(where.id);
        if (tour === undefined || tour.deletedAt !== null) {
          return Promise.resolve(null);
        }
        return Promise.resolve({ id: tour.id });
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { contentVersion?: { increment: number } };
      }): Promise<{ id: string }> => {
        const tour = tours.get(where.id);
        if (tour === undefined) {
          return Promise.reject(missingRecord());
        }
        if (data.contentVersion !== undefined) {
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
      }): Promise<{
        id: string;
        tourId: string;
        deletedAt: Date | null;
        tour: { deletedAt: Date | null };
      } | null> => {
        const scene = [...scenes.values()].find((row) => matches(row, where));
        if (scene === undefined) {
          return Promise.resolve(null);
        }
        const tour = tours.get(scene.tourId);
        return Promise.resolve({
          id: scene.id,
          tourId: scene.tourId,
          deletedAt: scene.deletedAt,
          tour: { deletedAt: tour === undefined ? new Date() : tour.deletedAt },
        });
      },
    },
    hotspot: {
      findFirst: ({ where }: { where: { id: string } }): Promise<StoredHotspot | null> =>
        Promise.resolve(hotspots.get(where.id) ?? null),
      findMany: ({
        where,
        orderBy,
      }: {
        where: { sceneId: string };
        orderBy?: { createdAt?: 'asc' | 'desc' };
      }): Promise<StoredHotspot[]> => {
        const rows = [...hotspots.values()]
          .filter((row) => row.sceneId === where.sceneId)
          .sort((left, right) => {
            const diff = left.createdAt.getTime() - right.createdAt.getTime();
            return orderBy?.createdAt === 'desc' ? -diff : diff;
          });
        return Promise.resolve(rows);
      },
      create: ({
        data,
      }: {
        data: Omit<StoredHotspot, 'id' | 'createdAt' | 'updatedAt'>;
      }): Promise<{ id: string }> => {
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
        const row: StoredHotspot = {
          id,
          sceneId: data.sceneId,
          type: data.type,
          yaw: data.yaw,
          pitch: data.pitch,
          label: data.label,
          targetSceneId: data.targetSceneId,
          targetTourId: data.targetTourId,
          targetTourSceneId: data.targetTourSceneId,
          body: readBody(data.body),
          mediaAssetIds: [...data.mediaAssetIds],
          url: data.url,
          icon: data.icon,
          arrivalYaw: data.arrivalYaw,
          createdById: data.createdById,
          createdAt,
          updatedAt: createdAt,
        };
        hotspots.set(id, row);
        return Promise.resolve({ id });
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          type: string;
          yaw: number;
          pitch: number;
          label: Prisma.InputJsonValue;
          icon: string;
          arrivalYaw: number | null;
          targetSceneId: string | null;
          targetTourId: string | null;
          targetTourSceneId: string | null;
          body: unknown;
          mediaAssetIds: string[];
          url: string | null;
        };
      }): Promise<{ id: string }> => {
        const row = hotspots.get(where.id);
        if (row === undefined) {
          return Promise.reject(missingRecord());
        }
        if (updateError !== null) {
          const error = updateError;
          const before = beforeUpdateReject;
          updateError = null;
          beforeUpdateReject = null;
          before?.();
          return Promise.reject(error);
        }
        row.type = data.type;
        row.yaw = data.yaw;
        row.pitch = data.pitch;
        row.label = data.label;
        row.icon = data.icon;
        row.arrivalYaw = data.arrivalYaw;
        row.targetSceneId = data.targetSceneId;
        row.targetTourId = data.targetTourId;
        row.targetTourSceneId = data.targetTourSceneId;
        row.body = readBody(data.body);
        row.mediaAssetIds = [...data.mediaAssetIds];
        row.url = data.url;
        row.updatedAt = new Date(row.updatedAt.getTime() + 60_000);
        return Promise.resolve({ id: row.id });
      },
      delete: ({ where }: { where: { id: string } }): Promise<{ id: string }> => {
        if (!hotspots.delete(where.id)) {
          return Promise.reject(missingRecord());
        }
        return Promise.resolve({ id: where.id });
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(prisma),
  };

  return {
    service: new HotspotsService(prisma as unknown as PrismaService),
    tours,
    scenes,
    hotspots,
    setCreatedAt: (id: string, at: Date) => {
      const row = hotspots.get(id);
      if (row === undefined) {
        throw new Error('hotspot absent');
      }
      row.createdAt = at;
    },
    failNextCreate: (error: Error, beforeReject?: () => void) => {
      createError = error;
      beforeCreateReject = beforeReject ?? null;
    },
    failNextUpdate: (error: Error, beforeReject?: () => void) => {
      updateError = error;
      beforeUpdateReject = beforeReject ?? null;
    },
  };
}

function sceneLink(targetSceneId: string): HotspotCreate {
  return {
    type: HotspotType.SCENE_LINK,
    yaw: 0.4,
    pitch: -0.1,
    label: { fr: 'Vers le jardin' },
    targetSceneId,
    icon: HotspotIcon.ARROW,
  };
}

function tourLink(targetTourId: string, targetTourSceneId?: string): HotspotCreate {
  return {
    type: HotspotType.TOUR_LINK,
    yaw: 0,
    pitch: 0,
    label: { fr: 'Autre visite' },
    targetTourId,
    ...(targetTourSceneId === undefined ? {} : { targetTourSceneId }),
    icon: HotspotIcon.PORTAL,
  };
}

async function expectRefusal(
  run: () => Promise<unknown>,
  status: number,
  code: string,
  message: string,
): Promise<void> {
  const error = await run().then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(HttpException);
  if (!(error instanceof HttpException)) {
    return;
  }
  expect(error.getStatus()).toBe(status);
  expect(error.getResponse()).toEqual({ error: { code, message } });
}

function readBody(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === Prisma.DbNull || value === Prisma.JsonNull) {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  const json: { [key: string]: Prisma.InputJsonValue } = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      json[key] = entry;
    }
  }
  return json;
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

describe('HotspotsService', () => {
  it('crée un SCENE_LINK et liste par date de création', async () => {
    const { service, tours, hotspots, setCreatedAt } = harness();
    const created = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    expect(created).toMatchObject({
      sceneId: SCENE_A,
      type: HotspotType.SCENE_LINK,
      yaw: 0.4,
      pitch: -0.1,
      label: { fr: 'Vers le jardin' },
      targetSceneId: SCENE_B,
      targetTourId: null,
      targetTourSceneId: null,
      body: null,
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: HotspotIcon.ARROW,
    });
    expect(created.createdAt).toBe(created.updatedAt);
    expect(hotspots.get(created.id)?.createdById).toBe(USER_ID);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(2);
    expect(tours.get(TOUR_B)?.contentVersion).toBe(1);

    const later = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    setCreatedAt(later.id, new Date(Date.UTC(2020, 0, 1)));
    await service.create(SCENE_B, sceneLink(SCENE_A), USER_ID);
    const listed = await service.list(SCENE_A);
    expect(listed.map((item) => item.id)).toEqual([later.id, created.id]);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(4);
  });

  it('accepte un TOUR_LINK vers une visite en brouillon', async () => {
    const { service, tours } = harness();
    const created = await service.create(SCENE_A, tourLink(TOUR_B, SCENE_C), USER_ID);
    expect(created.targetTourId).toBe(TOUR_B);
    expect(created.targetTourSceneId).toBe(SCENE_C);
    expect(created.targetSceneId).toBeNull();
    expect(created.icon).toBe(HotspotIcon.PORTAL);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(2);
    expect(tours.get(TOUR_B)?.contentVersion).toBe(1);

    const withoutScene = await service.create(SCENE_A, tourLink(TOUR_B), USER_ID);
    expect(withoutScene.targetTourSceneId).toBeNull();
  });

  it('crée un hotspot INFO, MEDIA ou URL', async () => {
    const { service, hotspots } = harness();
    const info = await service.create(
      SCENE_A,
      {
        type: HotspotType.INFO,
        yaw: 0,
        pitch: 0,
        label: { fr: 'Notice' },
        body: { fr: 'Texte', ar: 'نص' },
        icon: HotspotIcon.INFO,
      },
      USER_ID,
    );
    expect(info.body).toEqual({ fr: 'Texte', ar: 'نص' });
    expect(info.url).toBeNull();
    expect(info.mediaAssetIds).toEqual([]);

    const media = await service.create(
      SCENE_A,
      {
        type: HotspotType.MEDIA,
        yaw: 1,
        pitch: 0,
        label: { fr: 'Photo' },
        mediaAssetIds: [MEDIA_ID, MEDIA_B],
        icon: HotspotIcon.PHOTO,
      },
      USER_ID,
    );
    expect(media.mediaAssetIds).toEqual([MEDIA_ID, MEDIA_B]);
    expect(hotspots.get(media.id)?.mediaAssetIds).toEqual([MEDIA_ID, MEDIA_B]);

    const url = await service.create(
      SCENE_A,
      {
        type: HotspotType.URL,
        yaw: 0,
        pitch: 0.2,
        label: { fr: 'Site' },
        url: 'https://example.com/visite',
        arrivalYaw: 1,
        icon: HotspotIcon.INFO,
      },
      USER_ID,
    );
    expect(url.url).toBe('https://example.com/visite');
    expect(url.arrivalYaw).toBe(1);
    expect(url.body).toBeNull();
  });

  it('répond 422 SCENE_LINK_TARGET_MISSING si la cible est absente ou supprimée', async () => {
    const { service, hotspots, tours } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(UNKNOWN_ID), USER_ID),
      422,
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_TARGET_MISSING_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_DELETED), USER_ID),
      422,
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_TARGET_MISSING_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_B_DELETED), USER_ID),
      422,
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_TARGET_MISSING_MESSAGE,
    );
    expect(hotspots.size).toBe(0);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(1);
  });

  it('répond 422 SCENE_LINK_SELF', async () => {
    const { service, hotspots } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_A), USER_ID),
      422,
      SCENE_LINK_SELF,
      SCENE_LINK_SELF_MESSAGE,
    );
    expect(hotspots.size).toBe(0);
  });

  it('répond 422 SCENE_LINK_FOREIGN', async () => {
    const { service } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_C), USER_ID),
      422,
      SCENE_LINK_FOREIGN,
      SCENE_LINK_FOREIGN_MESSAGE,
    );
  });

  it('répond 422 TOUR_LINK_TARGET_MISSING si la visite est absente ou supprimée', async () => {
    const { service, hotspots } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(UNKNOWN_ID), USER_ID),
      422,
      TOUR_LINK_TARGET_MISSING,
      TOUR_LINK_TARGET_MISSING_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(TOUR_GONE), USER_ID),
      422,
      TOUR_LINK_TARGET_MISSING,
      TOUR_LINK_TARGET_MISSING_MESSAGE,
    );
    expect(hotspots.size).toBe(0);
  });

  it('répond 422 TOUR_LINK_SELF', async () => {
    const { service } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(TOUR_A, SCENE_B), USER_ID),
      422,
      TOUR_LINK_SELF,
      TOUR_LINK_SELF_MESSAGE,
    );
  });

  it('répond 422 TOUR_LINK_SCENE_FOREIGN si la scène d’arrivée est hors de la visite cible', async () => {
    const { service } = harness();
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(TOUR_B, SCENE_A), USER_ID),
      422,
      TOUR_LINK_SCENE_FOREIGN,
      TOUR_LINK_SCENE_FOREIGN_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(TOUR_B, UNKNOWN_ID), USER_ID),
      422,
      TOUR_LINK_SCENE_FOREIGN,
      TOUR_LINK_SCENE_FOREIGN_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, tourLink(TOUR_B, SCENE_B_DELETED), USER_ID),
      422,
      TOUR_LINK_SCENE_FOREIGN,
      TOUR_LINK_SCENE_FOREIGN_MESSAGE,
    );
  });

  it('répond 422 MEDIA_ASSET_NOT_FOUND', async () => {
    const { service, hotspots } = harness();
    const media = (ids: string[]): HotspotCreate => ({
      type: HotspotType.MEDIA,
      yaw: 0,
      pitch: 0,
      label: { fr: 'Photo' },
      mediaAssetIds: ids,
      icon: HotspotIcon.PHOTO,
    });
    await expectRefusal(
      () => service.create(SCENE_A, media([UNKNOWN_ID]), USER_ID),
      422,
      MEDIA_ASSET_NOT_FOUND,
      MEDIA_ASSET_NOT_FOUND_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_A, media([MEDIA_ID, UNKNOWN_ID]), USER_ID),
      422,
      MEDIA_ASSET_NOT_FOUND,
      MEDIA_ASSET_NOT_FOUND_MESSAGE,
    );
    expect(hotspots.size).toBe(0);
  });

  it('répond 404 SCENE_NOT_FOUND si la scène parente est absente, supprimée ou d’une visite supprimée', async () => {
    const { service } = harness();
    await expectRefusal(
      () => service.create(UNKNOWN_ID, sceneLink(SCENE_B), USER_ID),
      404,
      SCENE_NOT_FOUND,
      SCENE_NOT_FOUND_MESSAGE,
    );
    await expectRefusal(
      () => service.create(SCENE_DELETED, sceneLink(SCENE_B), USER_ID),
      404,
      SCENE_NOT_FOUND,
      SCENE_NOT_FOUND_MESSAGE,
    );
    await expectRefusal(
      () => service.list(SCENE_ON_GONE),
      404,
      SCENE_NOT_FOUND,
      SCENE_NOT_FOUND_MESSAGE,
    );
  });

  it('relance le contrôle si la cible disparaît pendant l’écriture', async () => {
    const { service, scenes, hotspots, failNextCreate } = harness();
    failNextCreate(foreignKey(), () => {
      const scene = scenes.get(SCENE_B);
      if (scene !== undefined) {
        scene.deletedAt = new Date();
      }
    });
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_B), USER_ID),
      422,
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_TARGET_MISSING_MESSAGE,
    );
    expect(hotspots.size).toBe(0);

    const target = scenes.get(SCENE_B);
    if (target !== undefined) {
      target.deletedAt = null;
    }
    failNextCreate(missingRecord());
    await expectRefusal(
      () => service.create(SCENE_A, sceneLink(SCENE_B), USER_ID),
      404,
      SCENE_NOT_FOUND,
      SCENE_NOT_FOUND_MESSAGE,
    );
  });

  it('passe de SCENE_LINK à INFO et efface les champs des autres types', async () => {
    const { service, tours, hotspots } = harness();
    const created = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    const updated = await service.update(created.id, {
      type: HotspotType.INFO,
      yaw: 0.2,
      pitch: 0.1,
      label: { fr: 'Notice' },
      body: { fr: 'Texte' },
      icon: HotspotIcon.INFO,
    });
    expect(updated).toMatchObject({
      id: created.id,
      sceneId: SCENE_A,
      type: HotspotType.INFO,
      yaw: 0.2,
      pitch: 0.1,
      targetSceneId: null,
      targetTourId: null,
      targetTourSceneId: null,
      body: { fr: 'Texte' },
      url: null,
      arrivalYaw: null,
      mediaAssetIds: [],
      icon: HotspotIcon.INFO,
    });
    expect(updated.updatedAt).not.toBe(created.updatedAt);
    expect(hotspots.get(created.id)?.createdById).toBe(USER_ID);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(3);

    const media = await service.create(
      SCENE_A,
      {
        type: HotspotType.MEDIA,
        yaw: 1,
        pitch: 0,
        label: { fr: 'Photo' },
        mediaAssetIds: [MEDIA_ID, MEDIA_B],
        icon: HotspotIcon.PHOTO,
      },
      USER_ID,
    );
    const asUrl = await service.update(media.id, {
      type: HotspotType.URL,
      yaw: 0,
      pitch: 0,
      label: { fr: 'Site' },
      url: 'https://example.com/visite',
      icon: HotspotIcon.INFO,
    });
    expect(asUrl.mediaAssetIds).toEqual([]);
    expect(asUrl.url).toBe('https://example.com/visite');
    expect(asUrl.body).toBeNull();
    expect(hotspots.get(media.id)?.mediaAssetIds).toEqual([]);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(5);
  });

  it('répond 422 SCENE_LINK_SELF au remplacement sans écrire', async () => {
    const { service, tours, hotspots } = harness();
    const created = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    await expectRefusal(
      () => service.update(created.id, sceneLink(SCENE_A)),
      422,
      SCENE_LINK_SELF,
      SCENE_LINK_SELF_MESSAGE,
    );
    expect(hotspots.get(created.id)?.targetSceneId).toBe(SCENE_B);
    expect(hotspots.get(created.id)?.type).toBe(HotspotType.SCENE_LINK);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(2);
  });

  it('répond 404 HOTSPOT_NOT_FOUND si le hotspot est inconnu ou la scène parente est inactive', async () => {
    const missing = harness();
    await expectRefusal(
      () => missing.service.update(UNKNOWN_ID, infoHotspot()),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
    await expectRefusal(
      () => missing.service.remove(UNKNOWN_ID),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );

    const deletedScene = harness();
    const onScene = await deletedScene.service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    const scene = deletedScene.scenes.get(SCENE_A);
    if (scene !== undefined) {
      scene.deletedAt = new Date();
    }
    await expectRefusal(
      () => deletedScene.service.update(onScene.id, infoHotspot()),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
    await expectRefusal(
      () => deletedScene.service.remove(onScene.id),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
    expect(deletedScene.hotspots.has(onScene.id)).toBe(true);
    expect(deletedScene.tours.get(TOUR_A)?.contentVersion).toBe(2);

    const deletedTour = harness();
    const onTour = await deletedTour.service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    const tour = deletedTour.tours.get(TOUR_A);
    if (tour !== undefined) {
      tour.deletedAt = new Date();
    }
    await expectRefusal(
      () => deletedTour.service.remove(onTour.id),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
    expect(deletedTour.hotspots.has(onTour.id)).toBe(true);
  });

  it('supprime le hotspot et incrémente contentVersion', async () => {
    const { service, tours, hotspots } = harness();
    const created = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    await service.remove(created.id);
    expect(hotspots.has(created.id)).toBe(false);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(3);
    expect(tours.get(TOUR_B)?.contentVersion).toBe(1);
    await expectRefusal(
      () => service.remove(created.id),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
  });

  it('relance le contrôle si la cible disparaît pendant le remplacement', async () => {
    const { service, scenes, hotspots, tours, failNextUpdate } = harness();
    const created = await service.create(SCENE_A, sceneLink(SCENE_B), USER_ID);
    failNextUpdate(foreignKey(), () => {
      const scene = scenes.get(SCENE_B);
      if (scene !== undefined) {
        scene.deletedAt = new Date();
      }
    });
    await expectRefusal(
      () => service.update(created.id, sceneLink(SCENE_B)),
      422,
      SCENE_LINK_TARGET_MISSING,
      SCENE_LINK_TARGET_MISSING_MESSAGE,
    );
    expect(hotspots.get(created.id)?.targetSceneId).toBe(SCENE_B);
    expect(tours.get(TOUR_A)?.contentVersion).toBe(2);

    const target = scenes.get(SCENE_B);
    if (target !== undefined) {
      target.deletedAt = null;
    }
    failNextUpdate(missingRecord(), () => {
      hotspots.delete(created.id);
    });
    await expectRefusal(
      () => service.update(created.id, sceneLink(SCENE_B)),
      404,
      HOTSPOT_NOT_FOUND,
      HOTSPOT_NOT_FOUND_MESSAGE,
    );
  });
});

function infoHotspot(): HotspotCreate {
  return {
    type: HotspotType.INFO,
    yaw: 0,
    pitch: 0,
    label: { fr: 'Notice' },
    body: { fr: 'Texte' },
    icon: HotspotIcon.INFO,
  };
}
