import { Inject, Injectable } from '@nestjs/common';
import { AssetKind as PrismaAssetKind, Prisma, type Asset } from '@prisma/client';
import {
  AssetKind,
  AssetResponseSchema,
  type AssetListQuery,
  type AssetResponse,
  type Paginated,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import { ASSET_NOT_FOUND, ASSET_NOT_FOUND_MESSAGE, missingException } from './catalog.errors.js';

@Injectable()
export class AssetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
      items: rows.map((row) => toAsset(row)),
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
    return toAsset(row);
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

function toAsset(row: Asset): AssetResponse {
  return AssetResponseSchema.parse({
    id: row.id,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    processingStatus: row.processingStatus,
    copyright: row.copyright,
    createdAt: row.createdAt.toISOString(),
  });
}
