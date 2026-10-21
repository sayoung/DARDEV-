import { StatsDashboardSchema, type StatsDashboard } from '@xplor/shared';
import { apiFetch } from './client.js';
import { requestJson } from './client.js';

export interface StatsQuery {
  from: string;
  to: string;
  hotelId?: string;
  tourId?: string;
  channel?: string;
  lang?: string;
}

function queryString(query: StatsQuery): string {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from)
    ? new Date(`${query.from}T00:00:00Z`).toISOString()
    : query.from;
  const exclusiveTo = /^\d{4}-\d{2}-\d{2}$/.test(query.to)
    ? new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86_400_000).toISOString()
    : query.to;
  const params = new URLSearchParams({ from, to: exclusiveTo });
  if (query.hotelId) params.set('hotelId', query.hotelId);
  if (query.tourId) params.set('tourId', query.tourId);
  if (query.channel) params.set('channel', query.channel);
  if (query.lang) params.set('lang', query.lang);
  return params.toString();
}

export function getStats(query: StatsQuery): Promise<StatsDashboard> {
  return requestJson(`/api/v1/admin/stats?${queryString(query)}`, StatsDashboardSchema);
}

export async function downloadStatsCsv(query: StatsQuery): Promise<Blob> {
  const response = await apiFetch(`/api/v1/admin/stats/export.csv?${queryString(query)}`);
  if (!response.ok) throw new Error(`Export CSV impossible (${String(response.status)})`);
  return response.blob();
}
