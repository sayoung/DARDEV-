import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Worker } from 'bullmq';

import { boot } from './main.js';

describe('boot', () => {
  const validEnv = {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://xplor:xplor@localhost:5432/xplor',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'xplor',
    S3_SECRET_KEY: 'xplor-dev-secret',
    S3_BUCKET: 'xplor',
  };

  it('valide l\'environnement puis journalise worker prêt', async () => {
    const messages: string[] = [];
    
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: mockDisconnect,
    } as unknown as PrismaClient;
    
    const mockClose = vi.fn().mockResolvedValue(undefined);
    const mockWorker = {
      close: mockClose,
    } as unknown as Worker;

    const mockStartWorker = vi.fn().mockReturnValue(mockWorker);

    const shutdown = boot(
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
    
    await shutdown();
    
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('ne journalise pas si l\'environnement est invalide', () => {
    const messages: string[] = [];
    expect(() => {
      boot({}, (message) => {
        messages.push(message);
      });
    }).toThrow(/REDIS_URL/);
    expect(messages).toEqual([]);
  });
});
