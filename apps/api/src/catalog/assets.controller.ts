import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AssetUploadRequestSchema, type AssetResponse, type AssetUploadResponse, type Paginated } from '@xplor/shared';

import { CsrfGuard } from '../auth/csrf.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { SessionGuard } from '../auth/session.guard.js';
import { AssetsService } from './assets.service.js';
import { parseAssetListQuery, parseResourceId, requireContentManager } from './catalog-http.js';

@Controller('admin/assets')
@UseGuards(SessionGuard, CsrfGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}

  @Get()
  list(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<Paginated<AssetResponse>> {
    requireContentManager(request);
    return this.assets.list(parseAssetListQuery(query));
  }

  @Get(':id')
  get(@Req() request: SessionRequest, @Param('id') id: string): Promise<AssetResponse> {
    requireContentManager(request);
    return this.assets.get(parseResourceId(id));
  }

  @Post('upload-url')
  createUploadUrl(
    @Req() request: SessionRequest,
    @Body() body: unknown,
  ): Promise<AssetUploadResponse> {
    requireContentManager(request);
    return this.assets.createUploadUrl(AssetUploadRequestSchema.parse(body));
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@Req() request: SessionRequest, @Param('id') id: string): Promise<AssetResponse> {
    requireContentManager(request);
    return this.assets.complete(parseResourceId(id));
  }

  @Post(':id/reprocess')
  @HttpCode(200)
  reprocess(@Req() request: SessionRequest, @Param('id') id: string): Promise<AssetResponse> {
    requireContentManager(request);
    return this.assets.reprocess(parseResourceId(id));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() request: SessionRequest, @Param('id') id: string): Promise<void> {
    requireContentManager(request);
    await this.assets.remove(parseResourceId(id));
  }
}
