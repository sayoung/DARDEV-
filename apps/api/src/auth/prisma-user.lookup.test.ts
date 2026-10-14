import { Role as PrismaRole } from '@prisma/client';
import { Role } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { PrismaUserLookup } from './prisma-user.lookup.js';

describe('PrismaUserLookup', () => {
  it('mappe le rôle partagé', async () => {
    const prisma = {
      user: {
        findUnique: () =>
          Promise.resolve({
            id: 'user-1',
            role: PrismaRole.ADMIN,
            active: true,
            hotels: [],
          }),
      },
    };
    const lookup = new PrismaUserLookup(prisma as unknown as PrismaService);

    await expect(lookup.findById('user-1')).resolves.toEqual({
      id: 'user-1',
      role: Role.ADMIN,
      active: true,
      hotelIds: [],
    });
  });

  it('mappe les identifiants d’hôtels rattachés', async () => {
    const prisma = {
      user: {
        findUnique: () =>
          Promise.resolve({
            id: 'user-2',
            role: PrismaRole.HOTEL_MANAGER,
            active: true,
            hotels: [{ hotelId: 'hotel-a' }, { hotelId: 'hotel-b' }],
          }),
      },
    };
    const lookup = new PrismaUserLookup(prisma as unknown as PrismaService);

    await expect(lookup.findById('user-2')).resolves.toEqual({
      id: 'user-2',
      role: Role.HOTEL_MANAGER,
      active: true,
      hotelIds: ['hotel-a', 'hotel-b'],
    });
  });

  it('renvoie null si le compte est absent', async () => {
    const prisma = {
      user: {
        findUnique: () => Promise.resolve(null),
      },
    };
    const lookup = new PrismaUserLookup(prisma as unknown as PrismaService);

    await expect(lookup.findById('absent')).resolves.toBeNull();
  });
});
