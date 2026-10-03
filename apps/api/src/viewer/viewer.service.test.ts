import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ViewerService } from './viewer.service.js';

describe('ViewerService', () => {
  let viewerService: ViewerService;
  
  const findFirstMock = vi.fn();

  const prismaMock = {
    tour: {
      findFirst: findFirstMock,
    },
  } as unknown as PrismaService;
  
  const storageMock = {} as unknown as StorageService;
  
  const envMock: Pick<Env, 'MEDIA_PUBLIC_URL'> = {
    MEDIA_PUBLIC_URL: 'https://cdn.example.com',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    
    viewerService = new ViewerService(prismaMock, storageMock, envMock);
  });

  describe('getPublicGraph', () => {
    it('should throw NotFoundException if tour is not found', async () => {
      findFirstMock.mockResolvedValue(null);

      await expect(viewerService.getPublicGraph('fake-token', 'fr')).rejects.toThrow(
        NotFoundException,
      );
      
      expect(findFirstMock).toHaveBeenCalledTimes(1);
    });

    it('should query Prisma with correct parameters', async () => {
      // Mock d'un objet partiel
      const fakeTour = { id: 'some-tour-id' };
      findFirstMock.mockResolvedValue(fakeTour);

      await expect(viewerService.getPublicGraph('fake-token', 'fr')).rejects.toThrow(
        'not implemented for lang fr',
      );

      expect(findFirstMock).toHaveBeenCalledWith(
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
