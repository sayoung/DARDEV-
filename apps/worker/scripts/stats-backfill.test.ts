import { describe, expect, it, vi } from 'vitest';
import {
  computeBackfillDateRange,
  isDirectExecution,
  parseBackfillArgs,
  runBackfill,
} from './stats-backfill.js';
import type { StatsDailyRepository } from '../src/stats-daily-repository.js';
import type { StatsDailySourceEvent } from '../src/stats-daily-aggregation.js';

describe('stats-backfill', () => {
  describe('parseBackfillArgs', () => {
    it('retourne les valeurs par défaut (7 jours) lorsque seul --confirm-dev est fourni', () => {
      const result = parseBackfillArgs(['--confirm-dev'], {
        NODE_ENV: 'development',
      });
      expect(result).toEqual({
        confirmDev: true,
        days: 7,
      });
    });

    it('accepte l\'option --days avec une valeur séparée (--days 3)', () => {
      const result = parseBackfillArgs(['--confirm-dev', '--days', '3'], {
        NODE_ENV: 'development',
      });
      expect(result).toEqual({
        confirmDev: true,
        days: 3,
      });
    });

    it('accepte l\'option --days avec une valeur liée (--days=3)', () => {
      const result = parseBackfillArgs(['--confirm-dev', '--days=3'], {
        NODE_ENV: 'development',
      });
      expect(result).toEqual({
        confirmDev: true,
        days: 3,
      });
    });

    it('accepte les bornes minimale (1) et maximale (92)', () => {
      expect(
        parseBackfillArgs(['--confirm-dev', '--days', '1'], {
          NODE_ENV: 'development',
        }),
      ).toEqual({
        confirmDev: true,
        days: 1,
      });
      expect(
        parseBackfillArgs(['--confirm-dev', '--days', '92'], {
          NODE_ENV: 'development',
        }),
      ).toEqual({
        confirmDev: true,
        days: 92,
      });
    });

    it('refuse si l\'option --confirm-dev est absente', () => {
      expect(() =>
        parseBackfillArgs([], { NODE_ENV: 'development' }),
      ).toThrow(
        "L'option --confirm-dev est requise pour lancer le rattrapage statistique.",
      );
      expect(() =>
        parseBackfillArgs(['--days', '3'], { NODE_ENV: 'development' }),
      ).toThrow(
        "L'option --confirm-dev est requise pour lancer le rattrapage statistique.",
      );
    });

    it('refuse si NODE_ENV=production même si --confirm-dev est fourni', () => {
      expect(() =>
        parseBackfillArgs(['--confirm-dev'], { NODE_ENV: 'production' }),
      ).toThrow('Le rattrapage des statistiques est refusé en production.');
    });

    it('refuse les valeurs invalides pour --days (hors bornes, non entières, absentes)', () => {
      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days', '0'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        'La valeur de --days doit être un entier compris entre 1 et 92 : "0".',
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days', '93'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        'La valeur de --days doit être un entier compris entre 1 et 92 : "93".',
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days', '-5'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        "L'option --days requiert un argument entier compris entre 1 et 92.",
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days', 'abc'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        'La valeur de --days doit être un entier positif : "abc".',
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days', '3.5'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        'La valeur de --days doit être un entier positif : "3.5".',
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days'], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        "L'option --days requiert un argument entier compris entre 1 et 92.",
      );

      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--days='], {
          NODE_ENV: 'development',
        }),
      ).toThrow(
        'La valeur de --days doit être un entier positif : "".',
      );
    });

    it('refuse les options ou arguments non reconnus', () => {
      expect(() =>
        parseBackfillArgs(['--confirm-dev', '--inconnu'], {
          NODE_ENV: 'development',
        }),
      ).toThrow('Option ou argument non reconnu : "--inconnu".');

      expect(() =>
        parseBackfillArgs(['--confirm-dev', 'positionnel'], {
          NODE_ENV: 'development',
        }),
      ).toThrow('Option ou argument non reconnu : "positionnel".');
    });

    it('ignore le préfixe node et chemin de script lorsque process.argv complet est transmis', () => {
      const fullArgv = [
        'C:\\Program Files\\nodejs\\node.exe',
        'D:\\DARDEV\\local\\xplor_smit\\apps\\worker\\scripts\\stats-backfill.ts',
        '--confirm-dev',
        '--days',
        '5',
      ];
      const result = parseBackfillArgs(fullArgv, { NODE_ENV: 'development' });
      expect(result).toEqual({
        confirmDev: true,
        days: 5,
      });
    });
  });

  describe('computeBackfillDateRange', () => {
    it('calcule correctement la plage UTC pour N jours (aujourd\'hui UTC − (N−1) jours jusqu\'à aujourd\'hui UTC)', () => {
      const now = new Date('2026-11-07T14:32:00.000Z');
      const { from, to } = computeBackfillDateRange(7, now);

      expect(to.toISOString()).toBe('2026-11-07T00:00:00.000Z');
      expect(from.toISOString()).toBe('2026-11-01T00:00:00.000Z');

      const daysDiff =
        Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      expect(daysDiff).toBe(7);
    });

    it('calcule une plage de 1 jour lorsque days = 1', () => {
      const now = new Date('2026-11-07T18:00:00.000Z');
      const { from, to } = computeBackfillDateRange(1, now);

      expect(to.toISOString()).toBe('2026-11-07T00:00:00.000Z');
      expect(from.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    });

    it('calcule une plage de 3 jours lorsque days = 3', () => {
      const now = new Date('2026-11-07T02:00:00.000Z');
      const { from, to } = computeBackfillDateRange(3, now);

      expect(to.toISOString()).toBe('2026-11-07T00:00:00.000Z');
      expect(from.toISOString()).toBe('2026-11-05T00:00:00.000Z');
    });
  });

  describe('isDirectExecution', () => {
    it('détecte correctement l\'exécution directe du fichier', () => {
      expect(isDirectExecution('scripts/stats-backfill.ts')).toBe(true);
      expect(
        isDirectExecution(
          'D:\\DARDEV\\local\\xplor_smit\\apps\\worker\\scripts\\stats-backfill.ts',
        ),
      ).toBe(true);
      expect(
        isDirectExecution(
          '/var/app/apps/worker/dist/scripts/stats-backfill.js',
        ),
      ).toBe(true);
    });

    it('retourne false lorsque le fichier n\'est pas exécuté directement', () => {
      expect(isDirectExecution(undefined)).toBe(false);
      expect(isDirectExecution('')).toBe(false);
      expect(isDirectExecution('src/main.ts')).toBe(false);
      expect(isDirectExecution('node_modules/vitest/vitest.mjs')).toBe(false);
    });
  });

  describe('runBackfill', () => {
    it('exécute le rattrapage sur le dépôt injecté et retourne les résumés par jour', async () => {
      const mockEvents: StatsDailySourceEvent[] = [];
      const findEventsForDay = vi
        .fn<StatsDailyRepository['findEventsForDay']>()
        .mockResolvedValue(mockEvents);
      const replaceStatsForDay = vi
        .fn<StatsDailyRepository['replaceStatsForDay']>()
        .mockResolvedValue(undefined);

      const mockRepo: StatsDailyRepository = {
        findEventsForDay,
        replaceStatsForDay,
      };

      const logs: string[] = [];
      const log = (msg: string) => {
        logs.push(msg);
      };

      const fixedNow = new Date('2026-11-07T12:00:00.000Z');
      const summaries = await runBackfill(
        ['--confirm-dev', '--days', '3'],
        {
          repo: mockRepo,
          log,
          now: fixedNow,
          env: { NODE_ENV: 'development' },
        },
      );

      expect(summaries).toHaveLength(3);
      expect(summaries.map((s) => s.day)).toEqual([
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
      ]);
      expect(findEventsForDay).toHaveBeenCalledTimes(3);
      expect(replaceStatsForDay).toHaveBeenCalledTimes(3);

      expect(logs).toContain(
        'Lancement du rattrapage StatsDaily sur 3 jour(s) (2026-11-05 -> 2026-11-07)...',
      );
      expect(logs).toContain(
        'Rattrapage StatsDaily terminé : 3 jour(s) traité(s).',
      );
      expect(logs).toContain('- 2026-11-05 : 0 compartiment(s)');
      expect(logs).toContain('- 2026-11-06 : 0 compartiment(s)');
      expect(logs).toContain('- 2026-11-07 : 0 compartiment(s)');
    });

    it('propage l\'erreur et refuse si --confirm-dev est absent', async () => {
      await expect(
        runBackfill([], { env: { NODE_ENV: 'development' } }),
      ).rejects.toThrow(
        "L'option --confirm-dev est requise pour lancer le rattrapage statistique.",
      );
    });

    it('propage l\'erreur et refuse en environnement de production', async () => {
      await expect(
        runBackfill(['--confirm-dev'], { env: { NODE_ENV: 'production' } }),
      ).rejects.toThrow('Le rattrapage des statistiques est refusé en production.');
    });
  });
});
