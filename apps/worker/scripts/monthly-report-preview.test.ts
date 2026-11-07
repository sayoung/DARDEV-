import { describe, expect, it, vi } from 'vitest';
import type { HotelMonthlyReportData } from '@xplor/shared';
import {
  computeMonthUtcRange,
  computeReportFilename,
  formatYearMonth,
  isDirectExecution,
  parsePreviewArgs,
  runMonthlyReportPreview,
  sanitizeFilename,
} from './monthly-report-preview.js';
import type {
  HotelMonthlyReportRepository,
  HotelWithManagers,
} from '../src/hotel-monthly-report-repository.js';

describe('monthly-report-preview (M7 F-83)', () => {
  const sampleHotelId = '01990000-0000-7000-8000-000000000101';
  const sampleHotelName = 'Hôtel Démonstration Rabat';

  const sampleReportData: HotelMonthlyReportData = {
    hotelId: sampleHotelId,
    hotelName: sampleHotelName,
    period: {
      from: '2026-11-01',
      to: '2026-11-30',
      label: 'novembre 2026',
    },
    summary: {
      sessions: 42,
      averageSessionDurationMs: 180_000,
      toursOpened: 38,
      scenesViewed: 120,
      hotspotClicks: 50,
      vrEntries: 8,
      qrScans: 12,
    },
    topTours: [{ id: 'tour-1', label: 'Kasbah des Oudayas', opens: 28 }],
    topScenes: [{ id: 'scene-1', label: 'Bab Oudaya', views: 90 }],
    languages: [{ lang: 'fr', sessions: 42 }],
    channels: [{ channel: 'KIOSK', sessions: 42 }],
  };

  const sampleHotelWithManagers: HotelWithManagers = {
    id: sampleHotelId,
    name: sampleHotelName,
    email: 'rabat.demo@xplor.local',
    active: true,
    deletedAt: null,
    languages: ['fr'],
    managers: [],
  };

  describe('parsePreviewArgs', () => {
    const fixedNow = new Date('2026-11-07T12:00:00.000Z');

    it('retourne le mois en cours par défaut lorsque --month est omis (défaut du mois)', () => {
      const result = parsePreviewArgs(
        ['--confirm-dev', '--hotel', sampleHotelId],
        fixedNow,
        { NODE_ENV: 'development' },
      );

      expect(result).toEqual({
        confirmDev: true,
        hotelId: sampleHotelId,
        month: '2026-11',
      });
    });

    it('accepte l option --month avec une valeur explicite valide (--month 2026-10)', () => {
      const result = parsePreviewArgs(
        ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026-10'],
        fixedNow,
        { NODE_ENV: 'development' },
      );

      expect(result).toEqual({
        confirmDev: true,
        hotelId: sampleHotelId,
        month: '2026-10',
      });
    });

    it('accepte les options liées (--hotel=<id> et --month=<AAAA-MM>)', () => {
      const result = parsePreviewArgs(
        [
          '--confirm-dev',
          `--hotel=${sampleHotelId}`,
          '--month=2026-05',
        ],
        fixedNow,
        { NODE_ENV: 'development' },
      );

      expect(result).toEqual({
        confirmDev: true,
        hotelId: sampleHotelId,
        month: '2026-05',
      });
    });

    it('refuse les formats de mois invalides (mois invalide)', () => {
      // Mois 13 (hors bornes)
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026-13'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow(
        'Le mois doit être au format AAAA-MM (ex: 2026-11) : "2026-13".',
      );

      // Mois 00
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026-00'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow(
        'Le mois doit être au format AAAA-MM (ex: 2026-11) : "2026-00".',
      );

      // Mois non numérique
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month', 'invalid'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow(
        'Le mois doit être au format AAAA-MM (ex: 2026-11) : "invalid".',
      );

      // Format slash au lieu de tiret
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026/11'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow(
        'Le mois doit être au format AAAA-MM (ex: 2026-11) : "2026/11".',
      );

      // Mois sans argument
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow("L'option --month requiert un mois au format AAAA-MM.");

      // Option --month= vide
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--month='],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow(
        'Le mois doit être au format AAAA-MM (ex: 2026-11) : "".',
      );
    });

    it('refuse si l option --hotel est manquante ou vide (hôtel manquant)', () => {
      // Option --hotel totalement absente
      expect(() =>
        parsePreviewArgs(['--confirm-dev'], fixedNow, {
          NODE_ENV: 'development',
        }),
      ).toThrow("L'option --hotel <id> est obligatoire.");

      // Option --hotel sans valeur
      expect(() =>
        parsePreviewArgs(['--confirm-dev', '--hotel'], fixedNow, {
          NODE_ENV: 'development',
        }),
      ).toThrow("L'option --hotel requiert un identifiant d'hôtel.");

      // Option --hotel suivie d'une autre option
      expect(() =>
        parsePreviewArgs(
          ['--hotel', '--confirm-dev'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow("L'option --hotel requiert un identifiant d'hôtel.");

      // Option --hotel= vide
      expect(() =>
        parsePreviewArgs(['--confirm-dev', '--hotel='], fixedNow, {
          NODE_ENV: 'development',
        }),
      ).toThrow("L'option --hotel <id> est obligatoire.");
    });

    it('refuse si l option --confirm-dev est absente (--confirm-dev absent)', () => {
      expect(() =>
        parsePreviewArgs(['--hotel', sampleHotelId], fixedNow, {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        "L'option --confirm-dev est requise pour prévisualiser le rapport mensuel.",
      );
    });

    it('refuse si NODE_ENV=production même avec --confirm-dev', () => {
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId],
          fixedNow,
          { NODE_ENV: 'production' },
        ),
      ).toThrow(
        'La prévisualisation du rapport mensuel est refusée en production.',
      );
    });

    it('ignore le préfixe node et le chemin du script lorsque process.argv complet est transmis', () => {
      const fullArgv = [
        'C:\\Program Files\\nodejs\\node.exe',
        'D:\\DARDEV\\local\\xplor_smit\\apps\\worker\\scripts\\monthly-report-preview.ts',
        '--confirm-dev',
        '--hotel',
        sampleHotelId,
        '--month',
        '2026-09',
      ];
      const result = parsePreviewArgs(fullArgv, fixedNow, {
        NODE_ENV: 'development',
      });
      expect(result).toEqual({
        confirmDev: true,
        hotelId: sampleHotelId,
        month: '2026-09',
      });
    });

    it('refuse les options non reconnues', () => {
      expect(() =>
        parsePreviewArgs(
          ['--confirm-dev', '--hotel', sampleHotelId, '--inconnu'],
          fixedNow,
          { NODE_ENV: 'development' },
        ),
      ).toThrow('Option ou argument non reconnu : "--inconnu".');
    });
  });

  describe('formatYearMonth', () => {
    it('formate correctement une date UTC en AAAA-MM', () => {
      expect(formatYearMonth(new Date('2026-11-07T12:00:00.000Z'))).toBe(
        '2026-11',
      );
      expect(formatYearMonth(new Date('2026-01-01T00:00:00.000Z'))).toBe(
        '2026-01',
      );
      expect(formatYearMonth(new Date('2025-12-31T23:59:59.999Z'))).toBe(
        '2025-12',
      );
    });
  });

  describe('computeMonthUtcRange', () => {
    it('calcule la plage UTC du 1er du mois au 1er du mois suivant', () => {
      const { from, to } = computeMonthUtcRange('2026-11');
      expect(from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(to.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    it('gère le passage d année pour le mois de décembre (2026-12)', () => {
      const { from, to } = computeMonthUtcRange('2026-12');
      expect(from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('gère le mois de janvier (2027-01)', () => {
      const { from, to } = computeMonthUtcRange('2027-01');
      expect(from.toISOString()).toBe('2027-01-01T00:00:00.000Z');
      expect(to.toISOString()).toBe('2027-02-01T00:00:00.000Z');
    });

    it('lève une erreur si le format est invalide', () => {
      expect(() => computeMonthUtcRange('invalid')).toThrow(
        'Le format du mois est invalide',
      );
    });
  });

  describe('sanitizeFilename et computeReportFilename', () => {
    it('nettoie les accents et caractères spéciaux du nom de l hôtel', () => {
      expect(sanitizeFilename('Hôtel Démonstration Rabat')).toBe(
        'hotel-demonstration-rabat',
      );
      expect(sanitizeFilename('L\'Oasis & le Palais / Marrakech')).toBe(
        'l-oasis-le-palais-marrakech',
      );
    });

    it('construit le nom de fichier au format xplor-rapport-<hotelSlugOuId>-<AAAA-MM>.pdf', () => {
      const filename = computeReportFilename(
        'hotel-demonstration-rabat',
        '2026-11',
      );
      expect(filename).toBe(
        'xplor-rapport-hotel-demonstration-rabat-2026-11.pdf',
      );
    });
  });

  describe('isDirectExecution', () => {
    it('détecte l exécution directe du script', () => {
      expect(isDirectExecution('scripts/monthly-report-preview.ts')).toBe(true);
      expect(
        isDirectExecution(
          'D:\\DARDEV\\local\\xplor_smit\\apps\\worker\\scripts\\monthly-report-preview.ts',
        ),
      ).toBe(true);
      expect(
        isDirectExecution(
          '/var/app/apps/worker/dist/scripts/monthly-report-preview.js',
        ),
      ).toBe(true);
    });

    it('retourne false pour des fichiers différents ou indéfinis', () => {
      expect(isDirectExecution(undefined)).toBe(false);
      expect(isDirectExecution('')).toBe(false);
      expect(isDirectExecution('src/main.ts')).toBe(false);
      expect(isDirectExecution('node_modules/vitest/vitest.mjs')).toBe(false);
    });
  });

  describe('runMonthlyReportPreview', () => {
    it('génère le PDF vectoriel et l écrit dans le dossier temporaire sans envoyer de courriel', async () => {
      const writtenFiles: Array<{ path: string; data: Uint8Array }> = [];
      const logs: string[] = [];

      const getHotelMonthlyReportData = vi
        .fn<HotelMonthlyReportRepository['getHotelMonthlyReportData']>()
        .mockResolvedValue(sampleReportData);
      const listActiveHotels = vi
        .fn<HotelMonthlyReportRepository['listActiveHotels']>()
        .mockResolvedValue([sampleHotelWithManagers]);

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels,
        getHotelMonthlyReportData,
      };

      const fakePdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
      const mockGeneratePdf = vi.fn().mockResolvedValue(fakePdfBytes);

      const result = await runMonthlyReportPreview(
        ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026-11'],
        {
          repo: mockRepo,
          generatePdf: mockGeneratePdf,
          writeFile: (path, data) => {
            writtenFiles.push({ path, data });
            return Promise.resolve();
          },
          log: (msg) => logs.push(msg),
          tmpDir: '/fake-tmp',
          env: { NODE_ENV: 'development' },
        },
      );

      expect(getHotelMonthlyReportData).toHaveBeenCalledTimes(1);
      expect(mockGeneratePdf).toHaveBeenCalledWith(sampleReportData, 'fr');
      expect(writtenFiles).toHaveLength(1);

      const written = writtenFiles[0];
      expect(written?.path).toContain('xplor-rapport-hotel-demonstration-rabat-2026-11.pdf');
      expect(written?.data).toBe(fakePdfBytes);

      expect(result.hotelId).toBe(sampleHotelId);
      expect(result.hotelName).toBe(sampleHotelName);
      expect(result.month).toBe('2026-11');
      expect(result.bytesCount).toBe(fakePdfBytes.byteLength);
      expect(result.filePath).toBe(written?.path);

      expect(logs.some((l) => l.includes('Génération de l\'aperçu du rapport mensuel'))).toBe(true);
      expect(logs.some((l) => l.includes('Rapport mensuel PDF écrit avec succès'))).toBe(true);
    });

    it('génère un vrai PDF vectoriel A4 valide via generateHotelMonthlyReportPdf', async () => {
      const writtenFiles: Array<{ path: string; data: Uint8Array }> = [];

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([sampleHotelWithManagers]),
        getHotelMonthlyReportData: vi.fn().mockResolvedValue(sampleReportData),
      };

      const result = await runMonthlyReportPreview(
        ['--confirm-dev', '--hotel', sampleHotelId, '--month', '2026-11'],
        {
          repo: mockRepo,
          writeFile: (path, data) => {
            writtenFiles.push({ path, data });
            return Promise.resolve();
          },
          tmpDir: '/tmp',
          env: { NODE_ENV: 'development' },
        },
      );

      expect(writtenFiles).toHaveLength(1);
      const written = writtenFiles[0];
      expect(written).toBeDefined();
      if (written !== undefined) {
        // En-tête standard PDF : %PDF-1.
        const header = String.fromCharCode(...written.data.slice(0, 5));
        expect(header).toBe('%PDF-');
        // Un PDF vectoriel A4 complet pèse au moins quelques kilo-octets
        expect(written.data.byteLength).toBeGreaterThan(1000);
        expect(result.bytesCount).toBe(written.data.byteLength);
      }
    });

    it('trouve l hôtel par son slug ou son nom si l identifiant textuel est fourni', async () => {
      const writtenFiles: Array<{ path: string; data: Uint8Array }> = [];

      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([sampleHotelWithManagers]),
        getHotelMonthlyReportData: vi.fn().mockResolvedValue(sampleReportData),
      };

      const result = await runMonthlyReportPreview(
        [
          '--confirm-dev',
          '--hotel',
          'hotel-demonstration-rabat',
          '--month',
          '2026-11',
        ],
        {
          repo: mockRepo,
          generatePdf: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
          writeFile: (path, data) => {
            writtenFiles.push({ path, data });
            return Promise.resolve();
          },
          tmpDir: '/fake-tmp',
          env: { NODE_ENV: 'development' },
        },
      );

      expect(result.hotelId).toBe(sampleHotelId);
      expect(result.hotelName).toBe(sampleHotelName);
    });

    it('échoue si l hôtel est introuvable', async () => {
      const mockRepo: HotelMonthlyReportRepository = {
        listActiveHotels: vi.fn().mockResolvedValue([]),
        getHotelMonthlyReportData: vi.fn(),
      };

      await expect(
        runMonthlyReportPreview(
          ['--confirm-dev', '--hotel', 'hotel-inexistant'],
          {
            repo: mockRepo,
            env: { NODE_ENV: 'development' },
          },
        ),
      ).rejects.toThrow('Hôtel introuvable avec l\'identifiant : "hotel-inexistant".');
    });

    it('refuse si l option --confirm-dev est absente', async () => {
      await expect(
        runMonthlyReportPreview(['--hotel', sampleHotelId], {
          env: { NODE_ENV: 'development' },
        }),
      ).rejects.toThrow(
        "L'option --confirm-dev est requise pour prévisualiser le rapport mensuel.",
      );
    });

    it('refuse si NODE_ENV=production', async () => {
      await expect(
        runMonthlyReportPreview(
          ['--confirm-dev', '--hotel', sampleHotelId],
          {
            env: { NODE_ENV: 'production' },
          },
        ),
      ).rejects.toThrow(
        'La prévisualisation du rapport mensuel est refusée en production.',
      );
    });
  });
});
