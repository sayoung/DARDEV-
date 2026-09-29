import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { AssetResponse, Paginated } from '@xplor/shared';

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
}
