import { describe, it, expect } from 'vitest';
import { parseArgs, runPool, findExistingTour, publicUrl, countPlannedHotspots, remapHotspotTargets, matchCity, matchCategory, fetchAllPages } from './import-lib';
import { TourResponse, TourStatus, HotspotType, HotspotCreate, HotspotCreateSchema, CityResponse, CategoryResponse } from '@xplor/shared';
import { buildTourPlan, generateId } from './plan';

describe('import-lib', () => {
  describe('parseArgs', () => {
    const validEnv = {
      XPLOR_API_URL: 'http://localhost:3000',
      XPLOR_ADMIN_EMAIL: 'admin@xplor.ma',
      XPLOR_ADMIN_PASSWORD: 'supersecretpassword',
    };

    it('should parse valid minimal arguments and environment', () => {
      const result = parseArgs([], validEnv);
      expect(result).toMatchObject({
        apiUrl: 'http://localhost:3000',
        email: 'admin@xplor.ma',
        password: 'supersecretpassword',
        replace: false,
        dryRun: false,
        timeoutSec: 600,
        concurrency: 3,
        dir: 'D:/DARDEV/local/xplor-panoramas-test/visite-oudayas/pano',
      });
    });

    it('should parse flags correctly', () => {
      const result = parseArgs(['--replace', '--dry-run'], validEnv);
      expect(result.replace).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should parse timeout and concurrency correctly', () => {
      const result = parseArgs(['--timeout', '120', '--concurrency', '2'], validEnv);
      expect(result.timeoutSec).toBe(120);
      expect(result.concurrency).toBe(2);
    });

    it('should not require email and password if --dry-run is true', () => {
      const env = { XPLOR_API_URL: 'http://localhost:3000' };
      const result = parseArgs(['--dry-run'], env);
      expect(result.email).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.dryRun).toBe(true);
    });

    it('should throw an error if missing environment variables', () => {
      expect(() => parseArgs([], {})).toThrowError(/XPLOR_API_URL/);
      expect(() => parseArgs([], { XPLOR_API_URL: 'http://localhost:3000' })).toThrowError(/XPLOR_ADMIN_EMAIL/);
      expect(() => parseArgs([], { XPLOR_API_URL: 'http://localhost:3000', XPLOR_ADMIN_EMAIL: 'admin@xplor.ma' })).toThrowError(/XPLOR_ADMIN_PASSWORD/);
    });

    it('should throw an error if an unknown option is provided', () => {
      expect(() => parseArgs(['--invalid'], validEnv)).toThrowError('Unknown option: --invalid');
    });

    it('should enforce concurrency max limit', () => {
      expect(() => parseArgs(['--concurrency', '4'], validEnv)).toThrowError(/max limit is 3/);
    });

    it('should not leak the password in the validation error message', () => {
      const env = { ...validEnv, XPLOR_ADMIN_PASSWORD: '' }; // triggers min(1)
      try {
        parseArgs([], env);
      } catch (e) {
        if (e instanceof Error) {
          expect(e.message).not.toContain('supersecretpassword');
          expect(e.message).toContain('password');
        } else {
          throw e;
        }
      }
    });
  });

  describe('runPool', () => {
    it('should process items with concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      const activeCount = { current: 0, max: 0 };

      const worker = async (item: number) => {
        activeCount.current++;
        activeCount.max = Math.max(activeCount.max, activeCount.current);
        await new Promise((resolve) => setTimeout(resolve, 50));
        activeCount.current--;
        return item * 2;
      };

      const result = await runPool(items, 2, worker);
      expect(result).toEqual([2, 4, 6, 8, 10]);
      expect(activeCount.max).toBe(2);
    });

    it('should bubble up worker errors', async () => {
      const worker = (item: number) => {
        if (item === 2) return Promise.reject(new Error('Worker failed'));
        return Promise.resolve(item);
      };

      await expect(runPool([1, 2, 3], 2, worker)).rejects.toThrowError('Worker failed');
    });
  });

  describe('findExistingTour', () => {
    it('should return undefined if no matching tour exists', () => {
      const tours: TourResponse[] = [];
      expect(findExistingTour(tours, 'Oudayas')).toBeUndefined();
    });

    it('should return the tour if it matches the french title', () => {
      const tours: TourResponse[] = [
        {
          id: '1',
          title: { fr: 'Autre Visite' },
          status: TourStatus.DRAFT,
          publicShare: true,
          shareToken: 'token1',
          sceneCount: 1,
          createdById: 'user1',
          contentVersion: 1,
          startSceneId: null,
          publishedAt: null,
          summary: { fr: 'Summary' },
          cityId: 'city1',
          categoryIds: ['cat1'],
          coverAssetId: 'asset1',
        },
        {
          id: '2',
          title: { fr: 'Oudayas' },
          status: TourStatus.PUBLISHED,
          publicShare: true,
          shareToken: 'token2',
          sceneCount: 3,
          createdById: 'user1',
          contentVersion: 1,
          startSceneId: null,
          publishedAt: null,
          summary: { fr: 'Summary' },
          cityId: 'city1',
          categoryIds: ['cat1'],
          coverAssetId: 'asset2',
        },
      ];

      const found = findExistingTour(tours, 'Oudayas');
      expect(found).toBeDefined();
      expect(found?.id).toBe('2');
    });
  });

  describe('publicUrl', () => {
    it('should return the correct public URL', () => {
      expect(publicUrl('mytoken')).toBe('https://v.xplor.ma/v/mytoken');
    });
  });
  describe('countPlannedHotspots', () => {
    it('should total all hotspots from all scenes', () => {
      const data = {
        title: 'T',
        city: 'C',
        description: 'D',
        scenes: [
          { file: 'f1', name: 'N1', info: 'I1' },
          { file: 'f2', name: 'N2', info: 'I2' }
        ]
      };
      const assetIds = { f1: generateId(), f2: generateId() };
      const plan = buildTourPlan(data, assetIds);
      expect(countPlannedHotspots(plan)).toBe(6);
    });
  });

  describe('remapHotspotTargets', () => {
    it('should replace targetSceneId with real id from map for SCENE_LINK', () => {
      const fakeSceneId = generateId();
      const realSceneId = generateId();
      const hotspots: HotspotCreate[] = [
        HotspotCreateSchema.parse({ type: HotspotType.SCENE_LINK, targetSceneId: fakeSceneId, yaw: 0, pitch: 0, label: { fr: 'L' } }),
        HotspotCreateSchema.parse({ type: HotspotType.INFO, body: { fr: 'B' }, yaw: 0, pitch: 0, label: { fr: 'L' } }),
      ];
      const idMap = { [fakeSceneId]: realSceneId };
      const remapped = remapHotspotTargets(hotspots, idMap);
      const first = remapped[0];
      if (first && first.type === HotspotType.SCENE_LINK) {
        expect(first.targetSceneId).toBe(realSceneId);
      } else {
        throw new Error('Type mismatch');
      }
      expect(remapped[1]).toEqual(hotspots[1]); // Unchanged
    });

    it('should throw an error if targetSceneId is missing in idMap', () => {
      const fakeSceneId = generateId();
      const hotspots: HotspotCreate[] = [
        HotspotCreateSchema.parse({ type: HotspotType.SCENE_LINK, targetSceneId: fakeSceneId, yaw: 0, pitch: 0, label: { fr: 'L' } }),
      ];
      const idMap = { 'someOtherId': generateId() };
      expect(() => remapHotspotTargets(hotspots, idMap)).toThrow(new RegExp(`Cible de hotspot introuvable dans la correspondance : ${fakeSceneId}`));
    });
  });
  describe('matchCity', () => {
    it('should return the matching city', () => {
      const cities: CityResponse[] = [
        { id: '1', name: { fr: 'Autre' }, region: 'RSK', lat: 0, lng: 0 },
        { id: '2', name: { fr: 'Rabat' }, region: 'RSK', lat: 0, lng: 0 },
      ];
      expect(matchCity(cities, 'Rabat').id).toBe('2');
    });

    it('should return the first city if no match is found', () => {
      const cities: CityResponse[] = [
        { id: '1', name: { fr: 'Casablanca' }, region: 'RSK', lat: 0, lng: 0 },
        { id: '2', name: { fr: 'Tanger' }, region: 'RSK', lat: 0, lng: 0 },
      ];
      expect(matchCity(cities, 'Rabat').id).toBe('1');
    });

    it('should throw an error if the list is empty', () => {
      expect(() => matchCity([], 'Rabat')).toThrowError('[référentiel] Aucune ville trouvée. Créez au moins une ville.');
    });
  });

  describe('matchCategory', () => {
    it('should return a category containing "monument" or "patrimoine"', () => {
      const categories: CategoryResponse[] = [
        { id: '1', name: { fr: 'Nature' }, icon: 'tree', color: '#000', weight: 0 },
        { id: '2', name: { fr: 'Monuments historiques' }, icon: 'monument', color: '#000', weight: 0 },
      ];
      expect(matchCategory(categories).id).toBe('2');

      const categories2: CategoryResponse[] = [
        { id: '1', name: { fr: 'Nature' }, icon: 'tree', color: '#000', weight: 0 },
        { id: '2', name: { fr: 'Patrimoine' }, icon: 'monument', color: '#000', weight: 0 },
      ];
      expect(matchCategory(categories2).id).toBe('2');
    });

    it('should return the first category if no match is found', () => {
      const categories: CategoryResponse[] = [
        { id: '1', name: { fr: 'Nature' }, icon: 'tree', color: '#000', weight: 0 },
        { id: '2', name: { fr: 'Plage' }, icon: 'sun', color: '#000', weight: 0 },
      ];
      expect(matchCategory(categories).id).toBe('1');
    });

    it('should throw an error if the list is empty', () => {
      expect(() => matchCategory([])).toThrowError('[référentiel] Aucune catégorie trouvée. Créez au moins une catégorie.');
    });
  });

  describe('fetchAllPages', () => {
    it('should fetch all pages until hasMore is false', async () => {
      let fetchCount = 0;
      const fetchPage = (page: number) => {
        fetchCount++;
        return Promise.resolve({
          data: [page, page * 10],
          hasMore: page < 3,
        });
      };

      const result = await fetchAllPages(fetchPage);
      expect(fetchCount).toBe(3);
      expect(result).toEqual([1, 10, 2, 20, 3, 30]);
    });
  });

});
