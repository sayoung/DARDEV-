import { describe, expect, it } from 'vitest';

import {
  ALERT_OFFLINE_AFTER_MS,
  ALERT_COOLDOWN_MS,
} from './kiosk-offline-alert.js';
import {
  buildKioskOfflineEmail,
  formatKioskHeartbeatIso,
  runKioskOfflineCheck,
  type KioskOfflineCandidate,
  type KioskOfflineCheckDeps,
  type KioskOfflineMailMessage,
} from './kiosk-offline-check.js';

// Heure de test en pleine journée à Casablanca (12:00:00Z en octobre 2026 = 12:00:00 locale).
const TEST_NOW = new Date('2026-10-17T12:00:00.000Z');

// Heartbeat vieux de 2h30 (supérieur aux 2 heures requises).
const OFFLINE_HEARTBEAT = new Date(
  TEST_NOW.getTime() - (ALERT_OFFLINE_AFTER_MS + 30 * 60 * 1000),
);

// Heartbeat récent (30 minutes).
const RECENT_HEARTBEAT = new Date(TEST_NOW.getTime() - 30 * 60 * 1000);

interface RecordedMark {
  kioskId: string;
  at: Date;
}

interface TestContext {
  deps: KioskOfflineCheckDeps;
  sentMails: KioskOfflineMailMessage[];
  markedAlerts: RecordedMark[];
}

function createTestHarness(options: {
  kiosks?: KioskOfflineCandidate[];
  adminEmails?: string[];
  sendMailError?: Error;
}): TestContext {
  const sentMails: KioskOfflineMailMessage[] = [];
  const markedAlerts: RecordedMark[] = [];

  const deps: KioskOfflineCheckDeps = {
    listKiosks: (): Promise<KioskOfflineCandidate[]> => {
      return Promise.resolve(options.kiosks ?? []);
    },
    listAdminEmails: (): Promise<string[]> => {
      return Promise.resolve(options.adminEmails ?? ['admin@xplor.ma']);
    },
    sendMail: (mail: KioskOfflineMailMessage): Promise<void> => {
      if (options.sendMailError !== undefined) {
        return Promise.reject(options.sendMailError);
      }
      sentMails.push(mail);
      return Promise.resolve();
    },
    markAlerted: (kioskId: string, at: Date): Promise<void> => {
      markedAlerts.push({ kioskId, at });
      return Promise.resolve();
    },
  };

  return { deps, sentMails, markedAlerts };
}

