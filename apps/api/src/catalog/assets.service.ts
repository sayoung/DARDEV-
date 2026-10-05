import { HttpException, Inject, Injectable } from '@nestjs/common';
import { AssetKind as PrismaAssetKind, ProcessingStatus, Prisma, type Asset } from '@prisma/client';
import {
  AssetKind,
  AssetResponseSchema,
  PanoramaUploadIssueCode,
  PANORAMA_MAX_BYTES,
  validatePanoramaUpload,
  panoramaDerivativeKeys,
  type AssetListQuery,
  type AssetResponse,
  type AssetUploadRequest,
  type AssetUploadResponse,
  type Paginated,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { PanoramaQueueService } from '../queue/panorama-queue.service.js';
import { StorageService, STORAGE_SERVICE, UPLOAD_URL_TTL_SECONDS } from '../storage/storage.service.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { mediaUrl } from '../viewer/media-url.js';
import { ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE, missingException } from './catalog.errors.js';
import { readImageDimensions } from './jpeg-dimensions.js';

@Injectable()
export class AssetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(PanoramaQueueService) private readonly panoramaQueue: PanoramaQueueService,
    @Inject(ENV) private readonly env: Pick<Env, 'MEDIA_PUBLIC_URL'>,
  ) {}

  async list(query: AssetListQuery): Promise<Paginated<AssetResponse>> {
    const where = listWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => toAsset(row, this.env.MEDIA_PUBLIC_URL)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(id: string): Promise<AssetResponse> {
    const row = await this.prisma.asset.findUnique({ where: { id } });
    if (row === null) {
      throw missingException(ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE);
    }
    return toAsset(row, this.env.MEDIA_PUBLIC_URL);
  }

  async createUploadUrl(input: AssetUploadRequest): Promise<AssetUploadResponse> {
    if (input.kind === AssetKind.PANORAMA) {
      if (input.mimeType !== 'image/jpeg') {
        throw new HttpException(
          { error: { code: PanoramaUploadIssueCode.INVALID_FORMAT, message: 'Le format doit être image/jpeg' } },
          422,
        );
      }
      if (input.sizeBytes > PANORAMA_MAX_BYTES) {
        throw new HttpException(
          { error: { code: PanoramaUploadIssueCode.FILE_TOO_LARGE, message: 'Fichier trop volumineux' } },
          422,
        );
      }
    }

    const cleanFilename = input.filename.replace(/[^A-Za-z0-9._-]/g, '-');

    const row = await this.prisma.asset.create({
      data: {
        kind: toPrismaKind(input.kind),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        originalKey: '', // Provisoire
        contentHash: '', // Provisoire
        processingStatus: ProcessingStatus.PENDING,
      },
    });

    const originalKey = `uploads/${row.id}/${cleanFilename}`;

    await this.prisma.asset.update({
      where: { id: row.id },
      data: { originalKey },
    });

    const uploadUrl = await this.storage.generatePresignedUploadUrl(originalKey, input.mimeType, input.sizeBytes);

    return {
      assetId: row.id,
      uploadUrl,
      uploadMethod: 'PUT',
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  async complete(id: string): Promise<AssetResponse> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (asset === null) {
      throw missingException(ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE);
    }
    if (asset.processingStatus !== ProcessingStatus.PENDING) {
      throw new HttpException(
        { error: { code: 'ASSET_ALREADY_COMPLETED', message: 'Asset is already completed' } },
        409,
      );
    }

    const head = await this.storage.headObject(asset.originalKey);
    if (head === null) {
      throw new HttpException(
        { error: { code: 'UPLOAD_MISSING', message: 'No file uploaded to storage' } },
        422,
      );
    }

    if (asset.kind === PrismaAssetKind.PANORAMA) {
      const buffer = await this.storage.getRange(asset.originalKey, 0, 65535);
      const dimensions = readImageDimensions(buffer);

      if (dimensions === null) {
        throw new HttpException(
          { error: { code: PanoramaUploadIssueCode.INVALID_FORMAT, message: 'Dimensions illisibles' } },
          422,
        );
      }

      const issues = validatePanoramaUpload({
        mimeType: head.contentType ?? asset.mimeType,
        sizeBytes: head.sizeBytes,
        width: dimensions.width,
        height: dimensions.height,
      });

      if (issues.length > 0) {
        const issue = issues[0];
        if (!issue) throw new Error('Impossible');
        const message = `attendu : ${issue.expected} ; reçu : ${issue.received}`;
        await this.prisma.asset.update({
          where: { id },
          data: {
            processingStatus: ProcessingStatus.ERROR,
            processingLog: message,
          },
        });
        throw new HttpException(
          {
            error: {
              code: issue.code,
              message,
              issues,
            },
          },
          422,
        );
      }

      const updatedAsset = await this.prisma.asset.update({
        where: { id },
        data: {
          width: dimensions.width,
          height: dimensions.height,
          sizeBytes: head.sizeBytes,
          processingStatus: ProcessingStatus.PROCESSING,
        },
      });

      await this.panoramaQueue.enqueue(id);
      return toAsset(updatedAsset, this.env.MEDIA_PUBLIC_URL);
    } else {
      const updatedAsset = await this.prisma.asset.update({
        where: { id },
        data: {
          sizeBytes: head.sizeBytes,
          processingStatus: ProcessingStatus.READY,
        },
      });
      return toAsset(updatedAsset, this.env.MEDIA_PUBLIC_URL);
    }
  }

  async reprocess(id: string): Promise<AssetResponse> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (asset === null) {
      throw missingException(ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE);
    }
    if (asset.kind !== PrismaAssetKind.PANORAMA) {
      throw new HttpException(
        { error: { code: 'ASSET_NOT_REPROCESSABLE', message: "L'asset n'est pas un panorama" } },
        422,
      );
    }
    if (asset.processingStatus === ProcessingStatus.PENDING) {
      throw new HttpException(
        { error: { code: 'ASSET_NOT_UPLOADED', message: "L'asset n'a pas encore été téléversé" } },
        409,
      );
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        processingStatus: ProcessingStatus.PROCESSING,
        processingLog: null,
      },
    });

    await this.panoramaQueue.enqueue(id, 'reprocess');
    return toAsset(updatedAsset, this.env.MEDIA_PUBLIC_URL);
  }

  async remove(id: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            coverOf: true,
            panoramas: true,
            ambientOf: true,
            hotelLogos: true,
          },
        },
      },
    });

    if (asset === null) {
      throw missingException(ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE);
    }

    const totalUses =
      asset._count.coverOf +
      asset._count.panoramas +
      asset._count.ambientOf +
      asset._count.hotelLogos;

    if (totalUses > 0) {
      throw new HttpException(
        {
          error: {
            code: 'ASSET_IN_USE',
            message: `Impossible de supprimer ce média : il est utilisé à ${totalUses.toString(10)} endroit(s).`,
            count: totalUses,
          },
        },
        409,
      );
    }

    await this.prisma.asset.delete({ where: { id } });

    if (asset.originalKey) {
      await this.storage.deleteObject(asset.originalKey);
    }
  }

  async reprocessAllPanoramas(): Promise<number> {
    const assets = await this.prisma.asset.findMany({
      where: {
        kind: PrismaAssetKind.PANORAMA,
        processingStatus: {
          in: [ProcessingStatus.READY, ProcessingStatus.ERROR],
        },
      },
      select: { id: true },
    });

    let count = 0;
    for (const asset of assets) {
      await this.reprocess(asset.id);
      count++;
    }

    return count;
  }
}

