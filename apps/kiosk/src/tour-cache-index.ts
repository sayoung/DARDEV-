import { z } from '@xplor/shared';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const TourCacheVersionsSchema = z.record(
  z.string().min(1),
  z.number().int(),
);

export type TourCacheVersions = z.infer<typeof TourCacheVersionsSchema>;

export interface TourCacheIndex {
  versions(): Promise<Record<string, number>>;
  set(tourId: string, contentVersion: number): Promise<void>;
  remove(tourId: string): Promise<void>;
}

export const DEFAULT_TOUR_CACHE_INDEX_KEY = 'xplor.kiosk.tourVersions';

export function createTourCacheIndex(
  storage: Storage,
  key: string = DEFAULT_TOUR_CACHE_INDEX_KEY,
): TourCacheIndex {
  function versions(): Promise<Record<string, number>> {
    try {
      const raw = storage.getItem(key);
      if (raw === null) {
        return Promise.resolve({});
      }
      const parsed: unknown = JSON.parse(raw);
      const result = TourCacheVersionsSchema.safeParse(parsed);
      if (!result.success) {
        return Promise.resolve({});
      }
      return Promise.resolve({ ...result.data });
    } catch {
      return Promise.resolve({});
    }
  }

  async function set(tourId: string, contentVersion: number): Promise<void> {
    const validTourId = z.string().min(1).parse(tourId);
    const validVersion = z.number().int().parse(contentVersion);

    const current = await versions();
    const updated: Record<string, number> = {
      ...current,
      [validTourId]: validVersion,
    };
    TourCacheVersionsSchema.parse(updated);
    storage.setItem(key, JSON.stringify(updated));
  }

  async function remove(tourId: string): Promise<void> {
    const validTourId = z.string().min(1).parse(tourId);

    const current = await versions();
    if (!Object.hasOwn(current, validTourId)) {
      return;
    }

    const updated: Record<string, number> = {};
    for (const [id, version] of Object.entries(current)) {
      if (id !== validTourId) {
        updated[id] = version;
      }
    }
    TourCacheVersionsSchema.parse(updated);
    storage.setItem(key, JSON.stringify(updated));
  }

  return {
    versions,
    set,
    remove,
  };
}
