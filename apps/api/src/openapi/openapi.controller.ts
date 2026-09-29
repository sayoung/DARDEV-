import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { buildOpenApiDocument } from './registry.js';

/** `GET /api/v1/openapi.json`. Absent du contrat servi en production. */
@Controller('openapi.json')
export class OpenApiController {
  constructor(@Inject(ENV) private readonly env: Pick<Env, 'NODE_ENV'>) {}

  @Get()
  show(): ReturnType<typeof buildOpenApiDocument> {
    if (this.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return buildOpenApiDocument();
  }
}
