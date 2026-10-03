import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LANGS, type Lang, type TourGraph } from '@xplor/shared';
import { z } from 'zod';

import { ViewerService } from './viewer.service.js';

const shareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{1,22}$/);
const langSchema = z.enum(LANGS).optional().default('fr');

function parseShareToken(raw: string): string {
  const parsed = shareTokenSchema.safeParse(raw);
  if (!parsed.success) {
    throw new NotFoundException();
  }
  return parsed.data;
}

function parseLangQuery(raw: unknown): Lang {
  const parsed = langSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestException();
  }
  return parsed.data;
}

@Controller('public/tours')
export class PublicToursController {
  constructor(@Inject(ViewerService) private readonly viewer: ViewerService) {}

  @Get(':shareToken')
  @Header('Cache-Control', 'public, max-age=60')
  @UseGuards(ThrottlerGuard)
  get(
    @Param('shareToken') shareTokenParam: string,
    @Query('lang') rawLang: unknown,
  ): Promise<TourGraph> {
    const shareToken = parseShareToken(shareTokenParam);
    const lang = parseLangQuery(rawLang);
    return this.viewer.getPublicGraph(shareToken, lang);
  }
}
