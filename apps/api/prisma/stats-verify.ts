import { createHash } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { checkStatsConsistency } from '../src/events/stats-consistency.js';

export interface VerifyDb {
  event: {
    count(args?: Prisma.EventCountArgs): Promise<number>;
    groupBy(args: Prisma.EventGroupByArgs): Promise<Array<Record<string, unknown>>>;
  };
}

const CountSchema = z.object({ _count: z.object({ _all: z.number().int().nonnegative() }) });
const ChannelRowSchema = CountSchema.extend({ channel: z.string() });
const LangRowSchema = CountSchema.extend({ lang: z.string() });
const HotelRowSchema = CountSchema.extend({ hotelId: z.string().nullable() });
const TourRowSchema = CountSchema.extend({ tourId: z.string().nullable() });

function deterministicUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function computeDemoSessionIds(now: Date): string[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ids: string[] = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (let sessionIndex = 0; sessionIndex < 12; sessionIndex += 1) {
      const day = new Date(today.getTime() - (6 - dayOffset) * 86_400_000);
      ids.push(deterministicUuid(`xplor-m7-demo-${day.toISOString().slice(0, 10)}-${String(sessionIndex)}`));
    }
  }
  return ids;
}

export async function runStatsVerify(
  db: VerifyDb,
  now = new Date(),
  log: (message: string) => void = console.log,
): Promise<{ ok: boolean; demoPresent: boolean }> {
  const demoSessionIds = computeDemoSessionIds(now);
  const demoCount = await db.event.count({ where: { sessionId: { in: demoSessionIds } } });
  if (demoCount === 0) {
    log('Jeu de démo absent : lancez pnpm --filter @xplor/api stats:demo -- --confirm-dev');
    return { ok: false, demoPresent: false };
  }

  const [total, sessionRows, channelRows, langRows, hotelRows] = await Promise.all([
    db.event.count(),
    db.event.groupBy({ by: ['sessionId'] }),
    db.event.groupBy({ by: ['channel'], _count: { _all: true } }),
    db.event.groupBy({ by: ['lang'], _count: { _all: true } }),
    db.event.groupBy({ by: ['hotelId'], _count: { _all: true } }),
  ]);

  const byChannel: Record<string, number> = {};
  for (const raw of channelRows) {
    const p = ChannelRowSchema.safeParse(raw);
    if (p.success) byChannel[p.data.channel] = p.data._count._all;
  }
  const byLanguage: Record<string, number> = {};
  for (const raw of langRows) {
    const p = LangRowSchema.safeParse(raw);
    if (p.success) byLanguage[p.data.lang] = p.data._count._all;
  }
  let hasNullHotel = false;
  const hotels: Array<{ id: string; total: number }> = [];
  for (const raw of hotelRows) {
    const p = HotelRowSchema.safeParse(raw);
    if (p.success) {
      if (p.data.hotelId === null) hasNullHotel = true;
      else hotels.push({ id: p.data.hotelId, total: p.data._count._all });
    }
  }

  log(`Total d'événements : ${String(total)}`);
  log(`Sessions distinctes : ${String(sessionRows.length)}`);
  log(`Répartition par canal : ${Object.entries(byChannel).map(([k, v]) => `${k}=${String(v)}`).join(', ')}`);
  log(`Répartition par langue : ${Object.entries(byLanguage).map(([k, v]) => `${k}=${String(v)}`).join(', ')}`);
  log(`Totaux par hôtel (groupBy) : ${hotels.map((h) => `${h.id}=${String(h.total)}`).join(', ') || 'aucun'}`);

  log('--- Totaux filtrés par hôtel ---');
  for (const hotel of hotels) {
    const countForHotel = await db.event.count({ where: { hotelId: hotel.id } });
    log(`Hôtel ${hotel.id} : ${String(countForHotel)}`);
  }

  log('--- Totaux filtrés par visite ---');
  const tourRows = await db.event.groupBy({ by: ['tourId'], _count: { _all: true } });
  for (const raw of tourRows) {
    const p = TourRowSchema.safeParse(raw);
    if (p.success) log(`Visite ${p.data.tourId ?? 'aucune'} : ${String(p.data._count._all)}`);
  }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const last7DaysCount = await db.event.count({ where: { occurredAt: { gte: sevenDaysAgo } } });
  log('--- Totaux sur les 7 derniers jours ---');
  log(`Événements sur les 7 derniers jours : ${String(last7DaysCount)}`);

  const consistency = checkStatsConsistency({
    total,
    byChannel,
    byLanguage,
    hotels,
    globalTotal: total,
    allEventsHaveHotel: !hasNullHotel,
  });

  if (!consistency.ok) {
    for (const error of consistency.errors) log(`Erreur de cohérence : ${error}`);
  } else {
    log('Cohérence statistique validée.');
  }

  return { ok: consistency.ok, demoPresent: true };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Vérification refusée en production.');
  const prisma = new PrismaClient();
  try {
    const result = await runStatsVerify(prisma);
    if (!result.ok || !result.demoPresent) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirect = typeof process.argv[1] === 'string' && /[/\\]stats-verify\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
