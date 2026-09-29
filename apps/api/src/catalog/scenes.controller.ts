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
  SceneCreateSchema,
  SceneReorderRequestSchema,
  SceneUpdateSchema,
  SetStartSceneRequestSchema,
  type SceneResponse,
  type TourResponse,
} from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { parseBody, parseResourceId, requireContentManager } from './catalog-http.js';
import { ScenesService } from './scenes.service.js';

@Controller('admin')
@UseGuards(SessionGuard, CsrfGuard)
export class ScenesController {
  constructor(@Inject(ScenesService) private readonly scenes: ScenesService) {}

  @Get('tours/:tourId/scenes')
  list(@Req() request: SessionRequest, @Param('tourId') tourId: string): Promise<SceneResponse[]> {
    requireContentManager(request);
    return this.scenes.list(parseResourceId(tourId));
  }

  @Post('tours/:tourId/scenes')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: SessionRequest,
    @Param('tourId') tourId: string,
    @Body() body: unknown,
  ): Promise<SceneResponse> {
    const principal = requireContentManager(request);
    return this.scenes.create(
      parseResourceId(tourId),
      parseBody(SceneCreateSchema, body),
      principal.userId,
    );
  }

  @Post('tours/:tourId/scenes/reorder')
  @HttpCode(HttpStatus.OK)
  reorder(
    @Req() request: SessionRequest,
    @Param('tourId') tourId: string,
    @Body() body: unknown,
  ): Promise<SceneResponse[]> {
    requireContentManager(request);
    return this.scenes.reorder(
      parseResourceId(tourId),
      parseBody(SceneReorderRequestSchema, body).sceneIds,
    );
  }

  @Post('tours/:tourId/scenes/set-start')
  @HttpCode(HttpStatus.OK)
  setStart(
    @Req() request: SessionRequest,
    @Param('tourId') tourId: string,
    @Body() body: unknown,
  ): Promise<TourResponse> {
    requireContentManager(request);
    return this.scenes.setStart(
      parseResourceId(tourId),
      parseBody(SetStartSceneRequestSchema, body).sceneId,
    );
  }

  @Get('scenes/:id')
  get(@Req() request: SessionRequest, @Param('id') id: string): Promise<SceneResponse> {
    requireContentManager(request);
    return this.scenes.get(parseResourceId(id));
  }

  @Patch('scenes/:id')
  update(
    @Req() request: SessionRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<SceneResponse> {
    requireContentManager(request);
    return this.scenes.update(parseResourceId(id), parseBody(SceneUpdateSchema, body));
  }

  @Delete('scenes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireContentManager(request);
    await this.scenes.remove(parseResourceId(id));
  }
}
