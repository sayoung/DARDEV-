import {
  KioskEnrollRequestSchema,
  type KioskEnrollRequest,
  type KioskEnrollResponse,
} from '@xplor/shared';

import { enroll, KioskApiError } from './api/kiosk-api.js';
import { clearCredentials, saveCredentials, type Storage } from './credentials.js';
import { KIOSK_PIN_CACHE_KEY } from './pin-cache.js';

export type EnrollKioskFailureReason = 'INVALID_CODE' | 'NETWORK';

export type EnrollKioskResult =
  | { ok: true }
  | { ok: false; reason: EnrollKioskFailureReason };

export interface EnrollKioskOptions {
  code: string;
  fetchFn: typeof fetch;
  baseUrl: string;
  storage: Storage;
  deviceInfo?: KioskEnrollRequest['deviceInfo'];
}

function resolveDeviceInfo(deviceInfo?: KioskEnrollRequest['deviceInfo']): KioskEnrollRequest['deviceInfo'] {
  if (deviceInfo !== undefined) {
    return deviceInfo;
  }
  const userAgent =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.length > 0
      ? navigator.userAgent.slice(0, 500)
      : 'Xplor Kiosk';
  return { userAgent };
}

/**
 * Enrôle le kiosque auprès de l'API centrale (F-52).
 *
 * 1. Valide le format du code avant tout appel réseau.
 * 2. Appelle le point d'enrôlement API avec le code et les métadonnées de l'appareil.
 * 3. En cas d'échec API, classe l'erreur :
 *    - INVALID_CODE pour UNAUTHORIZED / KIOSK_DISABLED ou statut HTTP 4xx.
 *    - NETWORK pour NETWORK, INVALID_RESPONSE ou statut HTTP 5xx.
 * 4. En cas de succès, sauvegarde les identifiants (kioskId + jeton) dans le stockage local hors du bloc try/catch.
 */
export async function enrollKiosk({
  code,
  fetchFn,
  baseUrl,
  storage,
  deviceInfo,
}: EnrollKioskOptions): Promise<EnrollKioskResult> {
  const codeValidation = KioskEnrollRequestSchema.shape.code.safeParse(code);
  if (!codeValidation.success) {
    return { ok: false, reason: 'INVALID_CODE' };
  }

  const resolvedDeviceInfo = resolveDeviceInfo(deviceInfo);

  let response: KioskEnrollResponse;
  try {
    response = await enroll(fetchFn, baseUrl, code, resolvedDeviceInfo);
  } catch (error: unknown) {
    if (error instanceof KioskApiError) {
      if (error.code === 'NETWORK' || error.code === 'INVALID_RESPONSE') {
        return { ok: false, reason: 'NETWORK' };
      }
      if (
        error.code === 'UNAUTHORIZED' ||
        error.code === 'KIOSK_DISABLED' ||
        (typeof error.status === 'number' && error.status >= 400 && error.status < 500)
      ) {
        return { ok: false, reason: 'INVALID_CODE' };
      }
      return { ok: false, reason: 'NETWORK' };
    }
    return { ok: false, reason: 'NETWORK' };
  }

  saveCredentials(storage, {
    kioskId: response.kioskId,
    token: response.token,
  });

  return { ok: true };
}

/**
 * Réinitialise l'enrôlement du kiosque en effaçant les identifiants locaux (réenrôlement F-67).
 */
export function resetEnrollment(storage: Storage): void {
  clearCredentials(storage);
  storage.removeItem(KIOSK_PIN_CACHE_KEY);
}
