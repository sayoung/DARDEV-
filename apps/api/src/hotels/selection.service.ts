import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SelectionResponseSchema,
  type Principal,
  type SelectionResponse,
} from '@xplor/shared';

import { canAccessHotel } from '../auth/access-policy.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
}
