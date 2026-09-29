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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CityCreateSchema,
  CityUpdateSchema,
  type CityResponse,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId, requireCatalogWriter } from './catalog-http.js';
import { CitiesService } from './cities.service.js';

@Controller('admin/cities')
@UseGuards(SessionGuard, CsrfGuard)
export class CitiesController {
  constructor(@Inject(CitiesService) private readonly cities: CitiesService) {}

  @Get()
  list(): Promise<CityResponse[]> {
    return this.cities.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CityResponse> {
    return this.cities.get(parseResourceId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: SessionRequest, @Body() body: unknown): Promise<CityResponse> {
    requireCatalogWriter(request);
    return this.cities.create(parseBody(CityCreateSchema, body));
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CityResponse> {
    requireCatalogWriter(request);
    return this.cities.update(parseResourceId(id), parseBody(CityUpdateSchema, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireCatalogWriter(request);
    await this.cities.remove(parseResourceId(id));
  }
}
