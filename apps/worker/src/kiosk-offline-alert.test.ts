import { describe, expect, it } from 'vitest';

import {
  ALERT_COOLDOWN_MS,
  ALERT_OFFLINE_AFTER_MS,
  ALERT_TIME_ZONE,
  ALERT_WINDOW_END_HOUR,
  ALERT_WINDOW_START_HOUR,
  getCasablancaHour,
  isWithinCasablancaAlertWindow,
  shouldAlertKioskOffline,
  type KioskOfflineAlertInput,
} from './kiosk-offline-alert.js';

// En octobre 2026, Africa/Casablanca est à UTC+0.
// 12:00:00Z correspond donc à 12:00:00 à Casablanca (en plein jour, dans la fenêtre 8 h - 22 h).
const BASE_NOW = new Date('2026-10-17T12:00:00.000Z');

// Heartbeat datant de plus de 2 heures (par exemple 2 h 30 min).
const OFFLINE_HEARTBEAT = new Date(BASE_NOW.getTime() - (ALERT_OFFLINE_AFTER_MS + 30 * 60 * 1000));

describe('kiosk-offline-alert (M5 F-54)', () => {
  describe('constantes exportées', () => {
    it('définit les seuils réglementaires et opérationnels', () => {
      expect(ALERT_TIME_ZONE).toBe('Africa/Casablanca');
      expect(ALERT_OFFLINE_AFTER_MS).toBe(2 * 60 * 60 * 1000); // 2 heures
      expect(ALERT_COOLDOWN_MS).toBe(24 * 60 * 60 * 1000); // 24 heures (D-122)
      expect(ALERT_WINDOW_START_HOUR).toBe(8);
      expect(ALERT_WINDOW_END_HOUR).toBe(22);
    });
  });

  describe('getCasablancaHour et isWithinCasablancaAlertWindow', () => {
    it('calcule correctement l heure locale à Casablanca', () => {
      expect(getCasablancaHour(new Date('2026-10-17T08:00:00.000Z'))).toBe(8);
      expect(getCasablancaHour(new Date('2026-10-17T14:30:00.000Z'))).toBe(14);
      expect(getCasablancaHour(new Date('2026-10-17T21:59:59.999Z'))).toBe(21);
      expect(getCasablancaHour(new Date('2026-10-17T22:00:00.000Z'))).toBe(22);
      expect(getCasablancaHour(new Date('2026-10-17T23:00:00.000Z'))).toBe(23);
      expect(getCasablancaHour(new Date('2026-10-17T00:00:00.000Z'))).toBe(0);
      expect(getCasablancaHour(new Date('2026-10-17T07:59:59.999Z'))).toBe(7);
    });

    it('tient compte du décalage saisonnier UTC+1 en été (ex. juillet 2026)', () => {
      // En juillet 2026, Casablanca est à UTC+1 : 07:00 UTC = 08:00 Casablanca
      expect(getCasablancaHour(new Date('2026-07-15T07:00:00.000Z'))).toBe(8);
      expect(isWithinCasablancaAlertWindow(new Date('2026-07-15T07:00:00.000Z'))).toBe(true);
      // 21:00 UTC = 22:00 Casablanca -> hors fenêtre
      expect(getCasablancaHour(new Date('2026-07-15T21:00:00.000Z'))).toBe(22);
      expect(isWithinCasablancaAlertWindow(new Date('2026-07-15T21:00:00.000Z'))).toBe(false);
    });

    it('valide la fenêtre horaire entre 8 h et 22 h (8 h inclus, 22 h exclu)', () => {
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T07:59:59.999Z'))).toBe(false);
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T08:00:00.000Z'))).toBe(true);
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T12:00:00.000Z'))).toBe(true);
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T21:59:59.999Z'))).toBe(true);
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T22:00:00.000Z'))).toBe(false);
      expect(isWithinCasablancaAlertWindow(new Date('2026-10-17T23:30:00.000Z'))).toBe(false);
    });
  });

  describe('shouldAlertKioskOffline', () => {
    describe('statut du kiosque', () => {
      it('renvoie true pour un kiosque ACTIVE qui remplit tous les critères', () => {
        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(true);
      });

      it('renvoie false si le kiosque est DISABLED', () => {
        const kiosk: KioskOfflineAlertInput = {
          status: 'DISABLED',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });

      it('renvoie false si le kiosque est PENDING', () => {
        const kiosk: KioskOfflineAlertInput = {
          status: 'PENDING',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });
    });

    describe('seuils de heartbeat (> 2 h)', () => {
      it('renvoie false si lastHeartbeatAt est null', () => {
        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: null,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });

      it('renvoie false si le dernier heartbeat est récent (< 2 h, ex. 15 min, 1 h)', () => {
        const recentHeartbeat15m = new Date(BASE_NOW.getTime() - 15 * 60 * 1000);
        const recentHeartbeat1h = new Date(BASE_NOW.getTime() - 60 * 60 * 1000);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: recentHeartbeat15m, lastAlertAt: null },
            BASE_NOW,
          ),
        ).toBe(false);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: recentHeartbeat1h, lastAlertAt: null },
            BASE_NOW,
          ),
        ).toBe(false);
      });

      it('renvoie false au seuil exact de 2 heures (date de plus de 2 h requis)', () => {
        // Exactement 2 h = ALERT_OFFLINE_AFTER_MS
        const exactlyTwoHours = new Date(BASE_NOW.getTime() - ALERT_OFFLINE_AFTER_MS);

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: exactlyTwoHours,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });

      it('renvoie true dès que le seuil de 2 heures est franchi (2 h + 1 ms)', () => {
        const justOverTwoHours = new Date(BASE_NOW.getTime() - (ALERT_OFFLINE_AFTER_MS + 1));

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: justOverTwoHours,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(true);
      });

      it('renvoie false si lastHeartbeatAt est dans le futur (décalage d horloge)', () => {
        const futureHeartbeat = new Date(BASE_NOW.getTime() + 10 * 60 * 1000);

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: futureHeartbeat,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });
    });

    describe('fenêtre horaire Africa/Casablanca (8 h à 22 h)', () => {
      it('renvoie true aux bornes intérieures de la fenêtre : 08:00:00 et 21:59:59', () => {
        const at08h00 = new Date('2026-10-17T08:00:00.000Z');
        const at21h59 = new Date('2026-10-17T21:59:59.999Z');

        const kioskAt08: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: new Date(at08h00.getTime() - (ALERT_OFFLINE_AFTER_MS + 1000)),
          lastAlertAt: null,
        };

        const kioskAt21: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: new Date(at21h59.getTime() - (ALERT_OFFLINE_AFTER_MS + 1000)),
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kioskAt08, at08h00)).toBe(true);
        expect(shouldAlertKioskOffline(kioskAt21, at21h59)).toBe(true);
      });

      it('renvoie false juste avant la fenêtre horaire (07:59:59)', () => {
        const at07h59 = new Date('2026-10-17T07:59:59.999Z');

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: new Date(at07h59.getTime() - (ALERT_OFFLINE_AFTER_MS + 1000)),
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, at07h59)).toBe(false);
      });

      it('renvoie false dès la fin de la fenêtre horaire (22:00:00)', () => {
        const at22h00 = new Date('2026-10-17T22:00:00.000Z');

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: new Date(at22h00.getTime() - (ALERT_OFFLINE_AFTER_MS + 1000)),
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, at22h00)).toBe(false);
      });

      it('renvoie false en pleine nuit (ex. 23:00, 02:00, 05:00)', () => {
        const hoursNight = ['23:00:00.000Z', '02:00:00.000Z', '05:00:00.000Z'];

        for (const timeStr of hoursNight) {
          const nightDate = new Date(`2026-10-17T${timeStr}`);
          const kiosk: KioskOfflineAlertInput = {
            status: 'ACTIVE',
            lastHeartbeatAt: new Date(nightDate.getTime() - (ALERT_OFFLINE_AFTER_MS + 1000)),
            lastAlertAt: null,
          };

          expect(shouldAlertKioskOffline(kiosk, nightDate)).toBe(false);
        }
      });
    });

    describe('anti-répétition et seuils d alerte (24 h)', () => {
      it('renvoie true si aucune alerte n a jamais été envoyée (lastAlertAt: null)', () => {
        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: null,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(true);
      });

      it('renvoie false si une alerte a été envoyée récemment (< 24 h, ex. 1 h, 12 h)', () => {
        const alert1hAgo = new Date(BASE_NOW.getTime() - 1 * 60 * 60 * 1000);
        const alert12hAgo = new Date(BASE_NOW.getTime() - 12 * 60 * 60 * 1000);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: OFFLINE_HEARTBEAT, lastAlertAt: alert1hAgo },
            BASE_NOW,
          ),
        ).toBe(false);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: OFFLINE_HEARTBEAT, lastAlertAt: alert12hAgo },
            BASE_NOW,
          ),
        ).toBe(false);
      });

      it('renvoie false juste avant le seuil des 24 h (24 h - 1 ms)', () => {
        const alertJustUnder24h = new Date(BASE_NOW.getTime() - (ALERT_COOLDOWN_MS - 1));

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: alertJustUnder24h,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });

      it('renvoie true au seuil exact de 24 h (aucune alerte depuis moins de 24 h)', () => {
        const alertExactly24h = new Date(BASE_NOW.getTime() - ALERT_COOLDOWN_MS);

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: alertExactly24h,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(true);
      });

      it('renvoie true si la dernière alerte date de plus de 24 h (ex. 25 h, 48 h)', () => {
        const alert25hAgo = new Date(BASE_NOW.getTime() - (ALERT_COOLDOWN_MS + 60 * 60 * 1000));
        const alert48hAgo = new Date(BASE_NOW.getTime() - 2 * ALERT_COOLDOWN_MS);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: OFFLINE_HEARTBEAT, lastAlertAt: alert25hAgo },
            BASE_NOW,
          ),
        ).toBe(true);

        expect(
          shouldAlertKioskOffline(
            { status: 'ACTIVE', lastHeartbeatAt: OFFLINE_HEARTBEAT, lastAlertAt: alert48hAgo },
            BASE_NOW,
          ),
        ).toBe(true);
      });

      it('renvoie false si lastAlertAt est dans le futur (décalage d horloge)', () => {
        const futureAlert = new Date(BASE_NOW.getTime() + 10 * 60 * 1000);

        const kiosk: KioskOfflineAlertInput = {
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastAlertAt: futureAlert,
        };

        expect(shouldAlertKioskOffline(kiosk, BASE_NOW)).toBe(false);
      });
    });
  });
});
