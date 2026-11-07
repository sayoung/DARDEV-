import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { resources } from '@xplor/i18n';
import {
  HotelMonthlyReportDataSchema,
  type HotelMonthlyReportData,
} from '@xplor/shared';

export interface ReportLocaleStrings {
  title: string;
  subtitle: string;
  period: string;
  generatedAt: string;
  hotel: string;
  metricsTitle: string;
  sessions: string;
  averageDuration: string;
  toursOpened: string;
  scenesViewed: string;
  hotspotClicks: string;
  vrEntries: string;
  qrScans: string;
  topToursTitle: string;
  topToursOpens: string;
  topToursEmpty: string;
  topScenesTitle: string;
  topScenesViews: string;
  topScenesEmpty: string;
  languagesTitle: string;
  channelsTitle: string;
  footerTagline: string;
  footerConfidential: string;
}

export function getReportLocaleStrings(lang: string = 'fr'): ReportLocaleStrings {
  // Suspension M8 (décision D-xx) : repli systématique sur le français pour la génération PDF.
  const isFrench = lang.toLowerCase().startsWith('fr');
  const res = isFrench ? resources.fr.report.monthly : resources.fr.report.monthly;
  return {
    title: res.title,
    subtitle: res.subtitle,
    period: res.period,
    generatedAt: res.generatedAt,
    hotel: res.hotel,
    metricsTitle: res.metrics.title,
    sessions: res.metrics.sessions,
    averageDuration: res.metrics.averageDuration,
    toursOpened: res.metrics.toursOpened,
    scenesViewed: res.metrics.scenesViewed,
    hotspotClicks: res.metrics.hotspotClicks,
    vrEntries: res.metrics.vrEntries,
    qrScans: res.metrics.qrScans,
    topToursTitle: res.topTours.title,
    topToursOpens: res.topTours.opens,
    topToursEmpty: res.topTours.empty,
    topScenesTitle: res.topScenes.title,
    topScenesViews: res.topScenes.views,
    topScenesEmpty: res.topScenes.empty,
    languagesTitle: res.languages.title,
    channelsTitle: res.channels.title,
    footerTagline: res.footer.tagline,
    footerConfidential: res.footer.confidential,
  };
}

/**
 * Codes de caractères WinAnsi supplémentaires supportés par Helvetica (CP1252 / Standard 14 Fonts).
 */
const WIN_ANSI_ADDITIONAL_CODES = new Set<number>([
  338, 339, 352, 353, 376, 381, 382, 402, 710, 732,
  8211, 8212, 8216, 8217, 8218, 8220, 8221, 8222,
  8224, 8225, 8226, 8230, 8240, 8249, 8250, 8364, 8482,
]);

/**
 * Nettoie et normalise le texte pour l'encodage WinAnsi standard des polices PDF Helvetica.
 * Remplace les sauts de ligne / tabulations par des espaces et les glyphes hors table par ?.
 */
export function sanitizePdfText(text: string): string {
  const normalized = text.normalize('NFC');
  let cleaned = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code === 10 || code === 13 || code === 9) {
      cleaned += ' ';
    } else if (
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255) ||
      WIN_ANSI_ADDITIONAL_CODES.has(code)
    ) {
      cleaned += normalized.charAt(i);
    } else {
      cleaned += '?';
    }
  }
  return cleaned;
}

/**
 * Génère le rapport statistique mensuel d'un hôtel en PDF vectoriel A4 (F-83).
 * Respecte la charte graphique Xplor (#6958A5, A4) en français uniquement (WinAnsi).
 */
