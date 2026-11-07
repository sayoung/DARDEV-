import { z } from 'zod';
import {
  EventChannelSchema,
  HotelMonthlyReportDataSchema,
  Role,
  type EventType,
  type HotelMonthlyReportData,
  type HotelMonthlyReportPeriod,
} from '@xplor/shared';

export interface ReportRecipient {
  email: string;
  name: string;
  lang: string;
}

export interface HotelManagerUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: Role | `${Role}`;
  uiLang: string;
}

export interface HotelWithManagers {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  deletedAt: Date | null;
  languages: string[];
  managers: Array<{
    user: HotelManagerUser;
  }>;
}

export interface RawStatsDailyRow {
  hotelId: string | null;
  tourId: string | null;
  channel: string;
  lang: string;
  sessions: number;
  toursOpened: number;
  scenesViewed: number;
  hotspotClicks: number;
  audioPlays: number;
  vrEntries: number;
  qrShown: number;
  sessionDurationMs: bigint;
}

export interface RawEventRow {
  type: EventType | string;
  sessionId?: string;
  durationMs?: number | null;
  tourId: string | null;
  sceneId: string | null;
  lang: string;
  channel: string;
}

export interface RawTourOrSceneTitleRow {
  id: string;
  title: unknown;
}

export interface HotelMonthlyReportPrismaClient {
  hotel: {
    findMany(args: {
      where: { active: boolean; deletedAt: null };
      select: {
        id: true;
        name: true;
        email: true;
        active: true;
        deletedAt: true;
        languages: true;
        managers: {
          select: {
            user: {
              select: {
                id: true;
                name: true;
                email: true;
                active: true;
                role: true;
                uiLang: true;
              };
            };
          };
        };
      };
    }): Promise<HotelWithManagers[]>;
  };
  statsDaily: {
    findMany(args: {
      where: {
        hotelId: string;
        day: { gte: Date; lt: Date };
      };
    }): Promise<RawStatsDailyRow[]>;
  };
  event: {
    findMany(args: {
      where: {
        hotelId: string;
        occurredAt: { gte: Date; lt: Date };
      };
      select: {
        type: true;
        sessionId?: boolean;
        durationMs?: boolean;
        tourId: true;
        sceneId: true;
        lang: true;
        channel: true;
      };
    }): Promise<RawEventRow[]>;
  };
  tour: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; title: true };
    }): Promise<RawTourOrSceneTitleRow[]>;
  };
  scene: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; title: true };
    }): Promise<RawTourOrSceneTitleRow[]>;
  };
}

export interface HotelMonthlyReportRepository {
  listActiveHotels(): Promise<HotelWithManagers[]>;
  getHotelMonthlyReportData(
    hotelId: string,
    hotelName: string,
    from: Date,
    to: Date,
    lang?: string,
  ): Promise<HotelMonthlyReportData>;
}

/**
 * Détermine les destinataires du rapport mensuel pour un hôtel selon sa configuration (F-83).
 * Seuls les gestionnaires d'hôtel actifs (rôle HOTEL_MANAGER) et l'e-mail officiel de l'hôtel sont retenus.
 * Les e-mails sont normalisés et dédoublonnés. Aucun voyageur n'est ciblé (respect RGPD / loi 09-08).
 */
export function resolveHotelReportRecipients(
  hotel: HotelWithManagers,
): ReportRecipient[] {
  if (!hotel.active || hotel.deletedAt !== null) {
    return [];
  }

  const recipients: ReportRecipient[] = [];
  const seenEmails = new Set<string>();

  // 1. Gestionnaires d'hôtel actifs rattachés
  for (const item of hotel.managers) {
    const user = item.user;
    if (user.active && user.role === Role.HOTEL_MANAGER) {
      const email = user.email.trim().toLowerCase();
      if (email.length > 0 && !seenEmails.has(email)) {
        seenEmails.add(email);
        recipients.push({
          email,
          name: user.name,
          lang: user.uiLang.length > 0 ? user.uiLang : 'fr',
        });
      }
    }
  }

  // 2. Adresse de contact officielle de l'hôtel
  if (hotel.email !== null) {
    const hotelEmail = hotel.email.trim().toLowerCase();
    if (hotelEmail.length > 0 && !seenEmails.has(hotelEmail)) {
      seenEmails.add(hotelEmail);
      const defaultLang = hotel.languages[0];
      recipients.push({
        email: hotelEmail,
        name: hotel.name,
        lang: defaultLang !== undefined && defaultLang.length > 0 ? defaultLang : 'fr',
      });
    }
  }

  return recipients;
}

const LocalizedTitleSchema = z.record(z.string(), z.string());

