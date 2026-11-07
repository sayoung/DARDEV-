import { describe, expect, it, vi } from 'vitest';
import { Role, type HotelMonthlyReportData } from '@xplor/shared';
import {
  escapeHtml,
  getPreviousMonthUtcRange,
  renderMonthlyReportMail,
  sendMonthlyHotelReports,
  type HotelMonthlyReportMailMessage,
  type HotelMonthlyReportDeps,
} from './hotel-monthly-report.service.js';
import type {
  HotelMonthlyReportRepository,
  HotelWithManagers,
} from './hotel-monthly-report-repository.js';

describe('hotel-monthly-report.service (F-83)', () => {
  const hotelIdA = '01990000-0000-7000-8000-000000000001';
  const hotelIdB = '01990000-0000-7000-8000-000000000002';
  const hotelIdC = '01990000-0000-7000-8000-000000000003';

  const sampleReportDataA: HotelMonthlyReportData = {
    hotelId: hotelIdA,
    hotelName: 'Hôtel Rabat Palace',
    period: {
      from: '2026-10-01',
      to: '2026-10-31',
      label: 'octobre 2026',
    },
    summary: {
      sessions: 40,
      averageSessionDurationMs: 180_000,
      toursOpened: 35,
      scenesViewed: 110,
      hotspotClicks: 45,
      vrEntries: 6,
      qrScans: 10,
    },
    topTours: [{ id: 'tour-1', label: 'Kasbah des Oudayas', opens: 25 }],
    topScenes: [{ id: 'scene-1', label: 'Bab Oudaya', views: 80 }],
    languages: [{ lang: 'fr', sessions: 40 }],
    channels: [{ channel: 'KIOSK', sessions: 40 }],
  };

  const sampleReportDataB: HotelMonthlyReportData = {
    hotelId: hotelIdB,
    hotelName: 'Hôtel Salé Beach',
    period: {
      from: '2026-10-01',
      to: '2026-10-31',
      label: 'octobre 2026',
    },
    summary: {
      sessions: 80,
      averageSessionDurationMs: 200_000,
      toursOpened: 70,
      scenesViewed: 220,
      hotspotClicks: 90,
      vrEntries: 12,
      qrScans: 20,
    },
    topTours: [{ id: 'tour-2', label: 'Plage de Mehdia', opens: 50 }],
    topScenes: [{ id: 'scene-2', label: 'Vue Mer', views: 160 }],
    languages: [{ lang: 'en', sessions: 80 }],
    channels: [{ channel: 'WEB', sessions: 80 }],
  };

  describe('getPreviousMonthUtcRange', () => {
    it('calcule la plage du mois précédent pour une date standard', () => {
      const now = new Date('2026-11-01T06:00:00.000Z');
      const range = getPreviousMonthUtcRange(now, 'fr');

      expect(range.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(range.fileSlug).toBe('2026-10');
      expect(range.periodLabel.toLowerCase()).toContain('octobre');
      expect(range.periodLabel).toContain('2026');
    });

    it('gère le passage d année au mois de janvier', () => {
      const now = new Date('2027-01-01T06:00:00.000Z');
      const range = getPreviousMonthUtcRange(now, 'fr');

      expect(range.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(range.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
      expect(range.fileSlug).toBe('2026-12');
      expect(range.periodLabel.toLowerCase()).toContain('décembre');
      expect(range.periodLabel).toContain('2026');
    });
  });

  describe('sendMonthlyHotelReports', () => {
    it('génère et envoie le rapport par courriel aux destinataires configurés', async () => {
      const sentMails: HotelMonthlyReportMailMessage[] = [];
      const logs: string[] = [];

      const hotelA: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel Rabat Palace',
        email: 'direction@palace.local',
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [
          {
            user: {
              id: 'user-1',
              name: 'Karim',
              email: 'karim@palace.local',
              active: true,
              role: Role.HOTEL_MANAGER,
              uiLang: 'fr',
            },
          },
        ],
      };

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([hotelA]),
        getHotelMonthlyReportData: vi.fn().mockResolvedValue(sampleReportDataA),
      };

      const fakePdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4

      const deps: HotelMonthlyReportDeps = {
        repo: mockRepo,
        sendMail: vi.fn().mockImplementation((mail: HotelMonthlyReportMailMessage) => {
          sentMails.push(mail);
          return Promise.resolve();
        }),
        generatePdf: vi.fn().mockResolvedValue(fakePdfBytes),
        log: (msg: string) => {
          logs.push(msg);
        },
      };

      const now = new Date('2026-11-01T06:00:00.000Z');
      const result = await sendMonthlyHotelReports(deps, now);

      expect(result.totalHotels).toBe(1);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.skippedCount).toBe(0);

      const firstDetail = result.details[0];
      expect(firstDetail?.status).toBe('SENT');
      expect(firstDetail?.hotelId).toBe(hotelIdA);
      expect(firstDetail?.recipients).toEqual(['karim@palace.local', 'direction@palace.local']);

      // Vérifie que les deux e-mails ont bien été envoyés avec le PDF joint
      expect(sentMails).toHaveLength(2);
      const mail1 = sentMails[0];
      expect(mail1?.to).toBe('karim@palace.local');
      expect(mail1?.subject).toContain('Rapport statistique mensuel Xplor');
      expect(mail1?.subject).toContain('Hôtel Rabat Palace');
      expect(mail1?.attachments).toHaveLength(1);
      const attachment = mail1?.attachments[0];
      expect(attachment?.filename).toBe('xplor-rapport-hotel-rabat-palace-2026-10.pdf');
      expect(attachment?.contentType).toBe('application/pdf');
      expect(attachment?.content).toBe(fakePdfBytes);
    });

    it('isole strictement les rapports entre différents hôtels', async () => {
      const sentMails: HotelMonthlyReportMailMessage[] = [];

      const hotelA: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel Rabat Palace',
        email: 'hotelA@palace.local',
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [],
      };

      const hotelB: HotelWithManagers = {
        id: hotelIdB,
        name: 'Hôtel Salé Beach',
        email: 'hotelB@beach.local',
        active: true,
        deletedAt: null,
        languages: ['en'],
        managers: [],
      };

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([hotelA, hotelB]),
        getHotelMonthlyReportData: vi.fn().mockImplementation((id: string) => {
          if (id === hotelIdA) return Promise.resolve(sampleReportDataA);
          if (id === hotelIdB) return Promise.resolve(sampleReportDataB);
          throw new Error('Hôtel inconnu');
        }),
      };

      const deps: HotelMonthlyReportDeps = {
        repo: mockRepo,
        sendMail: vi.fn().mockImplementation((mail: HotelMonthlyReportMailMessage) => {
          sentMails.push(mail);
          return Promise.resolve();
        }),
        generatePdf: vi.fn().mockImplementation((data: HotelMonthlyReportData) => {
          // Retourne un Buffer contenant le nom de l'hôtel pour vérifier l'isolation
          return Promise.resolve(Buffer.from(`PDF for ${data.hotelName}`));
        }),
      };

      const now = new Date('2026-11-01T06:00:00.000Z');
      const result = await sendMonthlyHotelReports(deps, now);

      expect(result.sentCount).toBe(2);
      expect(sentMails).toHaveLength(2);

      const mailA = sentMails.find((m) => m.to === 'hotela@palace.local');
      const mailB = sentMails.find((m) => m.to === 'hotelb@beach.local');

      expect(mailA).toBeDefined();
      expect(mailB).toBeDefined();

      // Vérifie que l'hôtel A reçoit son propre rapport et pas celui de B
      expect(mailA?.subject).toContain('Hôtel Rabat Palace');
      expect(mailA?.subject).not.toContain('Hôtel Salé Beach');
      expect(mailA?.attachments[0]?.filename).toContain('rabat-palace');

      // Vérifie que l'hôtel B reçoit son propre rapport en anglais
      expect(mailB?.subject).toContain('Hôtel Salé Beach');
      expect(mailB?.subject).not.toContain('Hôtel Rabat Palace');
      expect(mailB?.attachments[0]?.filename).toContain('sale-beach');
    });

    it('ignore proprement les hôtels sans aucun destinataire configuré', async () => {
      const hotelSansDestinataire: HotelWithManagers = {
        id: hotelIdC,
        name: 'Hôtel Orphelin',
        email: null,
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [],
      };

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([hotelSansDestinataire]),
        getHotelMonthlyReportData: vi.fn(),
      };

      const sendMailMock = vi.fn();
      const logs: string[] = [];

      const deps: HotelMonthlyReportDeps = {
        repo: mockRepo,
        sendMail: sendMailMock,
        log: (msg: string) => {
          logs.push(msg);
        },
      };

      const result = await sendMonthlyHotelReports(deps, new Date('2026-11-01T06:00:00.000Z'));

      expect(result.totalHotels).toBe(1);
      expect(result.sentCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const detail = result.details[0];
      expect(detail?.status).toBe('SKIPPED_NO_RECIPIENTS');
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(logs.some((l) => l.includes('aucun destinataire configuré'))).toBe(true);
    });

    it('gère l échec d envoi pour un hôtel sans bloquer les autres', async () => {
      const hotelA: HotelWithManagers = {
        id: hotelIdA,
        name: 'Hôtel En Panne SMTP',
        email: 'panne@hotel.local',
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [],
      };

      const hotelB: HotelWithManagers = {
        id: hotelIdB,
        name: 'Hôtel Fonctionnel',
        email: 'ok@hotel.local',
        active: true,
        deletedAt: null,
        languages: ['fr'],
        managers: [],
      };

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([hotelA, hotelB]),
        getHotelMonthlyReportData: vi.fn().mockImplementation((id: string) => {
          if (id === hotelIdA) return Promise.resolve(sampleReportDataA);
          if (id === hotelIdB) return Promise.resolve(sampleReportDataB);
          throw new Error('Inconnu');
        }),
      };

      const sentMails: HotelMonthlyReportMailMessage[] = [];
      const logs: string[] = [];

      const deps: HotelMonthlyReportDeps = {
        repo: mockRepo,
        sendMail: vi.fn().mockImplementation((mail: HotelMonthlyReportMailMessage) => {
          if (mail.to === 'panne@hotel.local') {
            return Promise.reject(new Error('Connexion SMTP refusée (ECONNREFUSED)'));
          }
          sentMails.push(mail);
          return Promise.resolve();
        }),
        generatePdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        log: (msg: string) => {
          logs.push(msg);
        },
      };

      const result = await sendMonthlyHotelReports(deps, new Date('2026-11-01T06:00:00.000Z'));

      expect(result.totalHotels).toBe(2);
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(1);

      const detailA = result.details.find((d) => d.hotelId === hotelIdA);
      expect(detailA?.status).toBe('FAILED');
      expect(detailA?.error).toContain('ECONNREFUSED');

      const detailB = result.details.find((d) => d.hotelId === hotelIdB);
      expect(detailB?.status).toBe('SENT');

      expect(sentMails).toHaveLength(1);
      expect(sentMails[0]?.to).toBe('ok@hotel.local');
    });

    it('échappe scrupuleusement les valeurs insérées dans le HTML des courriels et replie l arabe sur fr', () => {
      const xssHotelName = 'Hôtel <script>alert("XSS")</script> & "L\'Oasis"';
      const periodLabel = 'Octobre 2026 <test>';

      expect(escapeHtml(xssHotelName)).not.toContain('<script>');
      expect(escapeHtml(xssHotelName)).toContain('&lt;script&gt;');

      const mail = renderMonthlyReportMail(xssHotelName, periodLabel, 'ar');

      // Le texte brut et le sujet conservent le nom sans encodage d'entités HTML
      expect(mail.subject).toContain(xssHotelName);
      expect(mail.text).toContain(xssHotelName);

      // Le corps HTML doit obligatoirement échapper tout contenu potentiellement malveillant
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(mail.html).toContain('&amp;');
      expect(mail.html).toContain('&#39;Oasis&quot;');
      expect(mail.html).toContain('&lt;test&gt;');

      // Repli automatique sur le français pour la langue arabe (suspension M8)
      expect(mail.subject).toContain('Rapport statistique mensuel');
      expect(mail.html).toContain('couvrant la période');
    });
  });
});
