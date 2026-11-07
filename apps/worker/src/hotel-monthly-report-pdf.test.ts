import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { PDFArray, PDFDocument, PDFRawStream } from 'pdf-lib';
import {
  HotelMonthlyReportDataSchema,
  type HotelMonthlyReportData,
} from '@xplor/shared';
import {
  generateHotelMonthlyReportPdf,
  getReportLocaleStrings,
  sanitizePdfText,
} from './hotel-monthly-report-pdf.js';

/**
 * Décompresse les flux graphiques du document PDF pour en extraire les textes rendus.
 */
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(pdfBytes);
  let extracted = '';
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    if (contents === undefined) {
      continue;
    }
    const streams: PDFRawStream[] = [];
    if (contents instanceof PDFArray) {
      for (const ref of contents.asArray()) {
        const stream = doc.context.lookup(ref);
        if (stream instanceof PDFRawStream) {
          streams.push(stream);
        }
      }
    } else if (contents instanceof PDFRawStream) {
      streams.push(contents);
    }

    for (const stream of streams) {
      const raw = stream.getContents();
      const decompressed = zlib.inflateSync(Buffer.from(raw)).toString('latin1');
      for (const match of decompressed.matchAll(/<([0-9a-fA-F]+)>/g)) {
        const hex = match[1];
        if (hex !== undefined) {
          extracted += Buffer.from(hex, 'hex').toString('latin1') + ' ';
        }
      }
    }
  }
  return extracted;
}

