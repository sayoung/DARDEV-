import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  TourCreateSchema,
  TourUpdateSchema,
  type Paginated,
  type TourResponse,
  type TourValidationResponse,
  type PreviewTokenResponse,
  type TourLinkMap,
} from '@xplor/shared';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import {
  parseBody,
  parseResourceId,
  parseTourListQuery,
  requireContentManager,
} from './catalog-http.js';
import { TourPublicationService } from './tour-publication.service.js';
import { ToursService } from './tours.service.js';
import { signPreviewToken } from './preview-token.js';

@Controller('admin/tours')
@UseGuards(SessionGuard, CsrfGuard)
export class ToursController {
  constructor(
    @Inject(ToursService) private readonly tours: ToursService,
    @Inject(TourPublicationService) private readonly publication: TourPublicationService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  list(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<Paginated<TourResponse>> {
    requireContentManager(request);
    return this.tours.list(parseTourListQuery(query));
  }

  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourResponse> {
    requireContentManager(request);
    return this.tours.get(parseResourceId(id));
  }

  @Get(':id/graph')
  graph(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourLinkMap> {
    requireContentManager(request);
    return this.tours.getLinkMap(parseResourceId(id));
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  validate(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<TourValidationResponse> {
    requireContentManager(request);
    return this.publication.validate(parseResourceId(id));
  }

  @Post(':id/preview-token')
  @HttpCode(HttpStatus.OK)
  async previewToken(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<PreviewTokenResponse> {
    requireContentManager(request);
    const tourId = parseResourceId(id);
    // Vérifie que la visite existe, 404 sinon.
    await this.tours.get(tourId);
    return signPreviewToken(tourId, this.env.SESSION_SECRET, Date.now());
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourResponse> {
    requireContentManager(request);
    return this.publication.publish(parseResourceId(id));
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourResponse> {
    requireContentManager(request);
    return this.publication.unpublish(parseResourceId(id));
  }

  @Post(':id/share-token')
  @HttpCode(HttpStatus.OK)
  regenerateShareToken(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourResponse> {
    requireContentManager(request);
    return this.publication.regenerateShareToken(parseResourceId(id));
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@Req() request: SessionRequest, @Param('id') id: string): Promise<TourResponse> {
    const principal = requireContentManager(request);
    return this.tours.duplicate(parseResourceId(id), principal.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: SessionRequest, @Body() body: unknown): Promise<TourResponse> {
    const principal = requireContentManager(request);
    return this.tours.create(parseBody(TourCreateSchema, body), principal.userId);
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<TourResponse> {
    requireContentManager(request);
    return this.tours.update(parseResourceId(id), parseBody(TourUpdateSchema, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireContentManager(request);
    await this.tours.remove(parseResourceId(id));
  }
}
