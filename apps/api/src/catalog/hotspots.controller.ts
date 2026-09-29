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
import { HotspotCreateSchema, HotspotUpdateSchema, type HotspotResponse } from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId, requireContentManager } from './catalog-http.js';
import { HotspotsService } from './hotspots.service.js';

@Controller('admin')
@UseGuards(SessionGuard, CsrfGuard)
export class HotspotsController {
  constructor(@Inject(HotspotsService) private readonly hotspots: HotspotsService) {}

  @Get('scenes/:sceneId/hotspots')
  list(
    @Req() request: SessionRequest,
    @Param('sceneId') sceneId: string,
  ): Promise<HotspotResponse[]> {
    requireContentManager(request);
    return this.hotspots.list(parseResourceId(sceneId));
  }

  @Post('scenes/:sceneId/hotspots')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: SessionRequest,
    @Param('sceneId') sceneId: string,
    @Body() body: unknown,
  ): Promise<HotspotResponse> {
    const principal = requireContentManager(request);
    return this.hotspots.create(
      parseResourceId(sceneId),
      parseBody(HotspotCreateSchema, body),
      principal.userId,
    );
  }

  @Patch('hotspots/:id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<HotspotResponse> {
    requireContentManager(request);
    return this.hotspots.update(parseResourceId(id), parseBody(HotspotUpdateSchema, body));
  }

  @Delete('hotspots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireContentManager(request);
    await this.hotspots.remove(parseResourceId(id));
  }
}
