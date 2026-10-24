import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventChannelSchema, type Principal, type StatsDashboard } from '@xplor/shared';

import { scopeHotelIds } from '../auth/access-policy.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StatsFilters {
  from: Date;
  to: Date;
  hotelId?: string;
  tourId?: string;
  channel?: string;
  lang?: string;
}

export interface StatsRow {
  key: string | null;
  label: string | null;
  count: bigint | number;
  durationMs: bigint | number | null;
}

export interface StatsPrismaClient {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
}

const MAX_RANGE_DAYS = 366;

@Injectable()
export class StatsService {
  constructor(@Inject(PrismaService) private readonly prisma: StatsPrismaClient) {}

  async dashboard(principal: Principal, filters: StatsFilters): Promise<StatsDashboard> {
    const where = this.buildWhere(principal, filters);
    const summaryQuery = Prisma.sql`
      SELECT
        COUNT(DISTINCT e."sessionId") FILTER (WHERE type = 'SESSION_START') AS sessions,
        COALESCE(AVG(e."durationMs") FILTER (WHERE type = 'SESSION_END'), 0)::bigint AS "averageSessionDurationMs",
        COUNT(*) FILTER (WHERE type = 'TOUR_OPEN') AS "toursOpened",
        COUNT(*) FILTER (WHERE type = 'SCENE_VIEW') AS "scenesViewed",
        COUNT(*) FILTER (WHERE type = 'HOTSPOT_CLICK') AS "hotspotClicks",
        COUNT(*) FILTER (WHERE type = 'VR_ENTER') AS "vrEntries",
        COUNT(*) FILTER (WHERE type = 'QR_SHOWN') AS "qrScans"
      FROM "Event" e WHERE ${where}`;
    const dailyQuery = Prisma.sql`
      SELECT to_char(date_trunc('day', e."occurredAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS key,
        COUNT(DISTINCT e."sessionId") FILTER (WHERE type = 'SESSION_START') AS sessions,
        COUNT(*) FILTER (WHERE type = 'TOUR_OPEN') AS "toursOpened",
        COUNT(*) FILTER (WHERE type = 'SCENE_VIEW') AS "scenesViewed"
      FROM "Event" e WHERE ${where}
      GROUP BY date_trunc('day', e."occurredAt" AT TIME ZONE 'UTC') ORDER BY 1`;
    const hourlyQuery = Prisma.sql`
      SELECT EXTRACT(HOUR FROM e."occurredAt" AT TIME ZONE 'UTC')::int AS key,
        COUNT(DISTINCT e."sessionId") FILTER (WHERE type = 'SESSION_START') AS sessions
      FROM "Event" e WHERE ${where} GROUP BY 1 ORDER BY 1`;
    const topToursQuery = Prisma.sql`
      SELECT e."tourId"::text AS key,
        COALESCE(t.title->>'fr', t.title->>'en', e."tourId"::text) AS label,
        COUNT(*) AS count
      FROM "Event" e LEFT JOIN "Tour" t ON t.id = e."tourId"
      WHERE ${where} AND e.type = 'TOUR_OPEN' AND e."tourId" IS NOT NULL
      GROUP BY e."tourId", t.title ORDER BY count DESC, label LIMIT 10`;
    const topScenesQuery = Prisma.sql`
      SELECT e."sceneId"::text AS key,
        COALESCE(s.title->>'fr', s.title->>'en', e."sceneId"::text) AS label,
        COUNT(*) AS count
      FROM "Event" e LEFT JOIN "Scene" s ON s.id = e."sceneId"
      WHERE ${where} AND e.type = 'SCENE_VIEW' AND e."sceneId" IS NOT NULL
      GROUP BY e."sceneId", s.title ORDER BY count DESC, label LIMIT 10`;
    const languagesQuery = Prisma.sql`
      SELECT e.lang AS key, COUNT(DISTINCT e."sessionId") AS count
      FROM "Event" e WHERE ${where} AND e.type = 'SESSION_START'
      GROUP BY e.lang ORDER BY count DESC, e.lang`;
    const channelsQuery = Prisma.sql`
      SELECT e.channel AS key, COUNT(DISTINCT e."sessionId") AS count
      FROM "Event" e WHERE ${where} AND e.type = 'SESSION_START'
      GROUP BY e.channel ORDER BY count DESC, e.channel`;

    const [summaryRows, dailyRows, hourlyRows, topTours, topScenes, languages, channels] = await Promise.all([
      this.prisma.$queryRaw<Array<Record<string, number | bigint | null>>>(summaryQuery),
      this.prisma.$queryRaw<Array<Record<string, string | number | bigint | null>>>(dailyQuery),
      this.prisma.$queryRaw<Array<Record<string, string | number | bigint | null>>>(hourlyQuery),
      this.prisma.$queryRaw<StatsRow[]>(topToursQuery),
      this.prisma.$queryRaw<StatsRow[]>(topScenesQuery),
      this.prisma.$queryRaw<StatsRow[]>(languagesQuery),
      this.prisma.$queryRaw<StatsRow[]>(channelsQuery),
    ]);
    const summary = summaryRows[0] ?? {};
    const number = (value: unknown): number => Number(value ?? 0);
    return {
      summary: {
        sessions: number(summary.sessions),
        averageSessionDurationMs: number(summary.averageSessionDurationMs),
        toursOpened: number(summary.toursOpened),
        scenesViewed: number(summary.scenesViewed),
        hotspotClicks: number(summary.hotspotClicks),
        vrEntries: number(summary.vrEntries),
        qrScans: number(summary.qrScans),
      },
      daily: dailyRows.map((row) => ({
        day: String(row.key), sessions: number(row.sessions),
        toursOpened: number(row.toursOpened), scenesViewed: number(row.scenesViewed),
      })),
      hourly: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sessions: number(hourlyRows.find((row) => Number(row.key) === hour)?.sessions),
      })),
      topTours: topTours.map((row) => ({ id: String(row.key), label: row.label ?? String(row.key), opens: number(row.count) })),
      topScenes: topScenes.map((row) => ({ id: String(row.key), label: row.label ?? String(row.key), views: number(row.count) })),
      languages: languages.map((row) => ({ lang: String(row.key), sessions: number(row.count) })),
      channels: channels.map((row) => ({ channel: String(row.key), sessions: number(row.count) })),
    };
  }

  async exportCsv(principal: Principal, filters: StatsFilters): Promise<string> {
    const data = await this.dashboard(principal, filters);
    const lines = [
      ['Indicateur', 'Valeur'],
      ['Sessions', data.summary.sessions],
      ['Durée moyenne de session (ms)', data.summary.averageSessionDurationMs],
      ['Visites ouvertes', data.summary.toursOpened],
      ['Scènes vues', data.summary.scenesViewed],
      ['Clics sur les points', data.summary.hotspotClicks],
      ['Entrées VR', data.summary.vrEntries],
      ['Scans QR', data.summary.qrScans],
      [], ['Jour', 'Sessions', 'Visites ouvertes', 'Scènes vues'],
      ...data.daily.map((row) => [row.day, row.sessions, row.toursOpened, row.scenesViewed]),
      [], ['Top visites', 'Ouvertures'],
      ...data.topTours.map((row) => [row.label, row.opens]),
      [], ['Top scènes', 'Vues'],
      ...data.topScenes.map((row) => [row.label, row.views]),
    ];
    const escape = (value: unknown): string => {
      let text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    return `\uFEFF${lines.map((line) => line.map(escape).join(';')).join('\r\n')}`;
  }

  private buildWhere(principal: Principal, filters: StatsFilters): Prisma.Sql {
    const range = filters.to.getTime() - filters.from.getTime();
    if (!Number.isFinite(range) || range < 0 || range > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException('Période statistique invalide');
    }
    if (filters.channel !== undefined && !EventChannelSchema.safeParse(filters.channel).success) {
      throw new BadRequestException('Canal statistique invalide');
    }
    const scope = scopeHotelIds(principal);
    if (scope !== 'ALL' && scope.length === 0) throw new ForbiddenException();
    if (filters.hotelId !== undefined && scope !== 'ALL' && !scope.includes(filters.hotelId)) {
      throw new NotFoundException();
    }
    const clauses: Prisma.Sql[] = [
      Prisma.sql`e."receivedAt" >= ${filters.from}`,
      Prisma.sql`e."receivedAt" < ${filters.to}`,
    ];
    if (filters.hotelId !== undefined) clauses.push(Prisma.sql`e."hotelId" = ${filters.hotelId}::uuid`);
    else if (scope !== 'ALL') clauses.push(Prisma.sql`e."hotelId" IN (${Prisma.join(scope.map((id) => Prisma.sql`${id}::uuid`))})`);
    if (filters.tourId !== undefined) clauses.push(Prisma.sql`e."tourId" = ${filters.tourId}::uuid`);
    if (filters.channel !== undefined) clauses.push(Prisma.sql`e.channel = ${filters.channel}::"EventChannel"`);
    if (filters.lang !== undefined) clauses.push(Prisma.sql`e.lang = ${filters.lang}`);
    return Prisma.join(clauses, ' AND ');
  }
}
