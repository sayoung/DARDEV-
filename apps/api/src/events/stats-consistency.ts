import { z } from 'zod';

export const HotelStatsSummarySchema = z.object({
  id: z.string(),
  total: z.number().int().nonnegative(),
});

export type HotelStatsSummary = z.infer<typeof HotelStatsSummarySchema>;

export const StatsConsistencyInputSchema = z.object({
  total: z.number().int().nonnegative(),
  byChannel: z.record(z.string(), z.number().int().nonnegative()),
  byLanguage: z.record(z.string(), z.number().int().nonnegative()),
  hotels: z.array(HotelStatsSummarySchema),
  globalTotal: z.number().int().nonnegative(),
  allEventsHaveHotel: z.boolean().optional(),
});

export type StatsConsistencyInput = z.infer<typeof StatsConsistencyInputSchema>;

export const StatsConsistencyOptionsSchema = z.object({
  allEventsHaveHotel: z.boolean().optional(),
});

export type StatsConsistencyOptions = z.infer<typeof StatsConsistencyOptionsSchema>;

export const StatsConsistencyResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
});

export type StatsConsistencyResult = z.infer<typeof StatsConsistencyResultSchema>;

export enum StatsConsistencyErrorCode {
  CHANNEL_SUM_MISMATCH = 'CHANNEL_SUM_MISMATCH',
  LANGUAGE_SUM_MISMATCH = 'LANGUAGE_SUM_MISMATCH',
  HOTELS_SUM_EXCEEDS_GLOBAL = 'HOTELS_SUM_EXCEEDS_GLOBAL',
  HOTELS_SUM_NOT_EQUAL_GLOBAL = 'HOTELS_SUM_NOT_EQUAL_GLOBAL',
}

/**
 * Contrôle de cohérence statistique (M7 F-81 / F-82).
 * Fonction pure sans Prisma ni I/O :
 * 1. somme des canaux = total
 * 2. somme des langues = total
 * 3. somme des totaux par hôtel <= total global (égale si tous les événements ont un hôtel)
 */
export function checkStatsConsistency(
  input: StatsConsistencyInput,
  options?: StatsConsistencyOptions,
): StatsConsistencyResult {
  const parsed = StatsConsistencyInputSchema.safeParse(input);
  if (!parsed.success) {
    const parseErrors: string[] = [];
    for (const issue of parsed.error.issues) {
      parseErrors.push(`Données invalides (${issue.path.join('.') || 'racine'}) : ${issue.message}`);
    }
    return {
      ok: false,
      errors: parseErrors,
    };
  }

  const data = parsed.data;
  const errors: string[] = [];

  let channelSum = 0;
  for (const count of Object.values(data.byChannel)) {
    channelSum += count;
  }
  if (channelSum !== data.total) {
    errors.push(
      `Écart canal : la somme des canaux (${String(channelSum)}) est différente du total (${String(data.total)}).`,
    );
  }

  let languageSum = 0;
  for (const count of Object.values(data.byLanguage)) {
    languageSum += count;
  }
  if (languageSum !== data.total) {
    errors.push(
      `Écart langue : la somme des langues (${String(languageSum)}) est différente du total (${String(data.total)}).`,
    );
  }

  let hotelsSum = 0;
  for (const hotel of data.hotels) {
    hotelsSum += hotel.total;
  }

  let requireHotelEquality = data.allEventsHaveHotel ?? false;
  if (options !== undefined && options.allEventsHaveHotel !== undefined) {
    requireHotelEquality = options.allEventsHaveHotel;
  }

  if (requireHotelEquality) {
    if (hotelsSum !== data.globalTotal) {
      errors.push(
        `Écart hôtel : tous les événements ont un hôtel mais la somme des hôtels (${String(hotelsSum)}) est différente du total global (${String(data.globalTotal)}).`,
      );
    }
  } else {
    if (hotelsSum > data.globalTotal) {
      errors.push(
        `Écart hôtel : la somme des totaux par hôtel (${String(hotelsSum)}) dépasse le total global (${String(data.globalTotal)}).`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
