import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';
import { ViewerService } from './viewer.service.js';

describe('ViewerService', () => {
  let viewerService: ViewerService;
  
  const prismaMock = {
    tour: {
      findFirst: vi.fn(),
    },
  };
  
  const storageMock = {};
  
  const envMock: Pick<Env, 'MEDIA_PUBLIC_URL'> = {
    MEDIA_PUBLIC_URL: 'https://cdn.example.com',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    
    // @ts-expect-error Mock partiel pour les tests unitaires sans typage forcé (as)
    viewerService = new ViewerService(prismaMock, storageMock, envMock);
  });

  describe('getPublicGraph', () => {
    it('should throw NotFoundException if tour is not found', async () => {
      prismaMock.tour.findFirst.mockResolvedValue(null);

      await expect(viewerService.getPublicGraph('fake-token', 'fr')).rejects.toThrow(
        NotFoundException,
      );
      
      expect(prismaMock.tour.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should query Prisma with correct parameters', async () => {
      prismaMock.tour.findFirst.mockResolvedValue({ id: 'some-tour-id' });

      await expect(viewerService.getPublicGraph('fake-token', 'fr')).rejects.toThrow(
        'not implemented',
      );

      expect(prismaMock.tour.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shareToken: 'fake-token',
            publicShare: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        }),
      );
    });
  });
});
