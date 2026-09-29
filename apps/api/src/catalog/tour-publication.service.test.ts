import { HttpException, HttpStatus } from '@nestjs/common';
import {
  HotspotType as PrismaHotspotType,
  ProcessingStatus as PrismaProcessingStatus,
  TourStatus as PrismaTourStatus,
} from '@prisma/client';
import { ValidationIssueCode, type ValidationIssue } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE } from './catalog.errors.js';
import { TourPublicationService } from './tour-publication.service.js';

const VISITE = '01990000-0000-7000-8000-000000000010';
const PORTE = '01990000-0000-7000-8000-000000000021';
const JARDIN = '01990000-0000-7000-8000-000000000022';
const REMPARTS = '01990000-0000-7000-8000-000000000023';
const LINK_PORTE = '01990000-0000-7000-8000-000000000031';
const LINK_JARDIN = '01990000-0000-7000-8000-000000000032';
const UNKNOWN = '01990000-0000-7000-8000-0000000000aa';
const PUBLISHED = '01990000-0000-7000-8000-000000000040';
const LIVING_SCENE = '01990000-0000-7000-8000-000000000041';
const DELETED_SCENE = '01990000-0000-7000-8000-000000000042';
const DRAFT_TARGET = '01990000-0000-7000-8000-000000000043';
const DELETED_TOUR = '01990000-0000-7000-8000-000000000044';
const REMOVED_SCENE = '01990000-0000-7000-8000-000000000046';

const UNREACHABLE = 'Cette scène est inatteignable depuis la scène de départ.';
const PANORAMA = "Le panorama de cette scène n'est pas prêt.";
const TARGET_DELETED = 'La scène cible a été supprimée.';
const UNPUBLISHED = "La visite cible n'est pas publiée.";
const SCENE_FOREIGN = "La scène d'arrivée n'appartient pas à la visite cible.";

interface StoredHotspot {
  id: string;
  type: PrismaHotspotType;
  targetSceneId: string | null;
  targetTourId: string | null;
  targetTourSceneId: string | null;
  createdAt: Date;
}

interface StoredScene {
  id: string;
  tourId: string;
  weight: number;
  deletedAt: Date | null;
  processingStatus: PrismaProcessingStatus;
  createdAt: Date;
  hotspots: StoredHotspot[];
}

interface StoredTour {
  id: string;
  startSceneId: string | null;
  status: PrismaTourStatus;
  deletedAt: Date | null;
}

function harness(): {
  service: TourPublicationService;
  addTour: (tour: StoredTour) => void;
  addScene: (scene: StoredScene) => void;
  addHotspot: (sceneId: string, hotspot: StoredHotspot) => void;
} {
  const tours = new Map<string, StoredTour>();
  const scenes = new Map<string, StoredScene>();

  const prisma = {
    tour: {
      findFirst: (args: {
        where: { id?: string; deletedAt?: null };
        select?: unknown;
      }): Promise<{
        id: string;
        startSceneId: string | null;
        scenes: {
          id: string;
          deletedAt: Date | null;
          panoramaAsset: { processingStatus: PrismaProcessingStatus };
          hotspots: {
            id: string;
            type: PrismaHotspotType;
            targetSceneId: string | null;
            targetTourId: string | null;
            targetTourSceneId: string | null;
          }[];
        }[];
      } | null> => {
        const id = args.where.id;
        const tour = id === undefined ? undefined : tours.get(id);
        if (tour === undefined) {
          return Promise.resolve(null);
        }
        if (args.where.deletedAt === null && tour.deletedAt !== null) {
          return Promise.resolve(null);
        }
        const scenesSelect = readField(args.select, 'scenes');
        return Promise.resolve({
          id: tour.id,
          startSceneId: tour.startSceneId,
          scenes: projectScenes(scenes, tour.id, scenesSelect),
        });
      },
      findMany: (args: {
        where: { id?: { in?: readonly string[] }; deletedAt?: null };
        select?: unknown;
      }): Promise<
        {
          id: string;
          status: PrismaTourStatus;
          deletedAt: Date | null;
          scenes: { id: string }[];
        }[]
      > => {
        const ids = args.where.id?.in ?? [];
        const rows = [];
        for (const id of ids) {
          const tour = tours.get(id);
          if (tour === undefined) {
            continue;
          }
          if (args.where.deletedAt === null && tour.deletedAt !== null) {
            continue;
          }
          rows.push({
            id: tour.id,
            status: tour.status,
            deletedAt: tour.deletedAt,
            scenes: projectSceneIds(scenes, tour.id, readField(args.select, 'scenes')),
          });
        }
        return Promise.resolve(rows);
      },
    },
  };

  return {
    service: new TourPublicationService(prisma as unknown as PrismaService),
    addTour: (tour) => {
      tours.set(tour.id, tour);
    },
    addScene: (scene) => {
      scenes.set(scene.id, scene);
    },
    addHotspot: (sceneId, hotspot) => {
      const scene = scenes.get(sceneId);
      if (scene === undefined) {
        throw new Error(`scène inconnue: ${sceneId}`);
      }
      scene.hotspots.push(hotspot);
    },
  };
}

