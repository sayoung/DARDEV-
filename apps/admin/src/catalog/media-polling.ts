import { AssetResponse, ProcessingStatus } from '@xplor/shared';

export function needsPolling(items: AssetResponse[]): boolean {
  return items.some(
    (item) =>
      item.processingStatus === ProcessingStatus.PENDING ||
      item.processingStatus === ProcessingStatus.PROCESSING
  );
}

export interface WaitUntilAssetReadyOptions {
  intervalMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

export async function waitUntilAssetReady(
  assetId: string,
  options: WaitUntilAssetReadyOptions = {}
): Promise<AssetResponse> {
  const intervalMs = options.intervalMs ?? 2000;
  const maxAttempts = options.maxAttempts ?? 30;
  const signal = options.signal;

  // Since we don't have access to the real getAsset function in tests if we mock it directly without DI, 
  // wait, we can just import getAsset and use vi.mock in tests.
  const { getAsset } = await import('../api/catalog.js');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    const asset = await getAsset(assetId);

    if (asset.processingStatus === ProcessingStatus.READY) {
      return asset;
    }

    if (asset.processingStatus === ProcessingStatus.ERROR) {
      throw new Error('Asset processing failed');
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('Aborted'));
          return;
        }

        const timeoutId = setTimeout(() => {
          if (signal) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve();
        }, intervalMs);

        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new Error('Aborted'));
        };

        if (signal) {
          signal.addEventListener('abort', onAbort);
        }
      });
    }
  }

  throw new Error('Timeout');
}