function listWhere(query: AssetListQuery): Prisma.AssetWhereInput {
  if (query.kind === undefined) {
    return {};
  }
  return { kind: toPrismaKind(query.kind) };
}

function toPrismaKind(kind: AssetKind): PrismaAssetKind {
  switch (kind) {
    case AssetKind.PANORAMA:
      return PrismaAssetKind.PANORAMA;
    case AssetKind.IMAGE:
      return PrismaAssetKind.IMAGE;
    case AssetKind.AUDIO:
      return PrismaAssetKind.AUDIO;
    case AssetKind.VIDEO:
      return PrismaAssetKind.VIDEO;
  }
}

function toAsset(row: Asset, mediaBase: string): AssetResponse {
  let thumbnailUrl: string | null = null;
  if (
    row.processingStatus === ProcessingStatus.READY &&
    (row.kind === PrismaAssetKind.IMAGE || row.kind === PrismaAssetKind.PANORAMA)
  ) {
    const keys = panoramaDerivativeKeys(row.id, row.contentHash);
    thumbnailUrl = mediaUrl(mediaBase, keys.thumb);
  }

  return AssetResponseSchema.parse({
    id: row.id,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    processingStatus: row.processingStatus,
    processingLog: row.processingLog,
    copyright: row.copyright,
    thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
  });
}
