import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  HotelManagerSchema,
  Role,
  type HotelManager,
  type Principal,
} from '@xplor/shared';

import { canAccessHotel } from '../auth/access-policy.js';
import { referenceException } from '../catalog/catalog.errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  USER_INVALID,
  USER_INVALID_MESSAGE,
  USER_NOT_FOUND,
  USER_NOT_FOUND_MESSAGE,
} from './hotels.errors.js';

export interface HotelSummaryRow {
  id: string;
  deletedAt: Date | null;
}

export interface UserSummaryRow {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: Role;
}

export interface UserHotelRow {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface HotelManagersTransactionClient {
  userHotel: {
    deleteMany(args?: { where?: Prisma.UserHotelWhereInput }): Promise<Prisma.BatchPayload>;
    createMany(args: { data: Prisma.UserHotelCreateManyInput[] }): Promise<Prisma.BatchPayload>;
  };
}

export interface HotelManagersPrismaClient {
  hotel: {
    findFirst(args: { where: Prisma.HotelWhereInput }): Promise<HotelSummaryRow | null>;
  };
  user: {
    findMany(args: {
      where?: Prisma.UserWhereInput;
      select?: Prisma.UserSelect;
    }): Promise<UserSummaryRow[]>;
  };
  userHotel: {
    findMany(args: {
      where?: Prisma.UserHotelWhereInput;
      select?: Prisma.UserHotelSelect;
    }): Promise<UserHotelRow[]>;
    deleteMany(args?: { where?: Prisma.UserHotelWhereInput }): Promise<Prisma.BatchPayload>;
    createMany(args: { data: Prisma.UserHotelCreateManyInput[] }): Promise<Prisma.BatchPayload>;
  };
  $transaction<T>(fn: (tx: HotelManagersTransactionClient) => Promise<T>): Promise<T>;
}

@Injectable()
export class HotelManagersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: HotelManagersPrismaClient,
  ) {}

  async list(principal: Principal, hotelId: string): Promise<HotelManager[]> {
    if (!canAccessHotel(principal, hotelId)) {
      throw new NotFoundException();
    }
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });
    if (hotel === null) {
      throw new NotFoundException();
    }
    return this.fetchManagers(hotelId);
  }

  async replace(hotelId: string, userIds: string[]): Promise<HotelManager[]> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
    });
    if (hotel === null) {
      throw new NotFoundException();
    }

    if (userIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          role: true,
        },
      });

      const userMap = new Map<string, UserSummaryRow>(
        users.map((user) => [user.id, user]),
      );

      for (const userId of userIds) {
        const user = userMap.get(userId);
        if (user === undefined) {
          throw referenceException(USER_NOT_FOUND, USER_NOT_FOUND_MESSAGE);
        }
        if (!user.active || user.role !== Role.HOTEL_MANAGER) {
          throw referenceException(USER_INVALID, USER_INVALID_MESSAGE);
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userHotel.deleteMany({
        where: { hotelId },
      });
      if (userIds.length > 0) {
        await tx.userHotel.createMany({
          data: userIds.map((userId) => ({
            hotelId,
            userId,
          })),
        });
      }
    });

    return this.fetchManagers(hotelId);
  }

  private async fetchManagers(hotelId: string): Promise<HotelManager[]> {
    const rows = await this.prisma.userHotel.findMany({
      where: { hotelId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return rows
      .map((row) =>
        HotelManagerSchema.parse({
          id: row.user.id,
          email: row.user.email,
          name: row.user.name,
        }),
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
  }
}
