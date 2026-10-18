import { describe, expect, it } from 'vitest';

import type { KioskManifest } from '@xplor/shared';

import { runSync, type SyncCache } from './sync-runner.js';

class FakeCache implements SyncCache {
  private readonly versionsMap = new Map<string, number>();
  public readonly downloadedCalls: string[] = [];
  public readonly committedCalls: Array<{ tourId: string; contentVersion: number }> = [];
  public readonly purgedCalls: string[] = [];
  public readonly callHistory: string[] = [];
  public readonly failOnDownload: Set<string> = new Set();
  public readonly failOnCommit: Set<string> = new Set();
  public readonly failOnPurge: Set<string> = new Set();

  constructor(initial: Record<string, number> = {}) {
    for (const [id, version] of Object.entries(initial)) {
      this.versionsMap.set(id, version);
    }
  }

  versions(): Promise<Record<string, number>> {
    const record: Record<string, number> = {};
    for (const [id, version] of this.versionsMap.entries()) {
      record[id] = version;
    }
    return Promise.resolve(record);
  }

  downloadTour(tourId: string): Promise<void> {
    this.downloadedCalls.push(tourId);
    this.callHistory.push(`download:${tourId}`);
    if (this.failOnDownload.has(tourId)) {
      return Promise.reject(new Error(`Download failed for tour ${tourId}`));
    }
    return Promise.resolve();
  }

  commitTour(tourId: string, contentVersion: number): Promise<void> {
    if (this.failOnCommit.has(tourId)) {
      return Promise.reject(new Error(`Commit failed for tour ${tourId}`));
    }
    this.committedCalls.push({ tourId, contentVersion });
    this.callHistory.push(`commit:${tourId}@${String(contentVersion)}`);
    this.versionsMap.set(tourId, contentVersion);
    return Promise.resolve();
  }

  purgeTour(tourId: string): Promise<void> {
    this.purgedCalls.push(tourId);
    this.callHistory.push(`purge:${tourId}`);
    if (this.failOnPurge.has(tourId)) {
      return Promise.reject(new Error(`Purge failed for tour ${tourId}`));
    }
    this.versionsMap.delete(tourId);
    return Promise.resolve();
  }
}

const baseManifest: KioskManifest = {
  manifestVersion: 'v1',
  kiosk: {
    id: '00000000-0000-4000-8000-000000000001',
    label: 'Hall',
    idleTimeoutSeconds: 90,
    deviceType: 'TOUCH_SCREEN',
  },
  hotel: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Hôtel Exemple',
    logoUrl: null,
    brandColor: '#6958A5',
    languages: ['fr'],
    serviceActive: true,
    maintenancePinHash: null,
  },
  selection: {
    featuredTourId: null,
    attractTourIds: [],
    tours: [],
  },
  categories: [],
};

