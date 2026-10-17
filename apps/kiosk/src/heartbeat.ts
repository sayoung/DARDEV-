import {
  KioskHeartbeatRequestSchema,
  type KioskHeartbeatRequest,
} from '@xplor/shared';

const BYTES_PER_MIB = 1_048_576;
const MAX_RECENT_ERRORS = 10;
const MAX_ERROR_LENGTH = 300;

export interface StorageEstimateResult {
  quota?: number;
  usage?: number;
}

export interface StorageEstimateProvider {
  estimate(): Promise<StorageEstimateResult>;
}

export interface BuildHeartbeatInput {
  appVersion: string;
  syncedManifestVersion: string | null;
  storage?: StorageEstimateProvider | undefined;
  recentErrors?: readonly string[];
}

async function computeStorageFreeMb(
  storage: StorageEstimateProvider | undefined,
): Promise<number | null> {
  if (!storage || typeof storage.estimate !== 'function') {
    return null;
  }

  try {
    const estimate = await storage.estimate();
    const quota = estimate.quota;
    const usage = estimate.usage;

    if (
      typeof quota !== 'number' ||
      typeof usage !== 'number' ||
      !Number.isFinite(quota) ||
      !Number.isFinite(usage) ||
      quota < 0 ||
      usage < 0
    ) {
      return null;
    }

    const freeMb = Math.floor((quota - usage) / BYTES_PER_MIB);
    return freeMb >= 0 ? freeMb : 0;
  } catch {
    return null;
  }
}

function truncateRecentErrors(errors: readonly string[] | undefined): string[] {
  if (!errors) {
    return [];
  }

  return errors
    .slice(0, MAX_RECENT_ERRORS)
    .map((error) => error.slice(0, MAX_ERROR_LENGTH));
}

/**
 * Construit et valide la charge utile d'un heartbeat kiosque (API-03, F-65).
 */
export async function buildHeartbeat(
  input: BuildHeartbeatInput,
): Promise<KioskHeartbeatRequest> {
  const storageFreeMb = await computeStorageFreeMb(input.storage);
  const recentErrors = truncateRecentErrors(input.recentErrors);

  return KioskHeartbeatRequestSchema.parse({
    appVersion: input.appVersion,
    syncedManifestVersion: input.syncedManifestVersion,
    storageFreeMb,
    recentErrors,
  });
}
