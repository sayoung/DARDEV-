import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CityResponseSchema,
  type CityCreate,
  type CityResponse,
  type CityUpdate,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  CITY_IN_USE_MESSAGE,
  inUseException,
  isForeignKeyViolation,
  isRecordMissing,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';

@Injectable()
export class CitiesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<CityResponse[]> {
    const rows = await this.prisma.city.findMany();
    return rows
      .map((row) => toCity(row))
      .sort((left, right) => left.name.fr.localeCompare(right.name.fr, 'fr'));
  }

  async get(id: string): Promise<CityResponse> {
    const row = await this.prisma.city.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException();
    }
    return toCity(row);
  }

  async create(input: CityCreate): Promise<CityResponse> {
    const row = await this.prisma.city.create({ data: cityData(input) });
    return toCity(row);
  }

  async update(id: string, input: CityUpdate): Promise<CityResponse> {
    await this.get(id);
    try {
      const row = await this.prisma.city.update({
        where: { id },
        data: cityData(input),
      });
      return toCity(row);
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /**
   * Une visite encore en base, y compris avec `deletedAt`, tient la clé étrangère
   * (`onDelete: Restrict`). La suppression physique répond alors 409.
   */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.prisma.tour.count({ where: { cityId: id } });
    if (used > 0) {
      throw inUseException(CITY_IN_USE_MESSAGE);
    }
    try {
      await this.prisma.city.delete({ where: { id } });
    } catch (error: unknown) {
      if (isForeignKeyViolation(error)) {
        throw inUseException(CITY_IN_USE_MESSAGE);
      }
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}

function cityData(input: CityCreate): {
  name: Prisma.InputJsonValue;
  region: string;
  lat: number;
  lng: number;
} {
  return {
    name: localizedToJson(input.name),
    region: input.region,
    lat: input.lat,
    lng: input.lng,
  };
}

function toCity(row: {
  id: string;
  name: Prisma.JsonValue;
  region: string;
  lat: number;
  lng: number;
}): CityResponse {
  return CityResponseSchema.parse({
    id: row.id,
    name: row.name,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
  });
}
