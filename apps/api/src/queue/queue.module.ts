import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PANORAMA_QUEUE_NAME } from '@xplor/shared';

import { ENV } from '../config/config.module.js';
import { type Env } from '../config/env.js';
import { PANORAMA_QUEUE, PanoramaQueueService } from './panorama-queue.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PANORAMA_QUEUE,
      inject: [ENV],
      useFactory: (env: Env) => {
        return new Queue(PANORAMA_QUEUE_NAME, {
          connection: {
            url: env.REDIS_URL,
          },
        });
      },
    },
    PanoramaQueueService,
  ],
  exports: [PanoramaQueueService],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(PANORAMA_QUEUE) private readonly panoramaQueue: Queue) {}

  async onModuleDestroy() {
    await this.panoramaQueue.close();
  }
}
