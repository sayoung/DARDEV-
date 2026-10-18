import type { KioskStatus } from '@xplor/shared';

/** Fuseau horaire de référence pour les alertes Xplor (F-54). */
export const ALERT_TIME_ZONE = 'Africa/Casablanca';

/** Durée sans heartbeat déclenchant l'alerte (2 heures en millisecondes). */
export const ALERT_OFFLINE_AFTER_MS = 2 * 60 * 60 * 1000;

/** Période minimale entre deux alertes pour un même kiosque (24 heures en millisecondes, D-122). */
export const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Heure de début de la fenêtre d'alerte (incluse : 08:00:00). */
export const ALERT_WINDOW_START_HOUR = 8;

/** Heure de fin de la fenêtre d'alerte (exclue : 22:00:00). */
export const ALERT_WINDOW_END_HOUR = 22;

const casablancaHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ALERT_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

/**
 * Extrait l'heure locale (0 à 23) dans le fuseau Africa/Casablanca.
 */
export function getCasablancaHour(date: Date): number {
  const parts = casablancaHourFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === 'hour');
  if (hourPart === undefined) {
    return date.getUTCHours();
  }
  const hour = Number.parseInt(hourPart.value, 10);
  return Number.isNaN(hour) ? date.getUTCHours() : hour;
}

/**
 * Vérifie si une date se situe dans la plage horaire autorisée pour les alertes (8 h à 22 h heure de Casablanca).
 */
export function isWithinCasablancaAlertWindow(date: Date): boolean {
  const hour = getCasablancaHour(date);
  return hour >= ALERT_WINDOW_START_HOUR && hour < ALERT_WINDOW_END_HOUR;
}

export interface KioskOfflineAlertInput {
  status: KioskStatus;
  lastHeartbeatAt: Date | null;
  lastAlertAt: Date | null;
}

/**
 * Détermine si une alerte de kiosque hors ligne doit être envoyée (F-54).
 *
 * Conditions (toutes requises) :
 * 1. Le kiosque est dans le statut ACTIVE.
 * 2. Le dernier heartbeat date de plus de 2 heures (strictement > 2 h).
 * 3. L'heure locale Africa/Casablanca (Intl.DateTimeFormat) est entre 8 h et 22 h (8 h inclus, 22 h exclu).
 * 4. Aucune alerte n'a été envoyée depuis moins de 24 h (strictement >= 24 h ou jamais d'alerte).
 */
export function shouldAlertKioskOffline(
  kiosk: KioskOfflineAlertInput,
  now: Date,
): boolean {
  if (kiosk.status !== 'ACTIVE') {
    return false;
  }

  if (kiosk.lastHeartbeatAt === null) {
    return false;
  }

  const heartbeatAgeMs = now.getTime() - kiosk.lastHeartbeatAt.getTime();
  if (heartbeatAgeMs <= ALERT_OFFLINE_AFTER_MS) {
    return false;
  }

  if (!isWithinCasablancaAlertWindow(now)) {
    return false;
  }

  if (kiosk.lastAlertAt !== null) {
    const alertAgeMs = now.getTime() - kiosk.lastAlertAt.getTime();
    if (alertAgeMs < ALERT_COOLDOWN_MS) {
      return false;
    }
  }

  return true;
}
