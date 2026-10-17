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
  Put,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  HotelCreateSchema,
  HotelManagersUpdateSchema,
  HotelUpdateSchema,
  Role,
  SelectionUpdateSchema,
  type HotelCreate,
  type HotelManagersResponse,
  type HotelResponse,
  type HotelUpdate,
  type Principal,
  type SelectionResponse,
  type SelectionUpdate,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId } from '../catalog/catalog-http.js';
import { HotelManagersService } from './hotel-managers.service.js';
import { HotelsService } from './hotels.service.js';
import { SelectionService } from './selection.service.js';

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
  constructor(
    @Inject(HotelsService) private readonly hotels: HotelsService,
    @Inject(HotelManagersService) private readonly hotelManagers: HotelManagersService,
    @Inject(SelectionService) private readonly selection: SelectionService,
  ) {}

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

  @Get(':id/managers')
  async listManagers(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<HotelManagersResponse> {
    const principal = requirePrincipal(request);
    const managers = await this.hotelManagers.list(principal, parseResourceId(id));
    return { managers };
  }

  @Put(':id/managers')
  async replaceManagers(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HotelManagersResponse> {
    requireAdmin(request);
    const hotelId = parseResourceId(id);
    const payload = parseBody(HotelManagersUpdateSchema, body);
    const managers = await this.hotelManagers.replace(hotelId, payload.userIds);
    return { managers };
  }

  @Get(':id/selection')
  getSelection(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<SelectionResponse> {
    return this.selection.get(requirePrincipal(request), parseResourceId(id));
  }

  @Put(':id/selection')
  replaceSelection(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SelectionResponse> {
    const principal = requirePrincipal(request);
    const hotelId = parseResourceId(id);
    const payload: SelectionUpdate = parseBody(SelectionUpdateSchema, body);
    return this.selection.replace(principal, hotelId, payload);
  }
}
