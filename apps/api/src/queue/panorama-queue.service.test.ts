import { type Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { PANORAMA_JOB_ATTEMPTS, PANORAMA_JOB_BACKOFF_MS } from '@xplor/shared';

import { PanoramaQueueService } from './panorama-queue.service.js';

describe('PanoramaQueueService', () => {
  let addMock: ReturnType<typeof vi.fn>;
  let queueMock: Queue;
  let service: PanoramaQueueService;

  beforeEach(() => {
    addMock = vi.fn().mockResolvedValue(undefined);
    queueMock = {
      add: addMock,
    } as unknown as Queue;
    service = new PanoramaQueueService(queueMock);
  });

  it('enqueues a job with correct options', async () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    await service.enqueue(validUuid);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      'process',
      { assetId: validUuid },
      {
        jobId: validUuid,
        attempts: PANORAMA_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: PANORAMA_JOB_BACKOFF_MS },
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );
  });

  it('rejects invalid uuid without calling queue', async () => {
    const invalidUuid = 'not-a-uuid';

    await expect(service.enqueue(invalidUuid)).rejects.toThrow(ZodError);
    expect(addMock).not.toHaveBeenCalled();
  });
});
