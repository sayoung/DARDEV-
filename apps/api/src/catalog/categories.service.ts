import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CategoryResponseSchema,
  type CategoryCreate,
  type CategoryResponse,
  type CategoryUpdate,
} from '@xplor/shared';

import { PrismaService } from '../prisma/prisma.service.js';
import {
  CATEGORY_IN_USE_MESSAGE,
  inUseException,
  isForeignKeyViolation,
  isRecordMissing,
} from './catalog.errors.js';
import { localizedToJson } from './localized-json.js';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<CategoryResponse[]> {
    const rows = await this.prisma.category.findMany();
    return rows
      .map((row) => toCategory(row))
      .sort((left, right) => left.name.fr.localeCompare(right.name.fr, 'fr'));
  }

  async get(id: string): Promise<CategoryResponse> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundException();
    }
    return toCategory(row);
  }

  async create(input: CategoryCreate): Promise<CategoryResponse> {
    const row = await this.prisma.category.create({ data: categoryData(input) });
    return toCategory(row);
  }

  async update(id: string, input: CategoryUpdate): Promise<CategoryResponse> {
    await this.get(id);
    try {
      const row = await this.prisma.category.update({
        where: { id },
        data: categoryData(input),
      });
      return toCategory(row);
    } catch (error: unknown) {
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /**
   * Une jointure `TourCategory` encore en base (visite logique comprise) tient
   * `onDelete: Restrict`. La suppression physique répond alors 409.
   */
  async remove(id: string): Promise<void> {
    await this.get(id);
    const used = await this.prisma.tourCategory.count({ where: { categoryId: id } });
    if (used > 0) {
      throw inUseException(CATEGORY_IN_USE_MESSAGE);
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error: unknown) {
      if (isForeignKeyViolation(error)) {
        throw inUseException(CATEGORY_IN_USE_MESSAGE);
      }
      if (isRecordMissing(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }
}

function categoryData(input: CategoryCreate): {
  name: Prisma.InputJsonValue;
  icon: string;
  color: string;
  weight: number;
} {
  return {
    name: localizedToJson(input.name),
    icon: input.icon,
    color: input.color,
    weight: input.weight,
  };
}

function toCategory(row: {
  id: string;
  name: Prisma.JsonValue;
  icon: string;
  color: string;
  weight: number;
}): CategoryResponse {
  return CategoryResponseSchema.parse({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    weight: row.weight,
  });
}
