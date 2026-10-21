import { createHash } from 'node:crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { EVENT_CHANNELS, EVENT_TYPES } from '@xplor/shared';

export interface DemoTour {
  id: string;
  scenes: Array<{ id: string }>;
}

function deterministicUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function makeStatsDemoEvents(tours: DemoTour[], hotelId: string | null, now = new Date()): Prisma.EventCreateManyInput[] {
  const available = tours.filter((tour) => tour.scenes.length > 0);
  if (available.length === 0) throw new Error('Aucune visite publiée avec scène disponible pour la démo.');
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const events: Prisma.EventCreateManyInput[] = [];
  const languages = ['fr', 'ar', 'en'] as const;
  const channels = [EVENT_CHANNELS.WEB, EVENT_CHANNELS.KIOSK, EVENT_CHANNELS.VR] as const;

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (let sessionIndex = 0; sessionIndex < 12; sessionIndex += 1) {
      const day = new Date(today.getTime() - (6 - dayOffset) * 86_400_000);
      const hour = 8 + ((sessionIndex * 3 + dayOffset) % 14);
      const start = new Date(day.getTime() + hour * 3_600_000 + (sessionIndex % 4) * 60_000);
      const sessionId = deterministicUuid(`xplor-m7-demo-${day.toISOString().slice(0, 10)}-${String(sessionIndex)}`);
      const tour = available[(sessionIndex + dayOffset) % available.length];
      if (tour === undefined) continue;
      const scene = tour.scenes[sessionIndex % tour.scenes.length];
      if (scene === undefined) continue;
      const channel = channels[(sessionIndex + dayOffset) % channels.length] ?? EVENT_CHANNELS.WEB;
      const lang = languages[(sessionIndex + dayOffset) % languages.length] ?? 'fr';
      const base = { kioskId: null, hotelId, channel, sessionId, tourId: tour.id, sceneId: scene.id, hotspotId: null, lang };
      const add = (type: EVENT_TYPES, offsetMs: number, durationMs: number | null = null): void => {
        events.push({ ...base, type, occurredAt: new Date(start.getTime() + offsetMs), durationMs });
      };
      add(EVENT_TYPES.SESSION_START, 0);
      add(EVENT_TYPES.TOUR_OPEN, 250);
      add(EVENT_TYPES.SCENE_VIEW, 1_000, 90_000 + sessionIndex * 2_000);
      if (sessionIndex % 2 === 0) add(EVENT_TYPES.HOTSPOT_CLICK, 45_000);
      if (channel === EVENT_CHANNELS.VR) add(EVENT_TYPES.VR_ENTER, 60_000);
      if (channel === EVENT_CHANNELS.WEB && sessionIndex % 3 === 0) add(EVENT_TYPES.QR_SHOWN, 100);
      add(EVENT_TYPES.SESSION_END, 120_000 + sessionIndex * 2_000, 120_000 + sessionIndex * 2_000);
    }
  }
  return events;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--confirm-dev')) {
    throw new Error('Pour éviter toute écriture accidentelle, lancez ce script uniquement en local avec --confirm-dev.');
  }
  const prisma = new PrismaClient();
  try {
    const [tours, hotel] = await Promise.all([
      prisma.tour.findMany({ where: { status: 'PUBLISHED', deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, scenes: { where: { deletedAt: null }, orderBy: { weight: 'asc' }, select: { id: true } } } }),
      prisma.hotel.findFirst({ where: { active: true, deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
    ]);
    const events = makeStatsDemoEvents(tours, hotel?.id ?? null);
    const sessionIds = [...new Set(events.map((event) => event.sessionId))];
    const from = new Date(events.reduce((earliest, event) => Math.min(earliest, new Date(event.occurredAt).getTime()), Date.now()));
    const to = new Date();
    await prisma.event.deleteMany({ where: { sessionId: { in: sessionIds }, receivedAt: { gte: from, lte: to } } });
    await prisma.event.createMany({ data: events });
    console.log(`Jeu de démo créé : ${String(events.length)} événements sur 7 jours (${String(sessionIds.length)} sessions).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.VITEST !== 'true') {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
