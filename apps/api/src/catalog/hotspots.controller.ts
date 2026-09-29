import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HotspotCreateSchema, type HotspotResponse } from '@xplor/shared';

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
}
