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
          }),
      },
    };
    const lookup = new PrismaUserLookup(prisma as unknown as PrismaService);

    await expect(lookup.findById('user-1')).resolves.toEqual({
      id: 'user-1',
      role: Role.ADMIN,
      active: true,
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
