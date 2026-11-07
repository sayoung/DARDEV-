import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaStatsDailyRepository } from '../src/stats-daily-repository.js';
import {
  recalculateStatsDailyRange,
  type StatsDailyJobDaySummary,
} from '../src/stats-daily.job.js';
import type { StatsDailyRepository } from '../src/stats-daily-repository.js';

export interface BackfillArgs {
  confirmDev: true;
  days: number;
}

export function parseBackfillArgs(
  argv: readonly string[],
  env: Record<string, string | undefined> = process.env,
): BackfillArgs {
  if (env.NODE_ENV === 'production') {
    throw new Error('Le rattrapage des statistiques est refusé en production.');
  }

  let args = [...argv];
  if (
    args.length >= 2 &&
    args[0] !== undefined &&
    !args[0].startsWith('-') &&
    args[1] !== undefined &&
    (/[/\\]stats-backfill\.(ts|js)$/.test(args[1]) ||
      args[0].includes('node') ||
      args[0].includes('tsx'))
  ) {
    args = args.slice(2);
  }

  let confirmDev = false;
  let rawDays: string | undefined = undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }

    if (arg === '--confirm-dev') {
      confirmDev = true;
    } else if (arg === '--days') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error(
          "L'option --days requiert un argument entier compris entre 1 et 92.",
        );
      }
      rawDays = next;
      i += 1;
    } else if (arg.startsWith('--days=')) {
      rawDays = arg.slice('--days='.length);
    } else {
      throw new Error(`Option ou argument non reconnu : "${arg}".`);
    }
  }

  if (!confirmDev) {
    throw new Error(
      "L'option --confirm-dev est requise pour lancer le rattrapage statistique.",
    );
  }

  let days = 7;
  if (rawDays !== undefined) {
    if (!/^\d+$/.test(rawDays)) {
      throw new Error(
        `La valeur de --days doit être un entier positif : "${rawDays}".`,
      );
    }
    const parsedDays = Number(rawDays);
    if (!Number.isSafeInteger(parsedDays) || parsedDays < 1 || parsedDays > 92) {
      throw new Error(
        `La valeur de --days doit être un entier compris entre 1 et 92 : "${rawDays}".`,
      );
    }
    days = parsedDays;
  }

  return {
    confirmDev: true,
    days,
  };
}

export function computeBackfillDateRange(
  days: number,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const MS_PER_DAY = 86_400_000;
  const from = new Date(to.getTime() - (days - 1) * MS_PER_DAY);
  return { from, to };
}

export function isDirectExecution(argv1: string | undefined): boolean {
  return typeof argv1 === 'string' && /[/\\]stats-backfill\.(ts|js)$/.test(argv1);
}

export function loadLocalEnvFile(): void {
  const envPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../.env',
  );
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

export interface RunBackfillDeps {
  prisma?: PrismaClient;
  repo?: StatsDailyRepository;
  log?: (message: string) => void;
  now?: Date;
  env?: Record<string, string | undefined>;
}

export async function runBackfill(
  argv: readonly string[],
  deps: RunBackfillDeps = {},
): Promise<StatsDailyJobDaySummary[]> {
  const options = parseBackfillArgs(argv, deps.env);
  const log = deps.log ?? console.log;
  const { from, to } = computeBackfillDateRange(options.days, deps.now);

  const ownPrisma = deps.prisma === undefined ? new PrismaClient() : undefined;
  const prisma = deps.prisma ?? ownPrisma;
  if (prisma === undefined) {
    throw new Error('PrismaClient non initialisé');
  }

  try {
    const repo = deps.repo ?? new PrismaStatsDailyRepository(prisma);

    log(
      `Lancement du rattrapage StatsDaily sur ${String(options.days)} jour(s) (${from.toISOString().slice(0, 10)} -> ${to.toISOString().slice(0, 10)})...`,
    );

    const summaries = await recalculateStatsDailyRange(
      {
        repo,
        log,
      },
      from,
      to,
    );

    log(
      `Rattrapage StatsDaily terminé : ${String(summaries.length)} jour(s) traité(s).`,
    );
    for (const summary of summaries) {
      log(`- ${summary.day} : ${String(summary.bucketsCount)} compartiment(s)`);
    }

    return summaries;
  } finally {
    if (ownPrisma !== undefined) {
      await ownPrisma.$disconnect();
    }
  }
}

export async function main(): Promise<void> {
  loadLocalEnvFile();
  try {
    await runBackfill(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

if (isDirectExecution(process.argv[1])) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
