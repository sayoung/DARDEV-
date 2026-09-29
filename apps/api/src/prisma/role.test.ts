import { Role as PrismaRole } from '@prisma/client';
import { Role as SharedRole } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

describe('Role', () => {
  it('uses the same values in Prisma and @xplor/shared', () => {
    const prismaValues = Object.values(PrismaRole).sort();
    const sharedValues = Object.values(SharedRole).sort();

    expect(prismaValues).toEqual(sharedValues);
  });
});
