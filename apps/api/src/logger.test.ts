import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createAppLogger } from './logger.js';

const jsonLogSchema = z.object({
  level: z.string(),
  message: z.string(),
  pid: z.number(),
  timestamp: z.number(),
  context: z.string().optional(),
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

describe('createAppLogger (NF-10)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('en production', () => {
    it('une ligne écrite via log produit un JSON valide avec les champs level et message', () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('production');
      logger.log('Connexion établie avec succès');

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const firstChunk = stdoutChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).not.toBeNull();
        if (logRecord !== null) {
          expect(logRecord.level).toBe('log');
          expect(logRecord.message).toBe('Connexion établie avec succès');
          expect(typeof logRecord.pid).toBe('number');
          expect(typeof logRecord.timestamp).toBe('number');
        }
      }
    });

    it('une ligne écrite via warn produit un JSON valide avec le level warn', () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('production');
      logger.warn('Capacité mémoire élevée');

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const firstChunk = stdoutChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).not.toBeNull();
        if (logRecord !== null) {
          expect(logRecord.level).toBe('warn');
          expect(logRecord.message).toBe('Capacité mémoire élevée');
        }
      }
    });

    it('une ligne écrite via error produit un JSON valide sur stderr avec le level error', () => {
      const stderrChunks: string[] = [];
      vi.spyOn(process.stderr, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stderrChunks.push(chunk);
        } else {
          stderrChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('production');
      logger.error('Échec de connexion à la base de données');

      expect(stderrChunks.length).toBeGreaterThan(0);
      const firstChunk = stderrChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).not.toBeNull();
        if (logRecord !== null) {
          expect(logRecord.level).toBe('error');
          expect(logRecord.message).toBe('Échec de connexion à la base de données');
        }
      }
    });
  });

  describe('hors production', () => {
    it('en environnement development, la sortie n est pas du JSON', () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('development');
      logger.log('Message de développement');

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const firstChunk = stdoutChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).toBeNull();
        expect(() => {
          JSON.parse(firstChunk.trim());
        }).toThrow();
        expect(firstChunk).toContain('Message de développement');
        expect(firstChunk).toContain('LOG');
      }
    });

    it('en environnement test, la sortie n est pas du JSON', () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('test');
      logger.log('Message d environnement de test');

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const firstChunk = stdoutChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).toBeNull();
        expect(() => {
          JSON.parse(firstChunk.trim());
        }).toThrow();
        expect(firstChunk).toContain('Message d environnement de test');
      }
    });

    it('en environnement quelconque non-production, la sortie n est pas du JSON', () => {
      const stdoutChunks: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Uint8Array | string) => {
        if (typeof chunk === 'string') {
          stdoutChunks.push(chunk);
        } else {
          stdoutChunks.push(Buffer.from(chunk).toString('utf-8'));
        }
        return true;
      });

      const logger = createAppLogger('staging');
      logger.log('Message staging');

      expect(stdoutChunks.length).toBeGreaterThan(0);
      const firstChunk = stdoutChunks[0];
      expect(firstChunk).toBeDefined();
      if (firstChunk !== undefined) {
        const logRecord = parseJsonLog(firstChunk);
        expect(logRecord).toBeNull();
        expect(() => {
          JSON.parse(firstChunk.trim());
        }).toThrow();
      }
    });
  });
});
