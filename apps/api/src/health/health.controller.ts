import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { HealthService, type HealthBody } from './health.service.js';

@Controller('api/health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async show(@Res({ passthrough: true }) reply: FastifyReply): Promise<HealthBody> {
    const report = await this.health.check();
    reply.status(report.statusCode);
    return report.body;
  }
}
