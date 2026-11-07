import { resources } from '@xplor/i18n';
import {
  HotelMonthlyReportDataSchema,
  type HotelMonthlyReportData,
} from '@xplor/shared';
import { generateHotelMonthlyReportPdf } from './hotel-monthly-report-pdf.js';
import {
  resolveHotelReportRecipients,
  type HotelMonthlyReportRepository,
  type ReportRecipient,
} from './hotel-monthly-report-repository.js';

export interface HotelMonthlyReportMailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    content: Buffer | Uint8Array;
    contentType: string;
  }>;
}

export interface HotelMonthlyReportDeps {
  repo: HotelMonthlyReportRepository;
  sendMail: (mail: HotelMonthlyReportMailMessage) => Promise<void>;
  generatePdf?: (data: HotelMonthlyReportData, lang: string) => Promise<Uint8Array>;
  log?: (message: string) => void;
}

export interface HotelReportDetail {
  hotelId: string;
  hotelName: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED_NO_RECIPIENTS';
  recipients: string[];
  error?: string;
}

export interface MonthlyReportsResult {
  period: {
    from: string;
    to: string;
    label: string;
  };
  totalHotels: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  details: HotelReportDetail[];
}

export interface PreviousMonthRange {
  from: Date;
  to: Date;
  fileSlug: string;
  periodLabel: string;
}

/**
 * Calcule l'intervalle temporel UTC du mois précédent complet (ex: du 1er au 31 octobre).
 */
export function getPreviousMonthUtcRange(now: Date = new Date(), lang: string = 'fr'): PreviousMonthRange {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-indexed (0 = Janvier, 10 = Novembre)

  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;

  const from = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0, 0));
  // Le 1er du mois courant à 00:00:00 UTC (fin exclusive)
  const to = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));

  const monthNumber = String(prevMonth + 1).padStart(2, '0');
  const fileSlug = `${String(prevYear)}-${monthNumber}`;

  const formatter = new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const periodLabel = formatter.format(from);

  return { from, to, fileSlug, periodLabel };
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderMonthlyReportMail(
  hotelName: string,
  periodLabel: string,
  lang: string = 'fr',
): { subject: string; text: string; html: string } {
  // Suspension temporaire ar/en jusqu'à M8 (décision 30/09/2026, repli automatique sur fr)
  const effectiveLang = lang === 'ar' || (lang !== 'fr' && lang !== 'en') ? 'fr' : lang;
  const res = effectiveLang === 'en' ? resources.en : resources.fr;
  const template = res.mail.monthlyReport;

  const subject = template.subject
    .replace('{hotelName}', hotelName)
    .replace('{period}', periodLabel);

  const text = template.text
    .replaceAll('{hotelName}', hotelName)
    .replaceAll('{period}', periodLabel);

  const html = template.html
    .replaceAll('{hotelName}', escapeHtml(hotelName))
    .replaceAll('{period}', escapeHtml(periodLabel));

  return { subject, text, html };
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Exécute l'envoi planifié des rapports mensuels pour tous les hôtels actifs (F-83).
 *
 * 1. Calcule la période du mois précédent.
 * 2. Récupère la liste des hôtels actifs et résout leurs destinataires autorisés.
 * 3. Isole strictement les données de chaque hôtel (aucune fuite inter-hôtels).
 * 4. Génère le PDF vectoriel A4 et transmet le courriel avec la pièce jointe.
 * 5. Tolérance aux pannes : l'échec d'un hôtel ne bloque pas les envois des autres.
 */
export async function sendMonthlyHotelReports(
  deps: HotelMonthlyReportDeps,
  now: Date = new Date(),
): Promise<MonthlyReportsResult> {
  const { from, to, fileSlug, periodLabel } = getPreviousMonthUtcRange(now, 'fr');
  const hotels = await deps.repo.listActiveHotels();

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const details: HotelReportDetail[] = [];

  const pdfGenerator = deps.generatePdf ?? generateHotelMonthlyReportPdf;

  for (const hotel of hotels) {
    const recipients: ReportRecipient[] = resolveHotelReportRecipients(hotel);
    const recipientEmails = recipients.map((r) => r.email);

    if (recipients.length === 0) {
      skippedCount += 1;
      details.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        status: 'SKIPPED_NO_RECIPIENTS',
        recipients: [],
      });
      if (deps.log !== undefined) {
        deps.log(`Hôtel ${hotel.name} : aucun destinataire configuré, rapport ignoré.`);
      }
      continue;
    }

    try {
      // Déterminer la langue du rapport (première langue disponible des destinataires ou français)
      const primaryLang = recipients[0]?.lang ?? 'fr';

      const rawData = await deps.repo.getHotelMonthlyReportData(
        hotel.id,
        hotel.name,
        from,
        to,
        primaryLang,
      );

      // Validation stricte sans type assertion
      const reportData = HotelMonthlyReportDataSchema.parse(rawData);

      const hotelSlug = sanitizeFilename(hotel.name);
      const filename = `xplor-rapport-${hotelSlug.length > 0 ? hotelSlug : 'hotel'}-${fileSlug}.pdf`;

      // Envoyer un courriel personnalisé par destinataire selon sa langue
      for (const recipient of recipients) {
        const mailContent = renderMonthlyReportMail(hotel.name, periodLabel, recipient.lang);
        const pdfBytes = await pdfGenerator(reportData, recipient.lang);

        await deps.sendMail({
          to: recipient.email,
          subject: mailContent.subject,
          text: mailContent.text,
          html: mailContent.html,
          attachments: [
            {
              filename,
              content: pdfBytes,
              contentType: 'application/pdf',
            },
          ],
        });
      }

      sentCount += 1;
      details.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        status: 'SENT',
        recipients: recipientEmails,
      });

      if (deps.log !== undefined) {
        deps.log(
          `Rapport mensuel envoyé pour l'hôtel ${hotel.name} à ${String(recipientEmails.length)} destinataire(s).`,
        );
      }
    } catch (err: unknown) {
      failedCount += 1;
      const errorMessage = err instanceof Error ? err.message : String(err);

      details.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        status: 'FAILED',
        recipients: recipientEmails,
        error: errorMessage,
      });

      if (deps.log !== undefined) {
        deps.log(
          `Échec de l'envoi du rapport mensuel pour l'hôtel ${hotel.name} : ${errorMessage}`,
        );
      }
    }
  }

  const fromIso = from.toISOString().slice(0, 10);
  const toExclusive = new Date(to.getTime() - 86_400_000);
  const toIso = toExclusive.toISOString().slice(0, 10);

  return {
    period: {
      from: fromIso,
      to: toIso,
      label: periodLabel,
    },
    totalHotels: hotels.length,
    sentCount,
    failedCount,
    skippedCount,
    details,
  };
}