function extractLocalizedTitle(title: unknown, lang: string): string {
  // Suspension temporaire ar/en jusqu'à M8 (décision porteur du 30/09/2026, repli sur fr)
  const targetLang = lang === 'ar' || (lang !== 'fr' && lang !== 'en') ? 'fr' : lang;
  const parsed = LocalizedTitleSchema.safeParse(title);
  if (parsed.success) {
    const localized = parsed.data[targetLang];
    if (typeof localized === 'string' && localized.length > 0) {
      return localized;
    }
    const fr = parsed.data['fr'];
    if (typeof fr === 'string' && fr.length > 0) {
      return fr;
    }
    const en = parsed.data['en'];
    if (typeof en === 'string' && en.length > 0) {
      return en;
    }
  }
  const str = z.string().safeParse(title);
  if (str.success) {
    return str.data;
  }
  return '';
}

function formatReportPeriod(
  from: Date,
  to: Date,
  lang: string,
): HotelMonthlyReportPeriod {
  const fromStr = from.toISOString().slice(0, 10);
  const toExclusive = new Date(to.getTime() - 86_400_000);
  const toStr = toExclusive.toISOString().slice(0, 10);

  const monthLabelFormatter = new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const periodLabel = monthLabelFormatter.format(from);

  return {
    from: fromStr,
    to: toStr,
    label: periodLabel,
  };
}

interface TitleLookupDelegate {
  findMany(args: {
    where: { id: { in: string[] } };
    select: { id: true; title: true };
  }): Promise<RawTourOrSceneTitleRow[]>;
}

async function resolveTitles(
  delegate: TitleLookupDelegate,
  ids: string[],
  lang: string,
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const rows = await delegate.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true },
  });
  const titleMap = new Map<string, string>();
  for (const row of rows) {
    const titleStr = extractLocalizedTitle(row.title, lang);
    titleMap.set(row.id, titleStr.length > 0 ? titleStr : row.id);
  }
  return titleMap;
}

export class PrismaHotelMonthlyReportRepository implements HotelMonthlyReportRepository {
  constructor(private readonly prisma: HotelMonthlyReportPrismaClient) {}