describe('kiosk-offline-check (M5 F-54)', () => {
  describe('formatKioskHeartbeatIso', () => {
    it('renvoie "inconnu" si la date est null', () => {
      expect(formatKioskHeartbeatIso(null)).toBe('inconnu');
    });

    it('renvoie la chaîne ISO 8601 pour une date valide', () => {
      const date = new Date('2026-10-17T09:30:00.000Z');
      expect(formatKioskHeartbeatIso(date)).toBe('2026-10-17T09:30:00.000Z');
    });
  });

  describe('buildKioskOfflineEmail', () => {
    it('construit un courriel au singulier pour un seul kiosque', () => {
      const single: KioskOfflineCandidate[] = [
        {
          id: 'kiosk-01',
          label: 'Kiosque Réception',
          hotelName: 'Hôtel Rabat Palace',
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastOfflineAlertAt: null,
        },
      ];

      const email = buildKioskOfflineEmail(single);
      expect(email.subject).toBe('[Xplor] Alerte : 1 kiosque hors ligne');
      expect(email.text).toContain('Le kiosque suivant est hors ligne depuis plus de 2 heures :');
      expect(email.text).toContain(
        `- Kiosque : Kiosque Réception | Hôtel : Hôtel Rabat Palace | Dernier heartbeat : ${OFFLINE_HEARTBEAT.toISOString()}`,
      );
    });

    it('construit un courriel au pluriel pour plusieurs kiosques', () => {
      const multiple: KioskOfflineCandidate[] = [
        {
          id: 'kiosk-01',
          label: 'Kiosque Réception',
          hotelName: 'Hôtel Tour Hassan',
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastOfflineAlertAt: null,
        },
        {
          id: 'kiosk-02',
          label: 'Kiosque Lounge',
          hotelName: 'Hôtel Sofitel',
          status: 'ACTIVE',
          lastHeartbeatAt: OFFLINE_HEARTBEAT,
          lastOfflineAlertAt: null,
        },
      ];

      const email = buildKioskOfflineEmail(multiple);
      expect(email.subject).toBe('[Xplor] Alerte : 2 kiosques hors ligne');
      expect(email.text).toContain('Les kiosques suivants sont hors ligne depuis plus de 2 heures :');
      expect(email.text).toContain('Kiosque Réception');
      expect(email.text).toContain('Hôtel Tour Hassan');
      expect(email.text).toContain('Kiosque Lounge');
      expect(email.text).toContain('Hôtel Sofitel');
    });
  });

  describe('runKioskOfflineCheck', () => {
    it('aucun kiosque à alerter : ne rien envoyer ni marquer', async () => {
      const harness = createTestHarness({
        kiosks: [
          // Statut non actif
          {
            id: 'kiosk-pending',
            label: 'Kiosque En Attente',
            hotelName: 'Hôtel A',
            status: 'PENDING',
            lastHeartbeatAt: OFFLINE_HEARTBEAT,
            lastOfflineAlertAt: null,
          },
          // Heartbeat récent (< 2 h)
          {
            id: 'kiosk-recent',
            label: 'Kiosque Récent',
            hotelName: 'Hôtel B',
            status: 'ACTIVE',
            lastHeartbeatAt: RECENT_HEARTBEAT,
            lastOfflineAlertAt: null,
          },
          // Déjà alerté récemment (< 24 h)
          {
            id: 'kiosk-cooldown',
            label: 'Kiosque Déjà Alerté',
            hotelName: 'Hôtel C',
            status: 'ACTIVE',
            lastHeartbeatAt: OFFLINE_HEARTBEAT,
            lastOfflineAlertAt: new Date(TEST_NOW.getTime() - 2 * 60 * 60 * 1000),
          },
        ],
        adminEmails: ['admin1@xplor.ma', 'admin2@xplor.ma'],
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: [] });
      expect(harness.sentMails).toHaveLength(0);
      expect(harness.markedAlerts).toHaveLength(0);
    });

    it('aucun kiosque dans la base : retourne alerted vide immédiatement', async () => {
      const harness = createTestHarness({
        kiosks: [],
        adminEmails: ['admin@xplor.ma'],
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: [] });
      expect(harness.sentMails).toHaveLength(0);
      expect(harness.markedAlerts).toHaveLength(0);
    });

    it('un kiosque à alerter et un admin : envoie un courriel et marque le kiosque alerté', async () => {
      const kioskToAlert: KioskOfflineCandidate = {
        id: 'kiosk-01',
        label: 'Kiosque Hall Principal',
        hotelName: 'Hôtel Rabat Palace',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: null,
      };

      const harness = createTestHarness({
        kiosks: [kioskToAlert],
        adminEmails: ['admin@xplor.ma'],
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: ['kiosk-01'] });

      // Un seul courriel envoyé à l'admin
      expect(harness.sentMails).toHaveLength(1);
      const mail = harness.sentMails[0];
      if (mail === undefined) {
        throw new Error('mail attendu');
      }
      expect(mail.to).toBe('admin@xplor.ma');
      expect(mail.subject).toBe('[Xplor] Alerte : 1 kiosque hors ligne');
      expect(mail.text).toContain('Kiosque Hall Principal');
      expect(mail.text).toContain('Hôtel Rabat Palace');
      expect(mail.text).toContain(OFFLINE_HEARTBEAT.toISOString());

      // Kiosque marqué comme alerté à la date now
      expect(harness.markedAlerts).toEqual([
        {
          kioskId: 'kiosk-01',
          at: TEST_NOW,
        },
      ]);
    });

    it('un kiosque alerté si la dernière alerte date de plus de 24 h', async () => {
      const kioskOldAlert: KioskOfflineCandidate = {
        id: 'kiosk-old',
        label: 'Kiosque Entrée',
        hotelName: 'Hôtel Atlas',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: new Date(
          TEST_NOW.getTime() - (ALERT_COOLDOWN_MS + 60 * 1000),
        ),
      };

      const harness = createTestHarness({
        kiosks: [kioskOldAlert],
        adminEmails: ['admin@xplor.ma'],
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: ['kiosk-old'] });
      expect(harness.sentMails).toHaveLength(1);
      expect(harness.markedAlerts).toEqual([
        {
          kioskId: 'kiosk-old',
          at: TEST_NOW,
        },
      ]);
    });

    it('plusieurs admins : envoie un courriel par admin avec le contenu complet', async () => {
      const kioskA: KioskOfflineCandidate = {
        id: 'kiosk-a',
        label: 'Kiosque A',
        hotelName: 'Hôtel Royal Mansour',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: null,
      };

      const kioskB: KioskOfflineCandidate = {
        id: 'kiosk-b',
        label: 'Kiosque B',
        hotelName: 'Hôtel Tour Hassan',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: null,
      };

      const adminList = [
        'superadmin@xplor.ma',
        'ops@xplor.ma',
        'tech@xplor.ma',
      ];

      const harness = createTestHarness({
        kiosks: [kioskA, kioskB],
        adminEmails: adminList,
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: ['kiosk-a', 'kiosk-b'] });

      // Exactement 3 courriels envoyés (un par admin)
      expect(harness.sentMails).toHaveLength(3);
      for (const [index, adminEmail] of adminList.entries()) {
        const mail = harness.sentMails[index];
        if (mail === undefined) {
          throw new Error('mail attendu');
        }
        expect(mail.to).toBe(adminEmail);
        expect(mail.subject).toBe('[Xplor] Alerte : 2 kiosques hors ligne');
        expect(mail.text).toContain('Kiosque A');
        expect(mail.text).toContain('Hôtel Royal Mansour');
        expect(mail.text).toContain('Kiosque B');
        expect(mail.text).toContain('Hôtel Tour Hassan');
      }

      // Les deux kiosques sont marqués comme alertés
      expect(harness.markedAlerts).toEqual([
        { kioskId: 'kiosk-a', at: TEST_NOW },
        { kioskId: 'kiosk-b', at: TEST_NOW },
      ]);
    });

    it('échec d\'envoi : ne pas appeler markAlerted et laisser l\'erreur remonter', async () => {
      const kioskToAlert: KioskOfflineCandidate = {
        id: 'kiosk-fail',
        label: 'Kiosque Défaillant',
        hotelName: 'Hôtel Palmier',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: null,
      };

      const mailError = new Error('SMTP connection timed out');

      const harness = createTestHarness({
        kiosks: [kioskToAlert],
        adminEmails: ['admin@xplor.ma'],
        sendMailError: mailError,
      });

      await expect(
        runKioskOfflineCheck(harness.deps, TEST_NOW),
      ).rejects.toThrow('SMTP connection timed out');

      // Aucune alerte ne doit être marquée en cas d'échec d'envoi
      expect(harness.markedAlerts).toHaveLength(0);
    });

    it('aucun admin : ne rien envoyer ni marquer', async () => {
      const kioskToAlert: KioskOfflineCandidate = {
        id: 'kiosk-01',
        label: 'Kiosque Sans Admin',
        hotelName: 'Hôtel Oasis',
        status: 'ACTIVE',
        lastHeartbeatAt: OFFLINE_HEARTBEAT,
        lastOfflineAlertAt: null,
      };

      const harness = createTestHarness({
        kiosks: [kioskToAlert],
        adminEmails: [],
      });

      const result = await runKioskOfflineCheck(harness.deps, TEST_NOW);

      expect(result).toEqual({ alerted: [] });
      expect(harness.sentMails).toHaveLength(0);
      expect(harness.markedAlerts).toHaveLength(0);
    });
  });
});
