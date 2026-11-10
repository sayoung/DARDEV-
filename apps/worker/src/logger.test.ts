import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWorkerLogger } from './logger.js';

const jsonLogSchema = z.object({
  level: z.enum(['log', 'info', 'warn', 'error']),
  message: z.string(),
  timestamp: z.number(),
});

function parseJsonLog(raw: string): z.infer<typeof jsonLogSchema> | null {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    const validation = jsonLogSchema.safeParse(parsed);
    if (!validation.success) {
      return null;
    }
    return validation.data;
  } catch {
    return null;
  }
}

describe('createWorkerLogger (M9 NF-10)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe('en production', () => {
    it('log écrit du JSON sur stdout avec level=log, timestamp et message', () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('production', {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      const before = Date.now();
      logger.log('Worker initialisé');
      const after = Date.now();

      expect(stderrLines).toHaveLength(0);
      expect(stdoutLines).toHaveLength(1);
      const line = stdoutLines[0];
      expect(line).toBeDefined();
      if (line !== undefined) {
        expect(line.endsWith('\n')).toBe(true);
        const parsed = parseJsonLog(line);
        expect(parsed).not.toBeNull();
        if (parsed !== null) {
          expect(parsed.level).toBe('log');
          expect(parsed.message).toBe('Worker initialisé');
          expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
          expect(parsed.timestamp).toBeLessThanOrEqual(after);
        }
      }
    });

    it('info et warn écrivent du JSON sur stdout avec leurs niveaux respectifs', () => {
      const stdoutLines: string[] = [];
      const logger = createWorkerLogger('production', {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
      });

      logger.info('Information de traitement');
      logger.warn('Avertissement file saturée');

      expect(stdoutLines).toHaveLength(2);

      const infoLine = stdoutLines[0];
      expect(infoLine).toBeDefined();
      if (infoLine !== undefined) {
        const parsedInfo = parseJsonLog(infoLine);
        expect(parsedInfo).not.toBeNull();
        if (parsedInfo !== null) {
          expect(parsedInfo.level).toBe('info');
          expect(parsedInfo.message).toBe('Information de traitement');
        }
      }

      const warnLine = stdoutLines[1];
      expect(warnLine).toBeDefined();
      if (warnLine !== undefined) {
        const parsedWarn = parseJsonLog(warnLine);
        expect(parsedWarn).not.toBeNull();
        if (parsedWarn !== null) {
          expect(parsedWarn.level).toBe('warn');
          expect(parsedWarn.message).toBe('Avertissement file saturée');
        }
      }
    });

    it('error écrit du JSON sur stderr et non sur stdout', () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('production', {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      logger.error('Échec critique');

      expect(stdoutLines).toHaveLength(0);
      expect(stderrLines).toHaveLength(1);
      const line = stderrLines[0];
      expect(line).toBeDefined();
      if (line !== undefined) {
        expect(line.endsWith('\n')).toBe(true);
        const parsed = parseJsonLog(line);
        expect(parsed).not.toBeNull();
        if (parsed !== null) {
          expect(parsed.level).toBe('error');
          expect(parsed.message).toBe('Échec critique');
        }
      }
    });

    it('error sérialise une instance de Error avec .stack en production', () => {
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('production', {
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      const err = new Error('Erreur de conversion S3');
      logger.error(err);

      expect(stderrLines).toHaveLength(1);
      const line = stderrLines[0];
      expect(line).toBeDefined();
      if (line !== undefined) {
        const parsed = parseJsonLog(line);
        expect(parsed).not.toBeNull();
        if (parsed !== null) {
          expect(parsed.level).toBe('error');
          expect(parsed.message).toBe(err.stack ?? err.message);
        }
      }
    });
  });

  describe('hors production', () => {
    it('formate les messages avec [LEVEL] message\\n', () => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('development', {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      logger.log('Message debug');
      logger.info('Message info');
      logger.warn('Message warn');
      logger.error('Message erreur');

      expect(stdoutLines).toEqual([
        '[LOG] Message debug\n',
        '[INFO] Message info\n',
        '[WARN] Message warn\n',
      ]);
      expect(stderrLines).toEqual(['[ERROR] Message erreur\n']);
    });

    it('gère l environnement de test comme hors-production', () => {
      const stdoutLines: string[] = [];
      const logger = createWorkerLogger('test', {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
      });

      logger.log('Trace test');
      expect(stdoutLines).toEqual(['[LOG] Trace test\n']);
    });
  });

  describe('conversion de la valeur pour error', () => {
    it('utilise .stack si disponible pour une instance de Error', () => {
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('development', {
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      const err = new Error('Panne S3');
      logger.error(err);

      expect(stderrLines).toEqual([`[ERROR] ${err.stack ?? err.message}\n`]);
    });

    it('replie sur .message si .stack est undefined', () => {
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('development', {
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      const err = new Error('Erreur sans pile');
      Object.defineProperty(err, 'stack', { value: undefined });
      logger.error(err);

      expect(stderrLines).toEqual(['[ERROR] Erreur sans pile\n']);
    });

    it('laisse une chaîne telle quelle', () => {
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('development', {
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      logger.error('Chaine brute');
      expect(stderrLines).toEqual(['[ERROR] Chaine brute\n']);
    });

    it('convertit les autres types via String()', () => {
      const stderrLines: string[] = [];
      const logger = createWorkerLogger('development', {
        stderr: (chunk: string): void => {
          stderrLines.push(chunk);
        },
      });

      logger.error(404);
      logger.error(false);
      logger.error(null);
      logger.error(undefined);
      logger.error({ code: 'TIMEOUT' });

      expect(stderrLines).toEqual([
        '[ERROR] 404\n',
        '[ERROR] false\n',
        '[ERROR] null\n',
        '[ERROR] undefined\n',
        '[ERROR] [object Object]\n',
      ]);
    });
  });

  describe('valeurs par défaut des arguments', () => {
    it('utilise process.env.NODE_ENV quand nodeEnv n est pas précisé', () => {
      process.env.NODE_ENV = 'production';
      const stdoutLines: string[] = [];
      const logger = createWorkerLogger(undefined, {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
      });

      logger.log('Log en prod implicite');
      expect(stdoutLines).toHaveLength(1);
      const line = stdoutLines[0];
      expect(line).toBeDefined();
      if (line !== undefined) {
        const parsed = parseJsonLog(line);
        expect(parsed).not.toBeNull();
        if (parsed !== null) {
          expect(parsed.level).toBe('log');
          expect(parsed.message).toBe('Log en prod implicite');
        }
      }
    });

    it('utilise development si process.env.NODE_ENV est indéfini', () => {
      delete process.env.NODE_ENV;
      const stdoutLines: string[] = [];
      const logger = createWorkerLogger(undefined, {
        stdout: (chunk: string): void => {
          stdoutLines.push(chunk);
        },
      });

      logger.log('Log par défaut');
      expect(stdoutLines).toEqual(['[LOG] Log par défaut\n']);
    });

    it('écrit sur process.stdout et process.stderr par défaut quand options est omis', () => {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      vi.spyOn(process.stderr, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stderrChunks.push(chunk);
        } else {
          stderrChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createWorkerLogger('development');
      logger.log('Sortie standard directe');
      logger.error('Sortie erreur directe');

      expect(stdoutChunks).toEqual(['[LOG] Sortie standard directe\n']);
      expect(stderrChunks).toEqual(['[ERROR] Sortie erreur directe\n']);
    });
  });
});
