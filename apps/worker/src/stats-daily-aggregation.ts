import {
  EVENT_TYPES,
  type EventChannel,
  type EventType,
  type StatsDailyRecord,
} from '@xplor/shared';

export interface StatsDailySourceEvent {
  hotelId?: string | null;
  tourId?: string | null;
  channel: EventChannel;
  lang: string;
  sessionId: string;
  type: EventType;
  durationMs?: number | null;
  occurredAt: Date;
}

export interface DayUtcRange {
  dayStart: Date;
  dayEnd: Date;
}

export interface YesterdayAndTodayUtc {
  yesterday: Date;
  today: Date;
}

interface BucketAccumulator {
  hotelId: string | null;
  tourId: string | null;
  channel: EventChannel;
  lang: string;
  sessionIds: Set<string>;
  toursOpened: number;
  scenesViewed: number;
  hotspotClicks: number;
  audioPlays: number;
  vrEntries: number;
  qrShown: number;
  sessionDurationMs: bigint;
}

/**
 * Construit une clé de compartiment déterministe et unique pour le quadruplet
 * (hotelId, tourId, channel, lang), inférieure à 128 caractères.
 */
export function buildBucketKey(params: {
  hotelId?: string | null;
  tourId?: string | null;
  channel: EventChannel;
  lang: string;
}): string {
  const hotelKey = params.hotelId ?? 'none';
  const tourKey = params.tourId ?? 'none';
  return `${hotelKey}:${tourKey}:${params.channel}:${params.lang}`;
}

/**
 * Retourne les dates UTC d'hier et d'aujourd'hui tronquées à minuit UTC.
 */
export function getYesterdayAndTodayUtc(
  referenceDate: Date = new Date(),
): YesterdayAndTodayUtc {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const date = referenceDate.getUTCDate();

  const today = new Date(Date.UTC(year, month, date));
  const yesterday = new Date(Date.UTC(year, month, date - 1));

  return { yesterday, today };
}

/**
 * Calcule l'intervalle [dayStart, dayEnd) en UTC pour un jour cible.
 * La fenêtre s'étend de 00:00:00.000Z (inclus) à 24:00:00.000Z (exclu).
 */
export function getDayUtcRange(day: Date): DayUtcRange {
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  const date = day.getUTCDate();

  const dayStart = new Date(Date.UTC(year, month, date));
  const dayEnd = new Date(Date.UTC(year, month, date + 1));

  return { dayStart, dayEnd };
}

/**
 * Agrège une liste d'événements pour un jour donné en enregistrements StatsDaily.
 * Fonction pure : ne modifie jamais les événements bruts reçus en entrée.
 *
 * Règle d'attribution des sessions (F-80 / M7) :
 * 1. sessions = nombre de sessionId distincts avec SESSION_START dans le compartiment
 *    (hotelId, tourId, channel, lang) de l'événement.
 * 2. sessionDurationMs = somme des durationMs des SESSION_END dans le compartiment
 *    de l'événement SESSION_END.
 * 3. un SESSION_START sans SESSION_END compte pour les sessions et pas pour la durée (durée = 0).
 * 4. un SESSION_END sans SESSION_START ajoute la durée mais pas de session (sessions = 0).
 * 5. un même sessionId présent sur deux compartiments est compté une fois dans chacun.
 *
 * Bornes temporelles :
 * - Seuls les événements survenus dans la fenêtre semi-ouverte [dayStart 00:00:00.000Z, dayEnd 24:00:00.000Z)
 *   sont agrégés. Les événements en-deçà ou au-delà sont ignorés.
 */
export function aggregateEventsForDay(
  events: readonly StatsDailySourceEvent[],
  targetDay: Date,
): StatsDailyRecord[] {
  const { dayStart, dayEnd } = getDayUtcRange(targetDay);
  const startTime = dayStart.getTime();
  const endTime = dayEnd.getTime();

  const buckets = new Map<string, BucketAccumulator>();

  for (const event of events) {
    const eventTime = event.occurredAt.getTime();
    if (eventTime < startTime || eventTime >= endTime) {
      continue;
    }

    const hotelId = event.hotelId ?? null;
    const tourId = event.tourId ?? null;
    const bucketKey = buildBucketKey({
      hotelId,
      tourId,
      channel: event.channel,
      lang: event.lang,
    });

    let acc = buckets.get(bucketKey);
    if (acc === undefined) {
      acc = {
        hotelId,
        tourId,
        channel: event.channel,
        lang: event.lang,
        sessionIds: new Set<string>(),
        toursOpened: 0,
        scenesViewed: 0,
        hotspotClicks: 0,
        audioPlays: 0,
        vrEntries: 0,
        qrShown: 0,
        sessionDurationMs: 0n,
      };
      buckets.set(bucketKey, acc);
    }

    switch (event.type) {
      case EVENT_TYPES.SESSION_START:
        acc.sessionIds.add(event.sessionId);
        break;
      case EVENT_TYPES.SESSION_END:
        if (
          typeof event.durationMs === 'number' &&
          Number.isFinite(event.durationMs) &&
          event.durationMs > 0
        ) {
          acc.sessionDurationMs += BigInt(Math.floor(event.durationMs));
        }
        break;
      case EVENT_TYPES.TOUR_OPEN:
        acc.toursOpened += 1;
        break;
      case EVENT_TYPES.SCENE_VIEW:
        acc.scenesViewed += 1;
        break;
      case EVENT_TYPES.HOTSPOT_CLICK:
        acc.hotspotClicks += 1;
        break;
      case EVENT_TYPES.AUDIO_PLAY:
        acc.audioPlays += 1;
        break;
      case EVENT_TYPES.VR_ENTER:
        acc.vrEntries += 1;
        break;
      case EVENT_TYPES.QR_SHOWN:
        acc.qrShown += 1;
        break;
      case EVENT_TYPES.VR_EXIT:
      case EVENT_TYPES.LANG_CHANGE:
        // Ces interactions n'incrémentent pas de compteur spécifique dans StatsDaily
        break;
    }
  }

  const records: StatsDailyRecord[] = [];
  for (const [bucketKey, acc] of buckets.entries()) {
    records.push({
      day: dayStart,
      bucketKey,
      hotelId: acc.hotelId,
      tourId: acc.tourId,
      channel: acc.channel,
      lang: acc.lang,
      sessions: acc.sessionIds.size,
      toursOpened: acc.toursOpened,
      scenesViewed: acc.scenesViewed,
      hotspotClicks: acc.hotspotClicks,
      audioPlays: acc.audioPlays,
      vrEntries: acc.vrEntries,
      qrShown: acc.qrShown,
      sessionDurationMs: acc.sessionDurationMs,
    });
  }

  return records;
}
