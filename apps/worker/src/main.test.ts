import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Worker } from 'bullmq';

import { boot, type BootFactories } from './main.js';
import { generateFlatDerivatives } from './derivatives/panorama.derivatives.js';
import { generateTiles } from './derivatives/panorama.tiles.js';

describe('boot', () => {
  const validEnv = {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
  };

  it("valide l'environnement puis journalise worker prêt", async () => {
    const messages: string[] = [];
    
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: mockDisconnect,
    } as unknown as PrismaClient;
    
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockWorker = {
      close: mockClose,
    } as unknown as Worker;

    const mockStartWorker = vi.fn<BootFactories['startWorker']>().mockReturnValue(mockWorker);

    const shutdown = await boot(
      validEnv,
      (message) => {
        messages.push(message);
      },
      {
        createPrisma: () => mockPrisma,
        startWorker: mockStartWorker,
      }
    );

    expect(messages).toEqual(['worker prêt (file panorama, concurrence 2)']);
    expect(mockStartWorker).toHaveBeenCalledTimes(1);
    
    const call = mockStartWorker.mock.calls[0];
    if (!call) {
      expect.fail('startWorker non appelé');
    }
    const callArgs = call[0];
    
    expect(callArgs.redisUrl).toBe(validEnv.REDIS_URL);
    expect(callArgs.deps.repo).toBeDefined();
    expect(callArgs.deps.storage).toBeDefined();
    expect(callArgs.deps.generateFlat).toBe(generateFlatDerivatives);
    expect(callArgs.deps.generateTiles).toBe(generateTiles);
    expect(typeof callArgs.log).toBe('function');
    
    await shutdown();
    
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);

    const closeOrder = mockClose.mock.invocationCallOrder[0];
    const disconnectOrder = mockDisconnect.mock.invocationCallOrder[0];
    if (closeOrder !== undefined && disconnectOrder !== undefined) {
      expect(closeOrder).toBeLessThan(disconnectOrder);
    } else {
      expect.fail("Les fonctions n'ont pas été appelées");
    }
  });

  it('ne journalise pas si l\'environnement est invalide', async () => {
    const messages: string[] = [];
    await expect(boot({}, (message) => {
      messages.push(message);
    })).rejects.toThrow('Invalid environment variables: REDIS_URL, DATABASE_URL, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET');
    expect(messages).toEqual([]);
  });

  it('refuse de démarrer si STORAGE_PROVIDER est local', async () => {
    const messages: string[] = [];
    await expect(boot({ ...validEnv, STORAGE_PROVIDER: 'local' }, (message) => {
      messages.push(message);
    })).rejects.toThrow('Le worker ne supporte pas STORAGE_PROVIDER=local. Utilisez s3 (pas de stockage disque partagé entre API et worker).');
    expect(messages).toEqual([]);
  });
});
