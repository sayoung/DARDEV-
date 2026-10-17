import { describe, expect, it } from 'vitest';

import type { KioskManifest } from '@xplor/shared';

import { planSync } from './sync-plan.js';

const manifest: KioskManifest = {
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
    tours: [
      {
        id: '00000000-0000-4000-8000-000000000003',
        contentVersion: 2,
        sizeBytes: 100,
        url: '/api/v1/tours/00000000-0000-4000-8000-000000000003',
      },
    ],
  },
  categories: [],
};

describe('planSync', () => {
  it('plans downloads for new and modified tours, preserves unchanged tours, and purges removed tours', () => {
    const addedTour = {
      id: '00000000-0000-4000-8000-000000000004',
      contentVersion: 1,
      sizeBytes: 200,
      url: '/api/v1/tours/00000000-0000-4000-8000-000000000004',
    };
    const changedTour = {
      id: '00000000-0000-4000-8000-000000000005',
      contentVersion: 4,
      sizeBytes: 300,
      url: '/api/v1/tours/00000000-0000-4000-8000-000000000005',
    };
    const unchangedTour = {
      id: '00000000-0000-4000-8000-000000000006',
      contentVersion: 2,
      sizeBytes: 100,
      url: '/api/v1/tours/00000000-0000-4000-8000-000000000006',
    };
    const currentManifest: KioskManifest = {
      ...manifest,
      selection: {
        ...manifest.selection,
        tours: [addedTour, changedTour, unchangedTour],
      },
    };

    expect(
      planSync(
        {
          [changedTour.id]: 3,
          [unchangedTour.id]: 2,
          '00000000-0000-4000-8000-000000000007': 1,
        },
        currentManifest,
      ),
    ).toEqual({
      toDownload: [addedTour, changedTour],
      toPurge: ['00000000-0000-4000-8000-000000000007'],
      upToDate: [unchangedTour.id],
    });
  });

  it('purges every cached tour when the manifest is empty', () => {
    const emptyManifest: KioskManifest = {
      ...manifest,
      selection: { ...manifest.selection, tours: [] },
    };

    expect(planSync({ 'cached-tour-a': 1, 'cached-tour-b': 2 }, emptyManifest)).toEqual({
      toDownload: [],
      toPurge: ['cached-tour-a', 'cached-tour-b'],
      upToDate: [],
    });
  });
});
