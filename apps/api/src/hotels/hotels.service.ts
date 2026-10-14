import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetKind,
  ContractType,
  HotelCreateSchema,
  HotelResponseSchema,
  HotelStars,
  HotelUpdateSchema,
  ProcessingStatus,
  type HotelCreate,
  type HotelResponse,
  type HotelUpdate,
  type Principal,
} from '@xplor/shared';

import { canAccessHotel, scopeHotelIds } from '../auth/access-policy.js';
import {
  CITY_NOT_FOUND,
  CITY_NOT_FOUND_MESSAGE,
  isRecordMissing,
  referenceException,
} from '../catalog/catalog.errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LOGO_ASSET_INVALID,
  LOGO_ASSET_INVALID_MESSAGE,
  LOGO_ASSET_NOT_FOUND,
  LOGO_ASSET_NOT_FOUND_MESSAGE,
} from './hotels.errors.js';

export interface HotelRow {
  id: string;
  name: string;
  stars: HotelStars;
  cityId: string;
  address: string;
  phone: string;
  email: string;
  logoAssetId: string | null;
  brandColor: string;
  languages: string[];
  contractType: ContractType;
  contractStart: Date;
  contractEnd: Date;
  maintenancePinHash: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HotelPrismaClient {
  hotel: {
    findMany(args?: {
      where?: Prisma.HotelWhereInput;
      orderBy?: Prisma.HotelOrderByWithRelationInput | Prisma.HotelOrderByWithRelationInput[];
    }): Promise<HotelRow[]>;
    findFirst(args: {
      where: Prisma.HotelWhereInput;
    }): Promise<HotelRow | null>;
    create(args: {
      data: Prisma.HotelUncheckedCreateInput;
    }): Promise<HotelRow>;
    update(args: {
      where: Prisma.HotelWhereUniqueInput;
      data: Prisma.HotelUncheckedUpdateInput;
    }): Promise<HotelRow>;
  };
  city: {
    findUnique(args: {
      where: Prisma.CityWhereUniqueInput;
      select?: Prisma.CitySelect;
    }): Promise<{ id: string } | null>;
  };
  asset: {
    findUnique(args: {
      where: Prisma.AssetWhereUniqueInput;
      select?: Prisma.AssetSelect;
    }): Promise<{ id: string; kind: AssetKind; processingStatus: ProcessingStatus } | null>;
  };
}

@Injectable()
export class HotelsService {
  constructor(@Inject(PrismaService) private readonly prisma: HotelPrismaClient) {}

  async list(principal: Principal): Promise<HotelResponse[]> {
    const scope = scopeHotelIds(principal);
    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ...(scope === 'ALL' ? {} : { id: { in: scope } }),
    };
    const rows = await this.prisma.hotel.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows
      .map((row) => toHotel(row))
      .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
  }

  async get(principal: Principal, id: string): Promise<HotelResponse> {
    if (!canAccessHotel(principal, id)) {
      throw new NotFoundException();
    }
    const row = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
    });
    if (row === null) {
      throw new NotFoundException();
    }
    return toHotel(row);
  }

  async create(input: HotelCreate): Promise<HotelResponse> {
    const valid = HotelCreateSchema.parse(input);
    await this.assertCity(valid.cityId);
    if (valid.logoAssetId !== undefined && valid.logoAssetId !== null) {
      await this.assertLogo(valid.logoAssetId);
    }
    const row = await this.prisma.hotel.create({
      data: hotelCreateData(valid),
    });
    return toHotel(row);
  }

  async update(id: string, input: HotelUpdate): Promise<HotelResponse> {
    const valid = HotelUpdateSchema.parse(input);
    const existing = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
    });
    if (existing === null) {
      throw new NotFoundException();
    }
    if (valid.cityId !== undefined) {
      await this.assertCity(valid.cityId);
    }
    if (valid.logoAssetId !== undefined && valid.logoAssetId !== null) {
      await this.assertLogo(valid.logoAssetId);
    }
    try {
      const row = await this.prisma.hotel.update({
        where: { id },
        data: hotelUpdateData(valid),
      });
      return toHotel(row);
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
    });
    if (existing === null) {
      throw new NotFoundException();
    }
    try {
      await this.prisma.hotel.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          active: false,
        },
      });
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private async assertCity(cityId: string): Promise<void> {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true },
    });
    if (city === null) {
      throw referenceException(CITY_NOT_FOUND, CITY_NOT_FOUND_MESSAGE);
    }
  }

  private async assertLogo(logoAssetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: logoAssetId },
      select: { id: true, kind: true, processingStatus: true },
    });
    if (asset === null) {
      throw referenceException(LOGO_ASSET_NOT_FOUND, LOGO_ASSET_NOT_FOUND_MESSAGE);
    }
    if (
      asset.kind !== AssetKind.IMAGE ||
      asset.processingStatus !== ProcessingStatus.READY
    ) {
      throw referenceException(LOGO_ASSET_INVALID, LOGO_ASSET_INVALID_MESSAGE);
    }
  }
}

function hotelCreateData(input: HotelCreate): Prisma.HotelUncheckedCreateInput {
  return {
    name: input.name,
    stars: input.stars,
    cityId: input.cityId,
    address: input.address,
    phone: input.phone,
    email: input.email,
    logoAssetId: input.logoAssetId ?? null,
    brandColor: input.brandColor,
    languages: input.languages,
    contractType: input.contractType,
    contractStart: new Date(input.contractStart),
    contractEnd: new Date(input.contractEnd),
    active: input.active ?? true,
    maintenancePinHash: null,
    deletedAt: null,
  };
}

function hotelUpdateData(input: HotelUpdate): Prisma.HotelUncheckedUpdateInput {
  const data: Prisma.HotelUncheckedUpdateInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.stars !== undefined) {
    data.stars = input.stars;
  }
  if (input.cityId !== undefined) {
    data.cityId = input.cityId;
  }
  if (input.address !== undefined) {
    data.address = input.address;
  }
  if (input.phone !== undefined) {
    data.phone = input.phone;
  }
  if (input.email !== undefined) {
    data.email = input.email;
  }
  if (input.logoAssetId !== undefined) {
    data.logoAssetId = input.logoAssetId;
  }
  if (input.brandColor !== undefined) {
    data.brandColor = input.brandColor;
  }
  if (input.languages !== undefined) {
    data.languages = input.languages;
  }
  if (input.contractType !== undefined) {
    data.contractType = input.contractType;
  }
  if (input.contractStart !== undefined) {
    data.contractStart = new Date(input.contractStart);
  }
  if (input.contractEnd !== undefined) {
    data.contractEnd = new Date(input.contractEnd);
  }
  if (input.active !== undefined) {
    data.active = input.active;
  }
  return data;
}

function toHotel(row: HotelRow): HotelResponse {
  return HotelResponseSchema.parse({
    id: row.id,
    name: row.name,
    stars: row.stars,
    cityId: row.cityId,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logoAssetId: row.logoAssetId,
    brandColor: row.brandColor,
    languages: row.languages,
    contractType: row.contractType,
    contractStart: row.contractStart.toISOString(),
    contractEnd: row.contractEnd.toISOString(),
    active: row.active,
    hasMaintenancePin: row.maintenancePinHash !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
