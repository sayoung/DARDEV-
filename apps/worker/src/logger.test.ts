import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createWorkerLogger } from './logger.js';

const logJsonSchema = z.object({
  level: z.string(),
  message: z.string(),
  timestamp: z.number(),
});

function parseLogLine(line: string): { level: string; message: string; timestamp: number } {
  const parsed: unknown = JSON.parse(line);
  return logJsonSchema.parse(parsed);
}

function createHarness(nodeEnv: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logger = createWorkerLogger(nodeEnv, {
    stdout: (chunk: string): void => {
      stdout.push(chunk);
    },
    stderr: (chunk: string): void => {
      stderr.push(chunk);
    },
  });
  return { logger, stdout, stderr };
}

describe('createWorkerLogger (M9 NF-10)', () => {
  it('en production, info(x) écrit une ligne terminée par \\n parsable en JSON avec level, message et timestamp', () => {
    const { logger, stdout, stderr } = createHarness('production');
    logger.info('x');

    expect(stderr).toHaveLength(0);
    expect(stdout).toHaveLength(1);
    const line = stdout[0];
    expect(line).toBeDefined();
    if (line !== undefined) {
      expect(line.endsWith('\n')).toBe(true);
      const parsed = parseLogLine(line);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('x');
      expect(typeof parsed.timestamp).toBe('number');
    }

    logger.warn('w');
    logger.log('l');
    const warnLine = stdout[1];
    const logLine = stdout[2];
    expect(warnLine).toBeDefined();
    expect(logLine).toBeDefined();
    if (warnLine !== undefined && logLine !== undefined) {
      expect(parseLogLine(warnLine).level).toBe('warn');
      expect(parseLogLine(logLine).level).toBe('log');
    }
  });

  it('hors production (development), info(x) écrit [INFO] x\\n', () => {
    const { logger, stdout, stderr } = createHarness('development');
    logger.info('x');

    expect(stdout).toEqual(['[INFO] x\n']);
    expect(stderr).toHaveLength(0);
  });

  it('error(new Error("boom")) écrit sur stderr et pas sur stdout, avec le message contenant boom', () => {
    const { logger, stdout, stderr } = createHarness('development');
    logger.error(new Error('boom'));

    expect(stdout).toHaveLength(0);
    expect(stderr).toHaveLength(1);
    const errLine = stderr[0];
    expect(errLine).toBeDefined();
    if (errLine !== undefined) {
      expect(errLine).toContain('boom');
    }
  });

  it('error("texte") écrit sur stderr', () => {
    const { logger, stdout, stderr } = createHarness('development');
    logger.error('texte');

    expect(stdout).toHaveLength(0);
    expect(stderr).toEqual(['[ERROR] texte\n']);
  });

  it('error({a: 1}) et error(42) gèrent une valeur inconnue sans exception', () => {
    const { logger, stdout, stderr } = createHarness('development');
    expect(() => {
      logger.error({ a: 1 });
      logger.error(42);
    }).not.toThrow();

    expect(stdout).toHaveLength(0);
    expect(stderr).toEqual(['[ERROR] [object Object]\n', '[ERROR] 42\n']);
  });
});
