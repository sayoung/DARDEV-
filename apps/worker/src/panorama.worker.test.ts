/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePanoramaFailure, startPanoramaWorker } from './panorama.worker.js';
import { PANORAMA_QUEUE_NAME, PANORAMA_WORKER_CONCURRENCY, PanoramaJobData } from '@xplor/shared';
import * as processorModule from './processors/panorama.processor.js';
import { Job } from 'bullmq';
import { AssetRepository } from './asset-repository.js';

// Mock du module processeur
vi.mock('./processors/panorama.processor.js', () => {
  return {
    processPanoramaJob: vi.fn(),
  };
});

// Mock complet de bullmq
const mockWorkerInstance = {
  on: vi.fn(),
};
let workerArgs: unknown[] = [];

vi.mock('bullmq', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    Worker: class MockWorker {
      constructor(...args: unknown[]) {
        workerArgs = args;
        return mockWorkerInstance;
      }
    },
  };
});

describe('panorama.worker', () => {
  let mockRepo: AssetRepository;
  let mockLog: ReturnType<typeof vi.fn>;
  let mockDeps: processorModule.PanoramaProcessorDeps;

  beforeEach(() => {
    workerArgs = [];
    mockWorkerInstance.on.mockClear();
    vi.mocked(processorModule.processPanoramaJob).mockClear();

    mockRepo = {
      findForProcessing: vi.fn(),
      markReady: vi.fn(),
      markError: vi.fn().mockResolvedValue(undefined),
    };
    mockLog = vi.fn();

    mockDeps = {
      repo: mockRepo,
      storage: {
        getObject: vi.fn(),
        putObject: vi.fn(),
      },
      generateFlat: vi.fn(),
      generateTiles: vi.fn(),
    };
  });

  describe('startPanoramaWorker', () => {
    it('crée un worker avec la bonne file, connexion et concurrence', () => {
      startPanoramaWorker({ redisUrl: 'redis://localhost:6379', deps: mockDeps, log: mockLog });

      expect(workerArgs[0]).toBe(PANORAMA_QUEUE_NAME);
      
      const processor = workerArgs[1] as (job: Job<PanoramaJobData>) => Promise<void>;
      expect(typeof processor).toBe('function');
      
      const opts = workerArgs[2] as { connection: { url: string }, concurrency: number };
      expect(opts).toBeDefined();
      expect(opts.connection.url).toBe('redis://localhost:6379');
      expect(opts.concurrency).toBe(PANORAMA_WORKER_CONCURRENCY);
    });

    it('le processeur transmis appelle processPanoramaJob', async () => {
      startPanoramaWorker({ redisUrl: 'redis://localhost:6379', deps: mockDeps, log: mockLog });
      
      const processor = workerArgs[1] as (job: Job<PanoramaJobData>) => Promise<void>;
      const mockJob = {
        data: { assetId: 'asset-1' },
      } as Job<PanoramaJobData>;

      await processor(mockJob);

      expect(vi.mocked(processorModule.processPanoramaJob)).toHaveBeenCalledWith(mockJob.data, mockDeps);
    });

    it('enregistre un écouteur sur failed', () => {
      startPanoramaWorker({ redisUrl: 'redis://localhost:6379', deps: mockDeps, log: mockLog });
      expect(mockWorkerInstance.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('handlePanoramaFailure', () => {
    it('appelle markError à la dernière tentative (attemptsMade 3, attempts 3)', () => {
      const mockJob = {
        data: { assetId: 'asset-1' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as unknown as Job<PanoramaJobData>;
      const err = new Error('Test error');

      handlePanoramaFailure(mockJob, err, mockRepo, mockLog);

      expect(vi.mocked(mockRepo.markError)).toHaveBeenCalledWith(
        'asset-1',
        'Échec du traitement après 3 tentatives : Test error'
      );
    });

    it('n\'appelle pas markError avant la dernière tentative (attemptsMade 1, attempts 3)', () => {
      const mockJob = {
        data: { assetId: 'asset-1' },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as unknown as Job<PanoramaJobData>;
      const err = new Error('Test error');

      handlePanoramaFailure(mockJob, err, mockRepo, mockLog);

      expect(vi.mocked(mockRepo.markError)).not.toHaveBeenCalled();
    });

    it('intercepte et journalise toute erreur de markError', async () => {
      vi.mocked(mockRepo.markError).mockRejectedValueOnce(new Error('DB is down'));

      const mockJob = {
        data: { assetId: 'asset-1' },
        attemptsMade: 1,
        opts: { attempts: 1 }, // undefined attempts defaults to 1 so attemptsMade 1 >= 1
      } as unknown as Job<PanoramaJobData>;
      const err = new Error('Process error');

      handlePanoramaFailure(mockJob, err, mockRepo, mockLog);

      // handlePanoramaFailure ne renvoie pas de Promise, c'est asynchrone non attendu
      // On utilise un petit délai pour que le .catch s'exécute
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockLog).toHaveBeenCalledWith("Erreur lors du markError pour l'asset asset-1: DB is down");
    });
    
    it('ne fait rien si job est undefined', () => {
      handlePanoramaFailure(undefined, new Error('error'), mockRepo, mockLog);
      expect(vi.mocked(mockRepo.markError)).not.toHaveBeenCalled();
    });
  });
});
