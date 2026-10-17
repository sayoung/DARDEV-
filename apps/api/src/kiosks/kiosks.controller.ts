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
  KioskCreateSchema,
  KioskUpdateSchema,
  type EnrollmentCodeResponse,
  type Kiosk,
  type KioskCreate,
  type KioskUpdate,
  type Principal,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId } from '../catalog/catalog-http.js';
import { KioskService } from './kiosks.service.js';

function requirePrincipal(request: SessionRequest): Principal {
  const principal = request.principal;
  if (principal === undefined) {
    throw new ForbiddenException();
  }
  return principal;
}

@Controller('admin/kiosks')
@UseGuards(SessionGuard, CsrfGuard)
export class KiosksController {
  constructor(@Inject(KioskService) private readonly kiosks: KioskService) {}

  @Get()
  list(@Req() request: SessionRequest): Promise<Kiosk[]> {
    return this.kiosks.list(requirePrincipal(request));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: SessionRequest, @Body() body: unknown): Promise<Kiosk> {
    const principal = requirePrincipal(request);
    const input: KioskCreate = parseBody(KioskCreateSchema, body);
    return this.kiosks.create(principal, input);
  }

  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string): Promise<Kiosk> {
    return this.kiosks.get(requirePrincipal(request), parseResourceId(id));
  }

  @Patch(':id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<Kiosk> {
    const principal = requirePrincipal(request);
    const kioskId = parseResourceId(id);
    const input: KioskUpdate = parseBody(KioskUpdateSchema, body);
    return this.kiosks.update(principal, kioskId, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    await this.kiosks.remove(requirePrincipal(request), parseResourceId(id));
  }

  @Post(':id/enrollment-code')
  @HttpCode(HttpStatus.OK)
  issueEnrollmentCode(
    @Req() request: SessionRequest,
    @Param('id') id: string,
  ): Promise<EnrollmentCodeResponse> {
    return this.kiosks.issueEnrollmentCode(requirePrincipal(request), parseResourceId(id));
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(@Req() request: SessionRequest, @Param('id') id: string): Promise<Kiosk> {
    return this.kiosks.disable(requirePrincipal(request), parseResourceId(id));
  }
}