export async function generateHotelMonthlyReportPdf(
  data: HotelMonthlyReportData,
  lang: string = 'fr',
): Promise<Uint8Array> {
  const reportData = HotelMonthlyReportDataSchema.parse(data);
  const strings = getReportLocaleStrings(lang);
  const doc = await PDFDocument.create();

  // Dimensions A4 en points (72 DPI) : 210mm x 297mm
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = doc.addPage([pageWidth, pageHeight]);

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Couleurs de la charte graphique Xplor
  const primaryColor = rgb(105 / 255, 88 / 255, 165 / 255); // Violet primaire #6958A5
  const textColor = rgb(60 / 255, 60 / 255, 59 / 255);       // Texte #3C3C3B
  const mutedColor = rgb(102 / 255, 102 / 255, 102 / 255);    // Muted #666666
  const cardBgColor = rgb(246 / 255, 246 / 255, 248 / 255);  // Fond carte #F6F6F8
  const borderColor = rgb(189 / 255, 182 / 255, 215 / 255);  // Bordure violet clair #BDB6D7
  const whiteColor = rgb(1, 1, 1);

  // 1. En-tête : Bandeau supérieur violet Xplor (#6958A5)
  const bannerHeight = 75;
  page.drawRectangle({
    x: 0,
    y: pageHeight - bannerHeight,
    width: pageWidth,
    height: bannerHeight,
    color: primaryColor,
  });

  const appNameText = sanitizePdfText(resources.fr.common.appName.toUpperCase());
  page.drawText(appNameText, {
    x: 40,
    y: pageHeight - 38,
    size: 22,
    font: fontBold,
    color: whiteColor,
  });

  page.drawText(sanitizePdfText(strings.footerTagline), {
    x: 40,
    y: pageHeight - 55,
    size: 10,
    font: fontRegular,
    color: whiteColor,
  });

  const headerRightText = sanitizePdfText(strings.title);
  const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 14);
  page.drawText(headerRightText, {
    x: pageWidth - 40 - headerRightWidth,
    y: pageHeight - 40,
    size: 14,
    font: fontBold,
    color: whiteColor,
  });

  // 2. Informations de l'hôtel et de la période
  let currentY = pageHeight - bannerHeight - 32;

  page.drawText(sanitizePdfText(reportData.hotelName), {
    x: 40,
    y: currentY,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });

  currentY -= 18;
  const periodLine = `${strings.period} : ${reportData.period.label} (${reportData.period.from} — ${reportData.period.to})`;
  page.drawText(sanitizePdfText(periodLine), {
    x: 40,
    y: currentY,
    size: 10,
    font: fontRegular,
    color: textColor,
  });

  currentY -= 26;

  // 3. Section Indicateurs clés (grille de cartes métriques)
  page.drawText(sanitizePdfText(strings.metricsTitle), {
    x: 40,
    y: currentY,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });

  currentY -= 14;

  const avgMinutes = Math.round(reportData.summary.averageSessionDurationMs / 60_000);
  const metricsList = [
    { label: strings.sessions, value: String(reportData.summary.sessions) },
    { label: strings.averageDuration, value: String(avgMinutes) },
    { label: strings.toursOpened, value: String(reportData.summary.toursOpened) },
    { label: strings.scenesViewed, value: String(reportData.summary.scenesViewed) },
    { label: strings.hotspotClicks, value: String(reportData.summary.hotspotClicks) },
    { label: strings.vrEntries, value: String(reportData.summary.vrEntries) },
    { label: strings.qrScans, value: String(reportData.summary.qrScans) },
  ];

  const cardWidth = 119;
  const cardHeight = 44;
  const cardSpacingX = 13;
  const cardSpacingY = 8;
  const cardsPerRow = 4;

  for (let i = 0; i < metricsList.length; i += 1) {
    const item = metricsList[i];
    if (item === undefined) {
      continue;
    }

    const row = Math.floor(i / cardsPerRow);
    const col = i % cardsPerRow;
    const cardX = 40 + col * (cardWidth + cardSpacingX);
    const cardY = currentY - (row + 1) * cardHeight - row * cardSpacingY;

    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: cardBgColor,
      borderColor,
      borderWidth: 1,
    });

    page.drawText(sanitizePdfText(item.label), {
      x: cardX + 8,
      y: cardY + cardHeight - 14,
      size: 7.5,
      font: fontRegular,
      color: mutedColor,
    });

    page.drawText(sanitizePdfText(item.value), {
      x: cardX + 8,
      y: cardY + 10,
      size: 14,
      font: fontBold,
      color: primaryColor,
    });
  }

  const metricRows = Math.ceil(metricsList.length / cardsPerRow);
  currentY -= metricRows * cardHeight + (metricRows - 1) * cardSpacingY + 28;

  // 4. Deux colonnes : Top Visites (gauche) & Top Scènes (droite)
  const colWidth = 245;
  const colLeftX = 40;
  const colRightX = 310;
  const colStartY = currentY;

  // Colonne gauche : Top Visites
  page.drawText(sanitizePdfText(strings.topToursTitle), {
    x: colLeftX,
    y: colStartY,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  let toursY = colStartY - 18;
  const maxItems = 5;

  if (reportData.topTours.length === 0) {
    page.drawText(sanitizePdfText(strings.topToursEmpty), {
      x: colLeftX,
      y: toursY,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
    toursY -= 16;
  } else {
    const topToursSlice = reportData.topTours.slice(0, maxItems);
    for (let i = 0; i < topToursSlice.length; i += 1) {
      const tour = topToursSlice[i];
      if (tour === undefined) {
        continue;
      }

      const rankText = `${String(i + 1)}. `;
      const titleText = sanitizePdfText(
        tour.label.length > 28 ? `${tour.label.slice(0, 25)}...` : tour.label,
      );
      const countText = sanitizePdfText(
        `${String(tour.opens)} ${strings.topToursOpens.toLowerCase()}`,
      );

      page.drawText(rankText + titleText, {
        x: colLeftX,
        y: toursY,
        size: 9,
        font: fontRegular,
        color: textColor,
      });

      const countWidth = fontBold.widthOfTextAtSize(countText, 9);
      page.drawText(countText, {
        x: colLeftX + colWidth - countWidth,
        y: toursY,
        size: 9,
        font: fontBold,
        color: primaryColor,
      });

      toursY -= 15;
    }
  }

  // Colonne droite : Top Scènes
  page.drawText(sanitizePdfText(strings.topScenesTitle), {
    x: colRightX,
    y: colStartY,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  let scenesY = colStartY - 18;
  if (reportData.topScenes.length === 0) {
    page.drawText(sanitizePdfText(strings.topScenesEmpty), {
      x: colRightX,
      y: scenesY,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
    scenesY -= 16;
  } else {
    const topScenesSlice = reportData.topScenes.slice(0, maxItems);
    for (let i = 0; i < topScenesSlice.length; i += 1) {
      const scene = topScenesSlice[i];
      if (scene === undefined) {
        continue;
      }

      const rankText = `${String(i + 1)}. `;
      const titleText = sanitizePdfText(
        scene.label.length > 28 ? `${scene.label.slice(0, 25)}...` : scene.label,
      );
      const countText = sanitizePdfText(
        `${String(scene.views)} ${strings.topScenesViews.toLowerCase()}`,
      );

      page.drawText(rankText + titleText, {
        x: colRightX,
        y: scenesY,
        size: 9,
        font: fontRegular,
        color: textColor,
      });

      const countWidth = fontBold.widthOfTextAtSize(countText, 9);
      page.drawText(countText, {
        x: colRightX + colWidth - countWidth,
        y: scenesY,
        size: 9,
        font: fontBold,
        color: primaryColor,
      });

      scenesY -= 15;
    }
  }

  currentY = Math.min(toursY, scenesY) - 24;

  // 5. Deux colonnes : Répartition Langues (gauche) & Répartition Canaux (droite)
  const breakdownStartY = currentY;

  page.drawText(sanitizePdfText(strings.languagesTitle), {
    x: colLeftX,
    y: breakdownStartY,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  let langY = breakdownStartY - 18;
  for (const item of reportData.languages) {
    const langLabel =
      item.lang === 'fr'
        ? resources.fr.catalog.translation.tab.fr
        : item.lang === 'ar'
          ? resources.fr.catalog.translation.tab.ar
          : item.lang === 'en'
            ? resources.fr.catalog.translation.tab.en
            : item.lang.toUpperCase();
    const countText = sanitizePdfText(`${String(item.sessions)} ${strings.sessions.toLowerCase()}`);

    page.drawText(sanitizePdfText(langLabel), {
      x: colLeftX,
      y: langY,
      size: 9,
      font: fontRegular,
      color: textColor,
    });

    const countWidth = fontBold.widthOfTextAtSize(countText, 9);
    page.drawText(countText, {
      x: colLeftX + colWidth - countWidth,
      y: langY,
      size: 9,
      font: fontBold,
      color: textColor,
    });

    langY -= 15;
  }

  page.drawText(sanitizePdfText(strings.channelsTitle), {
    x: colRightX,
    y: breakdownStartY,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  let chanY = breakdownStartY - 18;
  for (const item of reportData.channels) {
    const chanLabel = item.channel;
    const countText = sanitizePdfText(`${String(item.sessions)} ${strings.sessions.toLowerCase()}`);

    page.drawText(sanitizePdfText(chanLabel), {
      x: colRightX,
      y: chanY,
      size: 9,
      font: fontRegular,
      color: textColor,
    });

    const countWidth = fontBold.widthOfTextAtSize(countText, 9);
    page.drawText(countText, {
      x: colRightX + colWidth - countWidth,
      y: chanY,
      size: 9,
      font: fontBold,
      color: textColor,
    });

    chanY -= 15;
  }

  // 6. Bas de page : Mention de confidentialité et séparateur
  const footerY = 45;
  page.drawLine({
    start: { x: 40, y: footerY + 16 },
    end: { x: pageWidth - 40, y: footerY + 16 },
    thickness: 0.5,
    color: borderColor,
  });

  page.drawText(sanitizePdfText(strings.footerConfidential), {
    x: 40,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: mutedColor,
  });

  const appNameFooter = sanitizePdfText(resources.fr.common.appName);
  const appNameWidth = fontRegular.widthOfTextAtSize(appNameFooter, 8);
  page.drawText(appNameFooter, {
    x: pageWidth - 40 - appNameWidth,
    y: footerY,
    size: 8,
    font: fontRegular,
    color: mutedColor,
  });

  return doc.save();
}