function projectScenes(
  scenes: Map<string, StoredScene>,
  tourId: string,
  scenesSelect: unknown,
): {
  id: string;
  deletedAt: Date | null;
  panoramaAsset: { processingStatus: PrismaProcessingStatus };
  hotspots: StoredHotspot[];
}[] {
  return orderedScenes(scenesOf(scenes, tourId), scenesSelect).map((scene) => ({
    id: scene.id,
    deletedAt: scene.deletedAt,
    panoramaAsset: { processingStatus: scene.processingStatus },
    hotspots: orderedHotspots(
      scene.hotspots,
      readField(readField(scenesSelect, 'select'), 'hotspots'),
    ),
  }));
}

function projectSceneIds(
  scenes: Map<string, StoredScene>,
  tourId: string,
  scenesSelect: unknown,
): { id: string }[] {
  return orderedScenes(scenesOf(scenes, tourId), scenesSelect).map((scene) => ({ id: scene.id }));
}

function scenesOf(scenes: Map<string, StoredScene>, tourId: string): StoredScene[] {
  return [...scenes.values()].filter((scene) => scene.tourId === tourId);
}

function orderedScenes(list: StoredScene[], scenesSelect: unknown): StoredScene[] {
  const living = filtersDeleted(scenesSelect)
    ? list.filter((scene) => scene.deletedAt === null)
    : list;
  if (!ordersByWeight(scenesSelect)) {
    return living;
  }
  return [...living].sort(
    (left, right) =>
      left.weight - right.weight || left.createdAt.getTime() - right.createdAt.getTime(),
  );
}

