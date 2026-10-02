import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  PanoramaJobDataSchema,
  PANORAMA_JOB_ATTEMPTS,
  PANORAMA_JOB_BACKOFF_MS,
} from '@xplor/shared';

export const PANORAMA_QUEUE = 'PANORAMA_QUEUE';

@Injectable()
export class PanoramaQueueService {
  constructor(@Inject(PANORAMA_QUEUE) private readonly queue: Queue) {}

  async enqueue(assetId: string): Promise<void> {
    const data = PanoramaJobDataSchema.parse({ assetId });
    await this.queue.add('process', data, {
      jobId: data.assetId,
      attempts: PANORAMA_JOB_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: PANORAMA_JOB_BACKOFF_MS,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
