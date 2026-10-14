import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  HotelCreateSchema,
  HotelUpdateSchema,
  Role,
  type HotelCreate,
  type HotelResponse,
  type HotelUpdate,
  type Principal,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseResourceId } from '../catalog/catalog-http.js';
import { HotelsService } from './hotels.service.js';

function hasBrandColorProperty(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return Reflect.has(body, 'brandColor');
}

function parseHotelCreate(body: unknown): HotelCreate {
  const parsed = HotelCreateSchema.safeParse(body);
  if (!parsed.success) {
    if (
      parsed.error.issues.some(
        (issue) =>
          issue.path.includes('brandColor') &&
          (issue.code !== 'invalid_type' || hasBrandColorProperty(body)),
      )
    ) {
      throw new UnprocessableEntityException();
    }
    throw new BadRequestException();
  }
  return parsed.data;
}

function parseHotelUpdate(body: unknown): HotelUpdate {
  const parsed = HotelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    if (
      parsed.error.issues.some(
        (issue) =>
          issue.path.includes('brandColor') &&
          (issue.code !== 'invalid_type' || hasBrandColorProperty(body)),
      )
    ) {
      throw new UnprocessableEntityException();
    }
    throw new BadRequestException();
  }
  return parsed.data;
}

function requirePrincipal(request: SessionRequest): Principal {
  const principal = request.principal;
  if (principal === undefined) {
    throw new ForbiddenException();
  }
  return principal;
}

function requireAdmin(request: SessionRequest): void {
  const principal = requirePrincipal(request);
  if (principal.role !== Role.ADMIN) {
    throw new ForbiddenException();
  }
}

@Controller('admin/hotels')
@UseGuards(SessionGuard, CsrfGuard)
export class HotelsController {
  constructor(@Inject(HotelsService) private readonly hotels: HotelsService) {}

  @Get()
  list(@Req() request: SessionRequest): Promise<HotelResponse[]> {
    const principal = requirePrincipal(request);
    return this.hotels.list(principal);
  }

  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string): Promise<HotelResponse> {
    const principal = requirePrincipal(request);
    return this.hotels.get(principal, parseResourceId(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: SessionRequest, @Body() body: unknown): Promise<HotelResponse> {
    requireAdmin(request);
    return this.hotels.create(parseHotelCreate(body));
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HotelResponse> {
    requireAdmin(request);
    return this.hotels.update(parseResourceId(id), parseHotelUpdate(body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireAdmin(request);
    await this.hotels.remove(parseResourceId(id));
  }
}