function orderedHotspots(list: StoredHotspot[], hotspotsSelect: unknown): StoredHotspot[] {
  const orderBy = readField(hotspotsSelect, 'orderBy');
  if (!isRecord(orderBy) || orderBy.createdAt !== 'asc') {
    return list;
  }
  return [...list].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

function filtersDeleted(node: unknown): boolean {
  const where = readField(node, 'where');
  return isRecord(where) && where.deletedAt === null;
}

function ordersByWeight(node: unknown): boolean {
  const orderBy = readField(node, 'orderBy');
  if (!Array.isArray(orderBy)) {
    return false;
  }
  const first: unknown = orderBy[0];
  return isRecord(first) && first.weight === 'asc';
}

function readField(value: unknown, key: string): unknown {
  if (!isRecord(value)) {
    return undefined;
  }
  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedTour(
  id: string,
  startSceneId: string | null,
  extras: Partial<Pick<StoredTour, 'status' | 'deletedAt'>> = {},
): StoredTour {
  return {
    id,
    startSceneId,
    status: extras.status ?? PrismaTourStatus.DRAFT,
    deletedAt: extras.deletedAt ?? null,
  };
}

function storedScene(
  id: string,
  tourId: string,
  weight: number,
  extras: Partial<Pick<StoredScene, 'deletedAt' | 'processingStatus' | 'createdAt'>> = {},
): StoredScene {
  return {
    id,
    tourId,
    weight,
    deletedAt: extras.deletedAt ?? null,
    processingStatus: extras.processingStatus ?? PrismaProcessingStatus.READY,
    createdAt: extras.createdAt ?? new Date(Date.UTC(2026, 8, 29, 0, 0, weight)),
    hotspots: [],
  };
}

function sceneLink(id: string, targetSceneId: string, createdAt: Date): StoredHotspot {
  return {
    id,
    type: PrismaHotspotType.SCENE_LINK,
    targetSceneId,
    targetTourId: null,
    targetTourSceneId: null,
    createdAt,
  };
}

function tourLink(
  id: string,
  targetTourId: string,
  createdAt: Date,
  targetTourSceneId: string | null = null,
): StoredHotspot {
  return {
    id,
    type: PrismaHotspotType.TOUR_LINK,
    targetSceneId: null,
    targetTourId,
    targetTourSceneId,
    createdAt,
  };
}

function issue(
  code: ValidationIssueCode,
  message: string,
  sceneId: string,
  hotspotId?: string,
): ValidationIssue {
  return {
    code,
    message,
    sceneId,
    ...(hotspotId === undefined ? {} : { hotspotId }),
  };
}

async function expectNotFound(run: () => Promise<unknown>): Promise<void> {
  const error = await run().then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(HttpException);
  if (!(error instanceof HttpException)) {
    return;
  }
  expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
  expect(error.getResponse()).toEqual({
    error: { code: TOUR_NOT_FOUND, message: TOUR_NOT_FOUND_MESSAGE },
  });
}

describe('TourPublicationService', () => {
  it('répond 404 TOUR_NOT_FOUND si la visite est absente ou supprimée', async () => {
    const { service, addTour } = harness();
    await expectNotFound(() => service.validate(UNKNOWN));
    addTour(storedTour(VISITE, null, { deletedAt: new Date() }));
    await expectNotFound(() => service.validate(VISITE));
  });

  it('signale Remparts inatteignable, puis plus rien une fois le lien ajouté', async () => {
    const { service, addTour, addScene, addHotspot } = harness();
    addTour(storedTour(VISITE, PORTE));
    addScene(storedScene(REMPARTS, VISITE, 2));
    addScene(storedScene(PORTE, VISITE, 0));
    addScene(storedScene(JARDIN, VISITE, 1));
    addHotspot(PORTE, sceneLink(LINK_PORTE, JARDIN, new Date('2026-09-29T00:00:00.000Z')));

    const blocked = await service.validate(VISITE);
    expect(blocked.issues).toEqual([
      issue(ValidationIssueCode.SCENE_UNREACHABLE, UNREACHABLE, REMPARTS),
    ]);

    addHotspot(JARDIN, sceneLink(LINK_JARDIN, REMPARTS, new Date('2026-09-29T00:00:01.000Z')));
    const open = await service.validate(VISITE);
    expect(open.issues).toEqual([]);
  });

  it('ordonne les scènes inatteignables par poids', async () => {
    const { service, addTour, addScene } = harness();
    addTour(storedTour(VISITE, PORTE));
    addScene(storedScene(REMPARTS, VISITE, 2));
    addScene(storedScene(JARDIN, VISITE, 0));
    addScene(storedScene(PORTE, VISITE, 1));

    const result = await service.validate(VISITE);
    expect(result.issues).toEqual([
      issue(ValidationIssueCode.SCENE_UNREACHABLE, UNREACHABLE, JARDIN),
      issue(ValidationIssueCode.SCENE_UNREACHABLE, UNREACHABLE, REMPARTS),
    ]);
  });

  it('lit le processingStatus du panorama', async () => {
    const { service, addTour, addScene, addHotspot } = harness();
    addTour(storedTour(VISITE, PORTE));
    addScene(storedScene(PORTE, VISITE, 0));
    addScene(storedScene(JARDIN, VISITE, 1, { processingStatus: PrismaProcessingStatus.PENDING }));
    addHotspot(PORTE, sceneLink(LINK_PORTE, JARDIN, new Date('2026-09-29T00:00:00.000Z')));

    const result = await service.validate(VISITE);
    expect(result.issues).toEqual([
      issue(ValidationIssueCode.PANORAMA_NOT_READY, PANORAMA, JARDIN),
    ]);
  });

  it('garde une scène supprimée dans le graphe', async () => {
    const { service, addTour, addScene, addHotspot } = harness();
    addTour(storedTour(VISITE, PORTE));
    addScene(storedScene(PORTE, VISITE, 0));
    addScene(storedScene(JARDIN, VISITE, 1));
    addScene(
      storedScene(REMPARTS, VISITE, 2, {
        deletedAt: new Date(),
        processingStatus: PrismaProcessingStatus.ERROR,
      }),
    );
    addHotspot(PORTE, sceneLink(LINK_PORTE, JARDIN, new Date('2026-09-29T00:00:00.000Z')));
    addHotspot(JARDIN, sceneLink(LINK_JARDIN, REMPARTS, new Date('2026-09-29T00:00:01.000Z')));

    const result = await service.validate(VISITE);
    expect(result.issues).toEqual([
      issue(ValidationIssueCode.SCENE_LINK_TARGET_DELETED, TARGET_DELETED, JARDIN, LINK_JARDIN),
    ]);
  });

  it('charge les visites cibles, y compris supprimées, sans leurs scènes supprimées', async () => {
    const { service, addTour, addScene, addHotspot } = harness();
    addTour(storedTour(VISITE, PORTE));
    addScene(storedScene(PORTE, VISITE, 0));
    addTour(storedTour(PUBLISHED, LIVING_SCENE, { status: PrismaTourStatus.PUBLISHED }));
    addScene(storedScene(DELETED_SCENE, PUBLISHED, 0, { deletedAt: new Date() }));
    addScene(storedScene(LIVING_SCENE, PUBLISHED, 1));
    addTour(storedTour(DRAFT_TARGET, null));
    addTour(
      storedTour(DELETED_TOUR, null, {
        status: PrismaTourStatus.PUBLISHED,
        deletedAt: new Date(),
      }),
    );
    addScene(storedScene(REMOVED_SCENE, DELETED_TOUR, 0, { deletedAt: new Date() }));

    const at = (second: number): Date => new Date(Date.UTC(2026, 8, 29, 0, 0, second));
    const valid = '01990000-0000-7000-8000-000000000051';
    const foreign = '01990000-0000-7000-8000-000000000052';
    const draft = '01990000-0000-7000-8000-000000000053';
    const missing = '01990000-0000-7000-8000-000000000054';
    const removed = '01990000-0000-7000-8000-000000000055';
    addHotspot(PORTE, tourLink(removed, DELETED_TOUR, at(5), REMOVED_SCENE));
    addHotspot(PORTE, tourLink(missing, UNKNOWN, at(4), LIVING_SCENE));
    addHotspot(PORTE, tourLink(draft, DRAFT_TARGET, at(3)));
    addHotspot(PORTE, tourLink(foreign, PUBLISHED, at(2), DELETED_SCENE));
    addHotspot(PORTE, tourLink(valid, PUBLISHED, at(1), LIVING_SCENE));

    const result = await service.validate(VISITE);
    expect(result.issues).toEqual([
      issue(ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN, SCENE_FOREIGN, PORTE, foreign),
      issue(ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED, UNPUBLISHED, PORTE, draft),
      issue(ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED, UNPUBLISHED, PORTE, missing),
      issue(ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED, UNPUBLISHED, PORTE, removed),
      issue(ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN, SCENE_FOREIGN, PORTE, removed),
    ]);
  });
});
