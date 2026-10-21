import { BadRequestException, Controller, ForbiddenException, Get, Inject, Query, Req, Res, UseGuards } from '@nestjs/common';
import { EventChannelSchema, Role } from '@xplor/shared';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { CsrfGuard } from '../auth/csrf.guard.js';
import { SessionGuard } from '../auth/session.guard.js';
import type { SessionRequest } from '../auth/session-request.js';
import { StatsService, type StatsFilters } from './stats.service.js';

const uuid = z.uuid();

function parseFilters(query: Record<string, unknown>): StatsFilters {
  const to = parseDate(query.to, new Date());
  const defaultFrom = new Date(to.getTime() - 30 * 86_400_000);
  const from = parseDate(query.from, defaultFrom);
  const hotelId = parseOptional(query.hotelId, uuid);
  const tourId = parseOptional(query.tourId, uuid);
  const channel = parseOptional(query.channel, EventChannelSchema);
  const lang = parseOptional(query.lang, z.string().min(1).max(8));
  if (to.getTime() <= from.getTime() || to.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new BadRequestException('Période statistique invalide');
  }
  return {
    from, to,
    ...(hotelId === undefined ? {} : { hotelId }),
    ...(tourId === undefined ? {} : { tourId }),
    ...(channel === undefined ? {} : { channel }),
    ...(lang === undefined ? {} : { lang }),
  };
}

function parseDate(value: unknown, fallback: Date): Date {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new BadRequestException('Date invalide');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Date invalide');
  return date;
}

function parseOptional<T extends z.ZodType>(value: unknown, schema: T): z.infer<T> | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('Filtre statistique invalide');
  return parsed.data;
}

@Controller('admin/stats')
@UseGuards(SessionGuard, CsrfGuard)
export class StatsController {
  constructor(@Inject(StatsService) private readonly stats: StatsService) {}

  @Get()
  dashboard(@Req() request: SessionRequest, @Query() query: Record<string, unknown>) {
    const principal = request.principal;
    if (principal === undefined || principal.role === Role.EDITOR) {
      throw new ForbiddenException();
    }
    return this.stats.dashboard(principal, parseFilters(query));
  }

  @Get('export.csv')
  async exportCsv(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const principal = request.principal;
    if (principal === undefined || principal.role === Role.EDITOR) {
      throw new ForbiddenException();
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="xplor-statistiques.csv"');
    return this.stats.exportCsv(principal, parseFilters(query));
  }
}
