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
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

import { renderShareHtml } from './share-html.js';
import { ViewerService } from './viewer.service.js';
import { verifyPreviewToken } from '../catalog/preview-token.js';

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

@Controller('public/share')
export class PublicShareController {
  constructor(
    @Inject(ViewerService) private readonly viewer: ViewerService,
    @Inject(ENV) private readonly env: Pick<Env, 'PUBLIC_WEB_URL'>,
  ) {}

  @Get(':shareToken')
  @Header('Cache-Control', 'public, max-age=60')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @UseGuards(ThrottlerGuard)
  async get(
    @Param('shareToken') shareTokenParam: string,
    @Query('lang') rawLang: unknown,
  ): Promise<string> {
    const shareToken = parseShareToken(shareTokenParam);
    const lang = parseLangQuery(rawLang);

    const meta = await this.viewer.getShareMeta(shareToken, lang);

    const pageUrl = `${this.env.PUBLIC_WEB_URL}/share/${shareToken}?lang=${lang}`;
    const webAppUrl = `${this.env.PUBLIC_WEB_URL}/v/${shareToken}?lang=${lang}`;

    return renderShareHtml({
      title: meta.title,
      summary: meta.summary,
      coverUrl: meta.coverUrl,
      lang,
      pageUrl,
      webAppUrl,
    });
  }
}

@Controller('public/preview')
export class PublicPreviewController {
  constructor(
    @Inject(ViewerService) private readonly viewer: ViewerService,
    @Inject(ENV) private readonly env: Pick<Env, 'SESSION_SECRET'>,
  ) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  async get(
    @Param('token') token: string,
    @Query('lang') rawLang: unknown,
  ): Promise<TourGraph> {
    const lang = parseLangQuery(rawLang);
    const verification = verifyPreviewToken(token, this.env.SESSION_SECRET, Date.now());

    if (!verification) {
      throw new NotFoundException();
    }

    return this.viewer.getPreviewGraph(verification.tourId, lang);
  }
}

