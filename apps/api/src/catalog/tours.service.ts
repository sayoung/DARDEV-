import { Inject, Injectable, NotFoundException, type HttpException } from '@nestjs/common';
import {
  HotspotType as PrismaHotspotType,
  Prisma,
  TourStatus as PrismaTourStatus,
} from '@prisma/client';
import {
  HotspotType,
  LocalizedTextSchema,
  TourResponseSchema,
  TourStatus,
  type Paginated,
  type TourCreate,
  type TourListQuery,
  type TourResponse,
  type TourUpdate,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  CATEGORY_NOT_FOUND,
  CATEGORY_NOT_FOUND_MESSAGE,
  CITY_NOT_FOUND,
  CITY_NOT_FOUND_MESSAGE,
  COVER_ASSET_NOT_FOUND,
  COVER_ASSET_NOT_FOUND_MESSAGE,
  TOUR_NOT_FOUND,
  TOUR_NOT_FOUND_MESSAGE,
  isForeignKeyViolation,
  isRecordMissing,
  missingException,
  referenceException,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';
import { createShareToken } from './share-token.js';
import { duplicateFrenchTitle, remapDuplicateLinks } from './tour-duplicate.js';

const tourInclude = {
  categories: {
    select: { categoryId: true },
    orderBy: { id: 'asc' as const },
  },
  _count: {
    select: {
      scenes: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TourInclude;

/** Scènes vivantes seulement, dans l'ordre d'affichage, avec leurs hotspots. */
const duplicateInclude = {
  categories: {
    select: { categoryId: true },
    orderBy: { id: 'asc' as const },
  },
  scenes: {
    where: { deletedAt: null },
    orderBy: [{ weight: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      hotspots: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} satisfies Prisma.TourInclude;

type TourRow = Prisma.TourGetPayload<{ include: typeof tourInclude }>;

@Injectable()
export class ToursService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: TourListQuery): Promise<Paginated<TourResponse>> {
    const where = listWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        include: tourInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => toTour(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(id: string): Promise<TourResponse> {
    return toTour(await this.loadActive(id));
  }

  async create(input: TourCreate, createdById: string): Promise<TourResponse> {
    await this.assertReferences(input);
    const categoryIds = uniqueIds(input.categoryIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.tour.create({
          data: {
            ...tourScalars(input),
            status: PrismaTourStatus.DRAFT,
            publicShare: false,
            shareToken: createShareToken(),
            createdById,
          },
        });
        await insertCategories(tx, created.id, categoryIds);
        return toTour(await loadRow(tx, created.id));
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(error, () => this.assertReferences(input));
    }
  }

  async update(id: string, input: TourUpdate): Promise<TourResponse> {
    await this.get(id);
    await this.assertReferences(input);
    const categoryIds = uniqueIds(input.categoryIds);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.loadActive(id, tx);
        await tx.tourCategory.deleteMany({ where: { tourId: id } });
        await tx.tour.update({
          where: { id },
          data: {
            ...tourScalars(input),
            contentVersion: { increment: 1 },
          },
        });
        await insertCategories(tx, id, categoryIds);
        return toTour(await loadRow(tx, id));
      });
    } catch (error: unknown) {
      return await rethrowReferenceOrMissing(error, () => this.assertReferences(input));
    }
  }

  /**
   * Copie la visite, ses catégories, ses scènes non supprimées et leurs hotspots.
   * Une seule transaction. La source n'est pas modifiée.
   */
  async duplicate(id: string, createdById: string): Promise<TourResponse> {
    return await this.prisma.$transaction(async (tx) => {
      const source = await tx.tour.findFirst({
        where: { id, deletedAt: null },
        include: duplicateInclude,
      });
      if (source === null) {
        throw missingException(TOUR_NOT_FOUND, TOUR_NOT_FOUND_MESSAGE);
      }

      const created = await tx.tour.create({
        data: {
          title: localizedToJson(duplicateFrenchTitle(LocalizedTextSchema.parse(source.title))),
          summary: copyRequiredJson(source.summary),
          description: copyJson(source.description),
          cityId: source.cityId,
          coverAssetId: source.coverAssetId,
          durationMinutes: source.durationMinutes,
          lat: source.lat,
          lng: source.lng,
          practicalInfo: copyJson(source.practicalInfo),
          status: PrismaTourStatus.DRAFT,
          publicShare: false,
          shareToken: createShareToken(),
          createdById,
        },
      });
      await insertCategories(
        tx,
        created.id,
        source.categories.map((link) => link.categoryId),
      );

      const copies = new Map<string, string>();
      for (const scene of source.scenes) {
        const copy = await tx.scene.create({
          data: {
            tourId: created.id,
            title: copyRequiredJson(scene.title),
            caption: copyJson(scene.caption),
            panoramaAssetId: scene.panoramaAssetId,
            initialYaw: scene.initialYaw,
            initialPitch: scene.initialPitch,
            initialZoom: scene.initialZoom,
            narration: copyJson(scene.narration),
            ambientAssetId: scene.ambientAssetId,
            mapX: scene.mapX,
            mapY: scene.mapY,
            weight: scene.weight,
            createdById,
          },
        });
        copies.set(scene.id, copy.id);
      }

      const links = remapDuplicateLinks(
        source.startSceneId,
        source.scenes.flatMap((scene) =>
          scene.hotspots.map((hotspot) => ({
            id: hotspot.id,
            type: toHotspotType(hotspot.type),
            targetSceneId: hotspot.targetSceneId,
            targetTourId: hotspot.targetTourId,
            targetTourSceneId: hotspot.targetTourSceneId,
          })),
        ),
        copies,
      );
      const remapped = new Map(links.hotspots.map((hotspot) => [hotspot.id, hotspot]));

      for (const scene of source.scenes) {
        const sceneId = copies.get(scene.id);
        if (sceneId === undefined) {
          throw new Error('scène copiée absente');
        }
        for (const hotspot of scene.hotspots) {
          const link = remapped.get(hotspot.id);
          if (link === undefined) {
            throw new Error('hotspot remappé absent');
          }
          await tx.hotspot.create({
            data: {
              sceneId,
              type: hotspot.type,
              yaw: hotspot.yaw,
              pitch: hotspot.pitch,
              label: copyRequiredJson(hotspot.label),
              targetSceneId: link.targetSceneId,
              targetTourId: link.targetTourId,
              targetTourSceneId: link.targetTourSceneId,
              body: copyJson(hotspot.body),
              mediaAssetIds: [...hotspot.mediaAssetIds],
              url: hotspot.url,
              icon: hotspot.icon,
              arrivalYaw: hotspot.arrivalYaw,
              createdById,
            },
          });
        }
      }

      if (links.startSceneId !== null) {
        await tx.tour.update({
          where: { id: created.id },
          data: { startSceneId: links.startSceneId },
        });
      }

      return toTour(await loadRow(tx, created.id));
    });
  }

  /** Suppression logique. La ligne reste, pour les clés étrangères `Restrict` (D-69). */
  async remove(id: string): Promise<void> {
    await this.get(id);
    try {
      await this.prisma.tour.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private async loadActive(id: string, client: TourClient = this.prisma): Promise<TourRow> {
    const row = await client.tour.findFirst({
      where: { id, deletedAt: null },
      include: tourInclude,
    });
    if (row === null) {
      throw new NotFoundException();
    }
    return row;
  }

  /** Ville, puis catégories, puis vignette. La première absente répond 422. */
  private async assertReferences(input: TourCreate): Promise<void> {
    const city = await this.prisma.city.findUnique({
      where: { id: input.cityId },
      select: { id: true },
    });
    if (city === null) {
      throw referenceException(CITY_NOT_FOUND, CITY_NOT_FOUND_MESSAGE);
    }
    const categoryIds = uniqueIds(input.categoryIds);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (categories.length !== categoryIds.length) {
      throw referenceException(CATEGORY_NOT_FOUND, CATEGORY_NOT_FOUND_MESSAGE);
    }
    const cover = await this.prisma.asset.findUnique({
      where: { id: input.coverAssetId },
      select: { id: true },
    });
    if (cover === null) {
      throw referenceException(COVER_ASSET_NOT_FOUND, COVER_ASSET_NOT_FOUND_MESSAGE);
    }
  }
}

type TourClient = PrismaService | Prisma.TransactionClient;

/** Valeur JSON lue par Prisma, recopiée telle quelle. `null` reste SQL NULL. */
function copyJson(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null) {
    return Prisma.DbNull;
  }
  return value;
}

function copyRequiredJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  if (value === null) {
    throw new Error('champ JSON obligatoire absent');
  }
  return value;
}

function toHotspotType(type: PrismaHotspotType): HotspotType {
  return HotspotType[type];
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
}

function listWhere(query: TourListQuery): Prisma.TourWhereInput {
  const where: Prisma.TourWhereInput = { deletedAt: null };
  if (query.status !== undefined) {
    where.status =
      query.status === TourStatus.PUBLISHED ? PrismaTourStatus.PUBLISHED : PrismaTourStatus.DRAFT;
  }
  if (query.cityId !== undefined) {
    where.cityId = query.cityId;
  }
  if (query.categoryId !== undefined) {
    where.categories = { some: { categoryId: query.categoryId } };
  }
  const needle = query.q?.trim() ?? '';
  if (needle.length > 0) {
    where.title = {
      path: ['fr'],
      string_contains: needle,
      mode: 'insensitive',
    };
  }
  return where;
}

function tourScalars(input: TourCreate): {
  title: Prisma.InputJsonValue;
  summary: Prisma.InputJsonValue;
  description: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  cityId: string;
  coverAssetId: string;
  durationMinutes: number | null;
  lat: number | null;
  lng: number | null;
  practicalInfo: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
} {
  return {
    title: localizedToJson(input.title),
    summary: localizedToJson(input.summary),
    description:
      input.description === undefined ? Prisma.DbNull : localizedToJson(input.description),
    cityId: input.cityId,
    coverAssetId: input.coverAssetId,
    durationMinutes: input.durationMinutes ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    practicalInfo:
      input.practicalInfo === undefined ? Prisma.DbNull : localizedToJson(input.practicalInfo),
  };
}

async function insertCategories(
  tx: Prisma.TransactionClient,
  tourId: string,
  categoryIds: readonly string[],
): Promise<void> {
  for (const categoryId of categoryIds) {
    await tx.tourCategory.create({ data: { tourId, categoryId } });
  }
}

async function loadRow(tx: Prisma.TransactionClient, id: string): Promise<TourRow> {
  const row = await tx.tour.findFirst({
    where: { id },
    include: tourInclude,
  });
  if (row === null) {
    throw new NotFoundException();
  }
  return row;
}

/**
 * Une `HttpException` (404, 422) sort telle quelle.
 * Une clé étrangère relance la vérification des références.
 * Une ligne disparue entre-temps répond 404.
 * `never` : tous les chemins lèvent.
 */
async function rethrowReferenceOrMissing(
  error: unknown,
  recheck: () => Promise<void>,
): Promise<never> {
  if (isHttpException(error)) {
    throw error;
  }
  if (isRecordMissing(error)) {
    throw new NotFoundException();
  }
  if (isForeignKeyViolation(error)) {
    await recheck();
  }
  throw error;
}

function isHttpException(error: unknown): error is HttpException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'getStatus' in error &&
    typeof error.getStatus === 'function'
  );
}

function toTour(row: TourRow): TourResponse {
  if (row.shareToken === null) {
    throw new Error('shareToken absent');
  }
  const description = row.description === null ? undefined : row.description;
  const practicalInfo = row.practicalInfo === null ? undefined : row.practicalInfo;
  return TourResponseSchema.parse({
    id: row.id,
    title: row.title,
    summary: row.summary,
    ...(description === undefined ? {} : { description }),
    cityId: row.cityId,
    categoryIds: row.categories.map((link) => link.categoryId),
    coverAssetId: row.coverAssetId,
    ...(row.durationMinutes === null ? {} : { durationMinutes: row.durationMinutes }),
    ...(row.lat === null ? {} : { lat: row.lat }),
    ...(row.lng === null ? {} : { lng: row.lng }),
    ...(practicalInfo === undefined ? {} : { practicalInfo }),
    status: row.status,
    publicShare: row.publicShare,
    shareToken: row.shareToken,
    sceneCount: row._count.scenes,
    createdById: row.createdById,
    contentVersion: row.contentVersion,
    startSceneId: row.startSceneId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  });
}
