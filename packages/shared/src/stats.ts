import { z } from 'zod';
import { EventChannelSchema } from './events.js';

export const STATS_DAILY_QUEUE_NAME = 'stats-daily-aggregation';
export const STATS_DAILY_JOB_ID = 'stats-daily-aggregation';
export const STATS_DAILY_INTERVAL_MS = 60 * 60 * 1000; // 1 heure = 3_600_000 ms

export const StatsDailyRecordSchema = z.object({
  day: z.date(),
  bucketKey: z.string().min(1).max(128),
  hotelId: z.uuid().nullable(),
  tourId: z.uuid().nullable(),
  channel: EventChannelSchema,
  lang: z.string().min(1).max(8),
  sessions: z.number().int().nonnegative(),
  toursOpened: z.number().int().nonnegative(),
  scenesViewed: z.number().int().nonnegative(),
  hotspotClicks: z.number().int().nonnegative(),
  audioPlays: z.number().int().nonnegative(),
  vrEntries: z.number().int().nonnegative(),
  qrShown: z.number().int().nonnegative(),
  sessionDurationMs: z.bigint(),
});

export type StatsDailyRecord = z.infer<typeof StatsDailyRecordSchema>;

export const StatsSummarySchema = z.object({
  sessions: z.number().int().nonnegative(),
  averageSessionDurationMs: z.number().int().nonnegative(),
  toursOpened: z.number().int().nonnegative(),
  scenesViewed: z.number().int().nonnegative(),
  hotspotClicks: z.number().int().nonnegative(),
  vrEntries: z.number().int().nonnegative(),
  qrScans: z.number().int().nonnegative(),
});

export const StatsDashboardSchema = z.object({
  summary: StatsSummarySchema,
  daily: z.array(
    z.object({
      day: z.string(),
      sessions: z.number().int().nonnegative(),
      toursOpened: z.number().int().nonnegative(),
      scenesViewed: z.number().int().nonnegative(),
    }),
  ),
  hourly: z.array(
    z.object({
      hour: z.number().int().min(0).max(23),
      sessions: z.number().int().nonnegative(),
    }),
  ),
  topTours: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      opens: z.number().int().nonnegative(),
    }),
  ),
  topScenes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      views: z.number().int().nonnegative(),
    }),
  ),
  languages: z.array(
    z.object({
      lang: z.string(),
      sessions: z.number().int().nonnegative(),
    }),
  ),
  channels: z.array(
    z.object({
      channel: z.string(),
      sessions: z.number().int().nonnegative(),
    }),
  ),
});

export type StatsDashboard = z.infer<typeof StatsDashboardSchema>;
