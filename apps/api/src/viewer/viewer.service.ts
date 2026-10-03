import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Lang, TourGraph } from '@xplor/shared';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.service.js';

@Injectable()
export class ViewerService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Inject(ENV) private env: Pick<Env, 'MEDIA_PUBLIC_URL'>,
  ) {}

  private async loadPublicTour(shareToken: string) {
    const tour = await this.prisma.tour.findFirst({
      where: {
        shareToken,
        publicShare: true,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        city: true,
        categories: {
          include: {
            category: true,
          },
        },
        coverAsset: true,
        scenes: {
          where: { deletedAt: null },
          orderBy: { weight: 'asc' },
          include: {
            panoramaAsset: true,
            ambientAsset: true,
            hotspots: true,
          },
        },
      },
    });

    if (!tour) {
      throw new NotFoundException();
    }

    return tour;
  }

  public async getPublicGraph(shareToken: string, lang: Lang): Promise<TourGraph> {
    await this.loadPublicTour(shareToken);
    throw new Error('not implemented for lang ' + lang);
  }
}
