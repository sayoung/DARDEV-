import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SelectionResponseSchema,
  type Principal,
  type SelectionResponse,
  type SelectionUpdate,
} from '@xplor/shared';

import { canAccessHotel } from '../auth/access-policy.js';
import { referenceException } from '../catalog/catalog.errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  SELECTION_TOUR_INVALID,
  SELECTION_TOUR_INVALID_MESSAGE,
} from './hotels.errors.js';

export interface HotelSummaryRow {
  id: string;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface SelectionItemRow {
  tourId: string;
  position: number;
}

export interface SelectionRow {
  id: string;
  hotelId: string;
  featuredTourId: string | null;
  attractTourIds: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  items: SelectionItemRow[];
}

export interface SelectionTx {
  selection: {
    upsert(args: Prisma.SelectionUpsertArgs): Promise<{ id: string }>;
  };
  selectionItem: {
    deleteMany(args: Prisma.SelectionItemDeleteManyArgs): Promise<unknown>;
    createMany(args: Prisma.SelectionItemCreateManyArgs): Promise<unknown>;
  };
}

export interface SelectionPrismaClient {
  hotel: {
    findFirst(args: { where: Prisma.HotelWhereInput }): Promise<HotelSummaryRow | null>;
  };
  selection: {
    findUnique(args: {
      where: Prisma.SelectionWhereUniqueInput;
      include?: Prisma.SelectionInclude;
    }): Promise<SelectionRow | null>;
    upsert(args: Prisma.SelectionUpsertArgs): Promise<{ id: string }>;
  };
  tour: {
    findMany(args: {
      where: Prisma.TourWhereInput;
      select?: Prisma.TourSelect;
    }): Promise<{ id: string }[]>;
  };
  $transaction<T>(fn: (tx: SelectionTx) => Promise<T>): Promise<T>;
}

@Injectable()
export class SelectionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: SelectionPrismaClient,
  ) {}

  async get(principal: Principal, hotelId: string): Promise<SelectionResponse> {
    if (!canAccessHotel(principal, hotelId)) {
      throw new NotFoundException();
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });
    if (hotel === null) {
      throw new NotFoundException();
    }

    const selection = await this.prisma.selection.findUnique({
      where: { hotelId },
      include: {
        items: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (selection === null) {
      return SelectionResponseSchema.parse({
        hotelId,
        version: 1,
        featuredTourId: null,
        attractTourIds: [],
        items: [],
        updatedAt: hotel.createdAt.toISOString(),
      });
    }

    const sortedItems = [...selection.items]
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        tourId: item.tourId,
        position: item.position,
      }));

    return SelectionResponseSchema.parse({
      hotelId: selection.hotelId,
      version: selection.version,
      featuredTourId: selection.featuredTourId,
      attractTourIds: selection.attractTourIds,
      items: sortedItems,
      updatedAt: selection.updatedAt.toISOString(),
    });
  }

  async replace(
    principal: Principal,
    hotelId: string,
    input: SelectionUpdate,
  ): Promise<SelectionResponse> {
    if (!canAccessHotel(principal, hotelId)) {
      throw new NotFoundException();
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });
    if (hotel === null) {
      throw new NotFoundException();
    }

    const rawIds: string[] = [];
    if (input.featuredTourId !== null) {
      rawIds.push(input.featuredTourId);
    }
    rawIds.push(...input.tourIds);
    rawIds.push(...input.attractTourIds);
    const ids = [...new Set(rawIds)];

    if (ids.length > 0) {
      const publishedTours = await this.prisma.tour.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
          status: 'PUBLISHED',
        },
        select: { id: true },
      });
      if (publishedTours.length < ids.length) {
        throw referenceException(
          SELECTION_TOUR_INVALID,
          SELECTION_TOUR_INVALID_MESSAGE,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const selection = await tx.selection.upsert({
        where: { hotelId },
        create: {
          hotelId,
          version: 1,
          featuredTourId: input.featuredTourId,
          attractTourIds: input.attractTourIds,
        },
        update: {
          version: { increment: 1 },
          featuredTourId: input.featuredTourId,
          attractTourIds: input.attractTourIds,
        },
      });

      await tx.selectionItem.deleteMany({
        where: { selectionId: selection.id },
      });

      if (input.tourIds.length > 0) {
        await tx.selectionItem.createMany({
          data: input.tourIds.map((tourId, position) => ({
            selectionId: selection.id,
            tourId,
            position,
          })),
        });
      }
    });

    return this.get(principal, hotelId);
  }
}