describe('runSync', () => {
  it('télécharge et committe une nouvelle visite absente du cache', async () => {
    const cache = new FakeCache({});
    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-new',
            contentVersion: 1,
            sizeBytes: 1000,
            url: '/api/v1/tours/tour-new',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: ['tour-new'],
      removed: [],
      failed: [],
    });
    expect(cache.downloadedCalls).toEqual(['tour-new']);
    expect(cache.committedCalls).toEqual([{ tourId: 'tour-new', contentVersion: 1 }]);
    expect(await cache.versions()).toEqual({ 'tour-new': 1 });
  });

  it('télécharge et committe une visite modifiée', async () => {
    const cache = new FakeCache({ 'tour-modified': 1 });
    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-modified',
            contentVersion: 2,
            sizeBytes: 2500,
            url: '/api/v1/tours/tour-modified',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: ['tour-modified'],
      removed: [],
      failed: [],
    });
    expect(cache.downloadedCalls).toEqual(['tour-modified']);
    expect(cache.committedCalls).toEqual([{ tourId: 'tour-modified', contentVersion: 2 }]);
    expect(await cache.versions()).toEqual({ 'tour-modified': 2 });
  });

  it('ne committe pas en cas d’échec de téléchargement, conserve l’ancienne version en cache et continue pour les autres', async () => {
    const cache = new FakeCache({ 'tour-failing': 1 });
    cache.failOnDownload.add('tour-failing');

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-failing',
            contentVersion: 2,
            sizeBytes: 1500,
            url: '/api/v1/tours/tour-failing',
          },
          {
            id: 'tour-succeeding',
            contentVersion: 1,
            sizeBytes: 1200,
            url: '/api/v1/tours/tour-succeeding',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: ['tour-succeeding'],
      removed: [],
      failed: ['tour-failing'],
    });
    expect(cache.downloadedCalls).toEqual(['tour-failing', 'tour-succeeding']);
    expect(cache.committedCalls).toEqual([{ tourId: 'tour-succeeding', contentVersion: 1 }]);
    // La version en cache de tour-failing reste intacte à la version 1
    const versions = await cache.versions();
    expect(versions['tour-failing']).toBe(1);
    expect(versions['tour-succeeding']).toBe(1);
  });

  it('purge les visites retirées du manifeste via purgeTour', async () => {
    const cache = new FakeCache({
      'tour-kept': 1,
      'tour-to-remove': 2,
    });

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-kept',
            contentVersion: 1,
            sizeBytes: 1000,
            url: '/api/v1/tours/tour-kept',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: [],
      removed: ['tour-to-remove'],
      failed: [],
    });
    expect(cache.purgedCalls).toEqual(['tour-to-remove']);
    expect(cache.downloadedCalls).toEqual([]);
    expect(cache.committedCalls).toEqual([]);
    expect(await cache.versions()).toEqual({ 'tour-kept': 1 });
  });

  it('ne télécharge ni ne purge rien quand le manifeste est inchangé', async () => {
    const cache = new FakeCache({
      'tour-1': 1,
      'tour-2': 3,
    });

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-1',
            contentVersion: 1,
            sizeBytes: 1000,
            url: '/api/v1/tours/tour-1',
          },
          {
            id: 'tour-2',
            contentVersion: 3,
            sizeBytes: 2000,
            url: '/api/v1/tours/tour-2',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: [],
      removed: [],
      failed: [],
    });
    expect(cache.downloadedCalls).toEqual([]);
    expect(cache.committedCalls).toEqual([]);
    expect(cache.purgedCalls).toEqual([]);
    expect(await cache.versions()).toEqual({ 'tour-1': 1, 'tour-2': 3 });
  });

  it('respecte l’ordre strict de la bascule atomique : downloadTour avant commitTour', async () => {
    const cache = new FakeCache({});
    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-atomic',
            contentVersion: 4,
            sizeBytes: 500,
            url: '/api/v1/tours/tour-atomic',
          },
        ],
      },
    };

    await runSync({ manifest, cache });

    expect(cache.callHistory).toEqual([
      'download:tour-atomic',
      'commit:tour-atomic@4',
    ]);
  });

  it('ajoute la visite à failed si commitTour échoue après downloadTour', async () => {
    const cache = new FakeCache({ 'tour-commit-fail': 1 });
    cache.failOnCommit.add('tour-commit-fail');

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [
          {
            id: 'tour-commit-fail',
            contentVersion: 2,
            sizeBytes: 500,
            url: '/api/v1/tours/tour-commit-fail',
          },
        ],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result).toEqual({
      downloaded: [],
      removed: [],
      failed: ['tour-commit-fail'],
    });
    const versions = await cache.versions();
    expect(versions['tour-commit-fail']).toBe(1);
  });

  it('gère l’échec d’une purge en l’ajoutant à failed tout en poursuivant les autres purges', async () => {
    const cache = new FakeCache({
      'tour-purge-fail': 1,
      'tour-purge-ok': 1,
    });
    cache.failOnPurge.add('tour-purge-fail');

    const manifest: KioskManifest = {
      ...baseManifest,
      selection: {
        ...baseManifest.selection,
        tours: [],
      },
    };

    const result = await runSync({ manifest, cache });

    expect(result.removed).toEqual(['tour-purge-ok']);
    expect(result.failed).toEqual(['tour-purge-fail']);
    expect(cache.purgedCalls).toEqual(['tour-purge-fail', 'tour-purge-ok']);
  });
});
