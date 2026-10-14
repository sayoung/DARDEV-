import {
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
  UseGuards,
} from '@nestjs/common';
import {
  HotelCreateSchema,
  HotelUpdateSchema,
  Role,
  type HotelResponse,
  type Principal,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId } from '../catalog/catalog-http.js';
import { HotelsService } from './hotels.service.js';

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
    return this.hotels.create(parseBody(HotelCreateSchema, body));
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HotelResponse> {
    requireAdmin(request);
    return this.hotels.update(parseResourceId(id), parseBody(HotelUpdateSchema, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireAdmin(request);
    await this.hotels.remove(parseResourceId(id));
  }
}
