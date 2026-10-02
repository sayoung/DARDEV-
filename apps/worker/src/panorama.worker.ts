import { Worker, Job } from 'bullmq';
import { PANORAMA_QUEUE_NAME, PANORAMA_WORKER_CONCURRENCY, PanoramaJobData } from '@xplor/shared';
import { processPanoramaJob, PanoramaProcessorDeps } from './processors/panorama.processor.js';
import { AssetRepository } from './asset-repository.js';

export function handlePanoramaFailure(
  job: Job<PanoramaJobData> | undefined,
  err: Error,
  repo: AssetRepository,
  log: (m: string) => void
): void {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    const msg = `Échec du traitement après ${String(job.attemptsMade)} tentatives : ${err.message}`;
    repo.markError(job.data.assetId, msg).catch((e: unknown) => {
      const errorMsg = e instanceof Error ? e.message : String(e);
      log(`Erreur lors du markError pour l'asset ${job.data.assetId}: ${errorMsg}`);
    });
  }
}

export function startPanoramaWorker(opts: {
  redisUrl: string;
  deps: PanoramaProcessorDeps;
  log: (m: string) => void;
}): Worker {
  const worker = new Worker<PanoramaJobData>(
    PANORAMA_QUEUE_NAME,
    async (job) => processPanoramaJob(job.data, opts.deps),
    {
      connection: { url: opts.redisUrl },
      concurrency: PANORAMA_WORKER_CONCURRENCY,
    }
  );

  worker.on('failed', (job, err) => {
    handlePanoramaFailure(job, err, opts.deps.repo, opts.log);
  });

  return worker;
}