describe('hotel-monthly-report-pdf (M7 F-83)', () => {
  const sampleReportData: HotelMonthlyReportData = {
    hotelId: '01990000-0000-7000-8000-000000000001',
    hotelName: 'Hôtel Rabat Tour Hassan & Spa',
    period: {
      from: '2026-10-01',
      to: '2026-10-31',
      label: 'Octobre 2026',
    },
    summary: {
      sessions: 120,
      averageSessionDurationMs: 240_000,
      toursOpened: 95,
      scenesViewed: 350,
      hotspotClicks: 110,
      vrEntries: 18,
      qrScans: 24,
    },
    topTours: [
      { id: '01990000-0000-7000-8000-000000000010', label: 'Kasbah des Oudayas', opens: 60 },
      { id: '01990000-0000-7000-8000-000000000011', label: 'Jardin de Salé', opens: 35 },
    ],
    topScenes: [
      { id: '01990000-0000-7000-8000-000000000020', label: 'Porte Bab Oudaya', views: 180 },
      { id: '01990000-0000-7000-8000-000000000021', label: 'Vue sur le Bouregreg', views: 170 },
    ],
    languages: [
      { lang: 'fr', sessions: 80 },
      { lang: 'en', sessions: 30 },
      { lang: 'ar', sessions: 10 },
    ],
    channels: [
      { channel: 'KIOSK', sessions: 90 },
      { channel: 'WEB', sessions: 30 },
    ],
  };

  describe('getReportLocaleStrings', () => {
    it('renvoie les chaînes en français issues des ressources i18n', () => {
      const strings = getReportLocaleStrings('fr');
      expect(strings.title).toBe('Rapport statistique mensuel');
      expect(strings.metricsTitle).toBe('Indicateurs clés');
      expect(strings.sessions).toBe('Sessions');
      expect(strings.averageDuration).toBe('Durée moyenne (min)');
      expect(strings.footerTagline).toBe('Votre voyage commence ici');
      expect(strings.footerConfidential).toContain('aucune collecte de données personnelles');
    });

    it('replie les autres langues sur le français (suspension M8)', () => {
      const stringsEn = getReportLocaleStrings('en');
      const stringsAr = getReportLocaleStrings('ar');
      expect(stringsEn.title).toBe('Rapport statistique mensuel');
      expect(stringsAr.title).toBe('Rapport statistique mensuel');
    });
  });

  describe('sanitizePdfText', () => {
    it('préserve les caractères ASCII imprimables, accents français et ponctuation WinAnsi', () => {
      const input = 'Événements & Statistiques — Café de la Plage (Maroc) « 100% »';
      const output = sanitizePdfText(input);
      expect(output).toContain('Statistiques');
      expect(output).toContain('Café de la Plage');
      expect(output).toContain('—');
    });

    it('remplace les sauts de ligne et tabulations par des espaces', () => {
      const input = 'Ligne 1\nLigne 2\r\tTexte suite';
      const output = sanitizePdfText(input);
      expect(output).toBe('Ligne 1 Ligne 2  Texte suite');
    });

    it('échappe les glyphes non supportés par WinAnsi (arabe, émojis) par ?', () => {
      const input = 'Hôtel فندق 🏨 Test';
      const output = sanitizePdfText(input);
      expect(output).toContain('Hôtel');
      expect(output).toContain('Test');
      expect(output).not.toContain('فندق');
      expect(output).not.toContain('🏨');
      expect(output).toContain('?');
    });
  });

  describe('generateHotelMonthlyReportPdf', () => {
    it('génère un PDF valide commençant par le marqueur magique %PDF-', async () => {
      const pdfBytes = await generateHotelMonthlyReportPdf(sampleReportData);
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(500);

      const magic = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
      expect(magic).toBe('%PDF-');
    });

    it("contient le nom de l'hôtel, la période et tous les chiffres attendus", async () => {
      const pdfBytes = await generateHotelMonthlyReportPdf(sampleReportData);
      const extractedText = await extractTextFromPdf(pdfBytes);

      // Nom de l'hôtel et période
      expect(extractedText).toContain('Hôtel Rabat Tour Hassan & Spa');
      expect(extractedText).toContain('Octobre 2026');
      expect(extractedText).toContain('2026-10-01');
      expect(extractedText).toContain('2026-10-31');

      // Chiffres clés de résumé
      expect(extractedText).toContain('120'); // sessions
      expect(extractedText).toContain('4');   // durée moyenne en min (240 000 ms = 4 min)
      expect(extractedText).toContain('95');  // visites ouvertes
      expect(extractedText).toContain('350'); // scènes vues
      expect(extractedText).toContain('110'); // clics hotspot
      expect(extractedText).toContain('18');  // entrées VR
      expect(extractedText).toContain('24');  // scans QR

      // Top visites et top scènes
      expect(extractedText).toContain('Kasbah des Oudayas');
      expect(extractedText).toContain('60');
      expect(extractedText).toContain('Porte Bab Oudaya');
      expect(extractedText).toContain('180');

      // Répartition langues et canaux
      expect(extractedText).toContain('Français');
      expect(extractedText).toContain('80');
      expect(extractedText).toContain('KIOSK');
      expect(extractedText).toContain('90');
    });

    it('gère un mois vide sans erreur avec les libellés de repli appropriés', async () => {
      const emptyData: HotelMonthlyReportData = {
        hotelId: '01990000-0000-7000-8000-000000000002',
        hotelName: 'Hôtel Dunes & Silence',
        period: {
          from: '2026-11-01',
          to: '2026-11-30',
          label: 'Novembre 2026',
        },
        summary: {
          sessions: 0,
          averageSessionDurationMs: 0,
          toursOpened: 0,
          scenesViewed: 0,
          hotspotClicks: 0,
          vrEntries: 0,
          qrScans: 0,
        },
        topTours: [],
        topScenes: [],
        languages: [],
        channels: [],
      };

      const pdfBytes = await generateHotelMonthlyReportPdf(emptyData);
      const magic = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
      expect(magic).toBe('%PDF-');

      const extractedText = await extractTextFromPdf(pdfBytes);
      expect(extractedText).toContain('Hôtel Dunes & Silence');
      expect(extractedText).toContain('Novembre 2026');
      expect(extractedText).toContain('Aucune visite ouverte sur la période');
      expect(extractedText).toContain('Aucune scène vue sur la période');
      expect(extractedText).toContain('0');
    });

    it('échappe les valeurs dynamiques problématiques sans lever d exception', async () => {
      const dynamicData: HotelMonthlyReportData = {
        hotelId: '01990000-0000-7000-8000-000000000003',
        hotelName: 'Hôtel Palais فندق & Oasis 🏨\nLigne 2',
        period: {
          from: '2026-10-01',
          to: '2026-10-31',
          label: 'Octobre\t2026 <script>',
        },
        summary: {
          sessions: 42,
          averageSessionDurationMs: 120_000,
          toursOpened: 10,
          scenesViewed: 30,
          hotspotClicks: 5,
          vrEntries: 2,
          qrScans: 1,
        },
        topTours: [
          {
            id: '01990000-0000-7000-8000-000000000030',
            label: 'Visite avec titre très très long qui dépasse largement la largeur de colonne autorisée',
            opens: 25,
          },
        ],
        topScenes: [
          {
            id: '01990000-0000-7000-8000-000000000031',
            label: 'Scène avec caractères spéciaux « Œuf & Maître » — Vue',
            views: 40,
          },
        ],
        languages: [{ lang: 'xx', sessions: 42 }],
        channels: [{ channel: 'KIOSK', sessions: 42 }],
      };

      const pdfBytes = await generateHotelMonthlyReportPdf(dynamicData);
      const magic = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
      expect(magic).toBe('%PDF-');

      const extractedText = await extractTextFromPdf(pdfBytes);
      expect(extractedText).toContain('Hôtel Palais');
      expect(extractedText).toContain('Oasis');
      expect(extractedText).toContain('42');
    });

    it('ne contient aucune donnée personnelle de voyageur et inclut la mention de confidentialité', async () => {
      const pdfBytes = await generateHotelMonthlyReportPdf(sampleReportData);
      const extractedText = await extractTextFromPdf(pdfBytes);

      // Mention légale de non-collecte de données personnelles
      expect(extractedText).toContain('Rapport confidentiel généré automatiquement sans aucune collecte de données personnelles.');

      // Vérifie l'absence absolue de données personnelles dans le modèle partagé
      const parsedData = HotelMonthlyReportDataSchema.parse(sampleReportData);
      expect(parsedData).not.toHaveProperty('email');
      expect(parsedData).not.toHaveProperty('ip');
      expect(parsedData).not.toHaveProperty('userAgent');
      expect(parsedData).not.toHaveProperty('traveler');
    });

    it('rejette les données non conformes au schéma partagé sans forçage de type', async () => {
      const invalidData = {
        hotelId: 'invalid-not-a-uuid',
        hotelName: '',
        period: { from: '', to: '', label: '' },
        summary: { sessions: -5 },
      };

      await expect(
        // @ts-expect-error test de validation à l'exécution avec données corrompues
        generateHotelMonthlyReportPdf(invalidData),
      ).rejects.toThrow();
    });
  });
});
