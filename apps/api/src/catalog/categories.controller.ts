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
  CategoryCreateSchema,
  CategoryUpdateSchema,
  type CategoryResponse,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId, requireCatalogWriter } from './catalog-http.js';
import { CategoriesService } from './categories.service.js';

@Controller('admin/categories')
@UseGuards(SessionGuard, CsrfGuard)
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categories: CategoriesService) {}

  @Get()
  list(): Promise<CategoryResponse[]> {
    return this.categories.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<CategoryResponse> {
    return this.categories.get(parseResourceId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: SessionRequest, @Body() body: unknown): Promise<CategoryResponse> {
    requireCatalogWriter(request);
    return this.categories.create(parseBody(CategoryCreateSchema, body));
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CategoryResponse> {
    requireCatalogWriter(request);
    return this.categories.update(parseResourceId(id), parseBody(CategoryUpdateSchema, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireCatalogWriter(request);
    await this.categories.remove(parseResourceId(id));
  }
}
