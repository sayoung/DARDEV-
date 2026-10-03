import { AssetResponse, ProcessingStatus } from '@xplor/shared';

export function needsPolling(items: AssetResponse[]): boolean {
  return items.some(
    (item) =>
      item.processingStatus === ProcessingStatus.PENDING ||
      item.processingStatus === ProcessingStatus.PROCESSING
  );
}