  async listActiveHotels(): Promise<HotelWithManagers[]> {
    return this.prisma.hotel.findMany({
      where: { active: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        deletedAt: true,
        languages: true,
        managers: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                active: true,
                role: true,
                uiLang: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Calcule le rapport synthétique mensuel pour un hôtel donné (F-83).
   * L'isolation stricte entre hôtels est garantie par le filtrage systématique sur hotelId.
   */
  async getHotelMonthlyReportData(
    hotelId: string,
    hotelName: string,
    from: Date,
    to: Date,
    lang: string = 'fr',
  ): Promise<HotelMonthlyReportData> {
    const period = formatReportPeriod(from, to, lang);

    const [dailyRows, rawEvents] = await Promise.all([
      this.prisma.statsDaily.findMany({
        where: {
          hotelId,
          day: { gte: from, lt: to },
        },
      }),
      this.prisma.event.findMany({
        where: {
          hotelId,
          occurredAt: { gte: from, lt: to },
        },
        select: {
          type: true,
          sessionId: true,
          durationMs: true,
          tourId: true,
          sceneId: true,
          lang: true,
          channel: true,
        },
      }),
    ]);

    let sessions = 0;
    let averageSessionDurationMs = 0;
    let toursOpened = 0;
    let scenesViewed = 0;
    let hotspotClicks = 0;
    let vrEntries = 0;
    let qrScans = 0;

    const tourOpensMap = new Map<string, number>();
    const sceneViewsMap = new Map<string, number>();
    const langCounts = new Map<string, number>();
    const channelCounts = new Map<string, number>();

    // Extraction des événements bruts (déduplication session, scènes vues)
    const sessionStartIds = new Set<string>();
    const langSessionMap = new Map<string, Set<string>>();
    const channelSessionMap = new Map<string, Set<string>>();

    for (const ev of rawEvents) {
      if (ev.type === 'SESSION_START' && typeof ev.sessionId === 'string' && ev.sessionId.length > 0) {
        sessionStartIds.add(ev.sessionId);

        const lSet = langSessionMap.get(ev.lang) ?? new Set<string>();
        lSet.add(ev.sessionId);
        langSessionMap.set(ev.lang, lSet);

        const cSet = channelSessionMap.get(ev.channel) ?? new Set<string>();
        cSet.add(ev.sessionId);
        channelSessionMap.set(ev.channel, cSet);
      } else if (ev.type === 'SCENE_VIEW' && ev.sceneId !== null) {
        const cur = sceneViewsMap.get(ev.sceneId) ?? 0;
        sceneViewsMap.set(ev.sceneId, cur + 1);
      }
    }

    if (dailyRows.length > 0) {
      // 1. Agrégation principale depuis StatsDaily
      let totalDailyDurationMs = 0n;
      const dailyLangMap = new Map<string, number>();
      const dailyChannelMap = new Map<string, number>();

      for (const row of dailyRows) {
        sessions += row.sessions;
        totalDailyDurationMs += row.sessionDurationMs;
        toursOpened += row.toursOpened;
        scenesViewed += row.scenesViewed;
        hotspotClicks += row.hotspotClicks;
        vrEntries += row.vrEntries;
        qrScans += row.qrShown;

        const curLang = dailyLangMap.get(row.lang) ?? 0;
        dailyLangMap.set(row.lang, curLang + row.sessions);

        const curChan = dailyChannelMap.get(row.channel) ?? 0;
        dailyChannelMap.set(row.channel, curChan + row.sessions);

        if (row.tourId !== null) {
          const curTour = tourOpensMap.get(row.tourId) ?? 0;
          tourOpensMap.set(row.tourId, curTour + row.toursOpened);
        }
      }

      // Déduplication des sessions via SESSION_START pour éliminer le surcomptage entre compartiments
      if (sessionStartIds.size > 0) {
        sessions = sessionStartIds.size;
        for (const [l, set] of langSessionMap.entries()) {
          langCounts.set(l, set.size);
        }
        for (const [c, set] of channelSessionMap.entries()) {
          channelCounts.set(c, set.size);
        }
      } else {
        for (const [l, count] of dailyLangMap.entries()) {
          langCounts.set(l, count);
        }
        for (const [c, count] of dailyChannelMap.entries()) {
          channelCounts.set(c, count);
        }
      }

      averageSessionDurationMs =
        sessions > 0 ? Number(totalDailyDurationMs / BigInt(sessions)) : 0;
    } else {
      // 2. Repli complet sur les événements bruts (si StatsDaily n'a pas encore tourné)
      let totalDurationMs = 0;
      let sessionEndCount = 0;

      for (const ev of rawEvents) {
        if (ev.type === 'SESSION_END') {
          if (typeof ev.durationMs === 'number' && ev.durationMs > 0) {
            totalDurationMs += ev.durationMs;
            sessionEndCount += 1;
          }
        } else if (ev.type === 'TOUR_OPEN') {
          toursOpened += 1;
          if (ev.tourId !== null) {
            const cur = tourOpensMap.get(ev.tourId) ?? 0;
            tourOpensMap.set(ev.tourId, cur + 1);
          }
        } else if (ev.type === 'SCENE_VIEW') {
          scenesViewed += 1;
        } else if (ev.type === 'HOTSPOT_CLICK') {
          hotspotClicks += 1;
        } else if (ev.type === 'VR_ENTER') {
          vrEntries += 1;
        } else if (ev.type === 'QR_SHOWN') {
          qrScans += 1;
        }
      }

      sessions = sessionStartIds.size;
      averageSessionDurationMs =
        sessionEndCount > 0 ? Math.round(totalDurationMs / sessionEndCount) : 0;

      for (const [l, set] of langSessionMap.entries()) {
        langCounts.set(l, set.size);
      }
      for (const [c, set] of channelSessionMap.entries()) {
        channelCounts.set(c, set.size);
      }
    }

    // Résolution des libellés de visites et scènes
    const [tourTitleMap, sceneTitleMap] = await Promise.all([
      resolveTitles(this.prisma.tour, Array.from(tourOpensMap.keys()), lang),
      resolveTitles(this.prisma.scene, Array.from(sceneViewsMap.keys()), lang),
    ]);

    const topTours = Array.from(tourOpensMap.entries())
      .map(([id, opens]) => ({
        id,
        label: tourTitleMap.get(id) ?? id,
        opens,
      }))
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 10);

    const topScenes = Array.from(sceneViewsMap.entries())
      .map(([id, views]) => ({
        id,
        label: sceneTitleMap.get(id) ?? id,
        views,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const languages = Array.from(langCounts.entries())
      .map(([l, count]) => ({ lang: l, sessions: count }))
      .sort((a, b) => b.sessions - a.sessions);

    const channels = Array.from(channelCounts.entries())
      .map(([c, count]) => ({
        channel: EventChannelSchema.parse(c),
        sessions: count,
      }))
      .sort((a, b) => b.sessions - a.sessions);

    return HotelMonthlyReportDataSchema.parse({
      hotelId,
      hotelName,
      period,
      summary: {
        sessions,
        averageSessionDurationMs,
        toursOpened,
        scenesViewed,
        hotspotClicks,
        vrEntries,
        qrScans,
      },
      topTours,
      topScenes,
      languages,
      channels,
    });
  }
}
