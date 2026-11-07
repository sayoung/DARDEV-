import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  HotelMonthlyReportDataSchema,
  type HotelMonthlyReportData,
} from '@xplor/shared';
import { generateHotelMonthlyReportPdf } from '../src/hotel-monthly-report-pdf.js';
import {
  PrismaHotelMonthlyReportRepository,
  type HotelMonthlyReportRepository,
} from '../src/hotel-monthly-report-repository.js';

export interface PreviewArgs {
  confirmDev: true;
  hotelId: string;
  month: string;
}

export function formatYearMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${String(year)}-${month}`;
}

export function parsePreviewArgs(
  argv: readonly string[],
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): PreviewArgs {
  if (env.NODE_ENV === 'production') {
    throw new Error('La prévisualisation du rapport mensuel est refusée en production.');
  }

  let args = [...argv];
  if (
    args.length >= 2 &&
    args[0] !== undefined &&
    !args[0].startsWith('-') &&
    args[1] !== undefined &&
    (/[/\\]monthly-report-preview\.(ts|js)$/.test(args[1]) ||
      args[0].includes('node') ||
      args[0].includes('tsx'))
  ) {
    args = args.slice(2);
  }

  let confirmDev = false;
  let rawHotel: string | undefined = undefined;
  let rawMonth: string | undefined = undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }

    if (arg === '--confirm-dev') {
      confirmDev = true;
    } else if (arg === '--hotel') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error("L'option --hotel requiert un identifiant d'hôtel.");
      }
      rawHotel = next;
      i += 1;
    } else if (arg.startsWith('--hotel=')) {
      rawHotel = arg.slice('--hotel='.length);
    } else if (arg === '--month') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error("L'option --month requiert un mois au format AAAA-MM.");
      }
      rawMonth = next;
      i += 1;
    } else if (arg.startsWith('--month=')) {
      rawMonth = arg.slice('--month='.length);
    } else {
      throw new Error(`Option ou argument non reconnu : "${arg}".`);
    }
  }

  if (!confirmDev) {
    throw new Error(
      "L'option --confirm-dev est requise pour prévisualiser le rapport mensuel.",
    );
  }

  if (rawHotel === undefined || rawHotel.trim().length === 0) {
    throw new Error("L'option --hotel <id> est obligatoire.");
  }
  const hotelId = rawHotel.trim();

  let month = formatYearMonth(now);
  if (rawMonth !== undefined) {
    const trimmed = rawMonth.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
      throw new Error(
        `Le mois doit être au format AAAA-MM (ex: 2026-11) : "${trimmed}".`,
      );
    }
    month = trimmed;
  }

  return {
    confirmDev: true,
    hotelId,
    month,
  };
}

export function computeMonthUtcRange(month: string): { from: Date; to: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(
      `Le format du mois est invalide : "${month}". Format attendu : AAAA-MM.`,
    );
  }
  const parts = month.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  if (yearStr === undefined || monthStr === undefined) {
    throw new Error(`Le format du mois est invalide : "${month}".`);
  }
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const from = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const to = new Date(Date.UTC(nextYear, nextMonthIndex, 1, 0, 0, 0, 0));

  return { from, to };
}

export function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function computeReportFilename(
  hotelSlugOuId: string,
  month: string,
): string {
  return `xplor-rapport-${hotelSlugOuId}-${month}.pdf`;
}

export function isDirectExecution(argv1: string | undefined): boolean {
  return (
    typeof argv1 === 'string' &&
    /[/\\]monthly-report-preview\.(ts|js)$/.test(argv1)
  );
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

export interface MonthlyReportPreviewResult {
  filePath: string;
  bytesCount: number;
  hotelId: string;
  hotelName: string;
  month: string;
}

export interface MonthlyReportPreviewDeps {
  prisma?: PrismaClient;
  repo?: HotelMonthlyReportRepository;
  generatePdf?: (
    data: HotelMonthlyReportData,
    lang: string,
  ) => Promise<Uint8Array>;
  writeFile?: (path: string, data: Uint8Array) => Promise<void>;
  log?: (message: string) => void;
  now?: Date;
  env?: Record<string, string | undefined>;
  tmpDir?: string;
}

export async function runMonthlyReportPreview(
  argv: readonly string[],
  deps: MonthlyReportPreviewDeps = {},
): Promise<MonthlyReportPreviewResult> {
  const options = parsePreviewArgs(argv, deps.now, deps.env);
  const log = deps.log ?? console.log;
  const { from, to } = computeMonthUtcRange(options.month);

  const ownPrisma =
    deps.prisma === undefined && deps.repo === undefined
      ? new PrismaClient()
      : undefined;
  const prisma = deps.prisma ?? ownPrisma;

  try {
    let hotel: { id: string; name: string } | null = null;

    if (prisma !== undefined) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          options.hotelId,
        );
      if (isUuid) {
        const found = await prisma.hotel.findFirst({
          where: { id: options.hotelId, deletedAt: null },
          select: { id: true, name: true },
        });
        if (found !== null) {
          hotel = found;
        }
      }

      if (hotel === null) {
        const allHotels = await prisma.hotel.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
        });
        for (const candidate of allHotels) {
          if (
            candidate.id === options.hotelId ||
            sanitizeFilename(candidate.name) === options.hotelId ||
            candidate.name.toLowerCase() === options.hotelId.toLowerCase()
          ) {
            hotel = candidate;
            break;
          }
        }
      }
    } else if (deps.repo !== undefined) {
      const activeHotels = await deps.repo.listActiveHotels();
      for (const candidate of activeHotels) {
        if (
          candidate.id === options.hotelId ||
          sanitizeFilename(candidate.name) === options.hotelId ||
          candidate.name.toLowerCase() === options.hotelId.toLowerCase()
        ) {
          hotel = { id: candidate.id, name: candidate.name };
          break;
        }
      }
    }

    if (hotel === null) {
      throw new Error(
        `Hôtel introuvable avec l'identifiant : "${options.hotelId}".`,
      );
    }

    const repo =
      deps.repo ??
      (prisma !== undefined
        ? new PrismaHotelMonthlyReportRepository(prisma)
        : undefined);
    if (repo === undefined) {
      throw new Error("Impossible d'initialiser le dépôt de données.");
    }

    log(
      `Génération de l'aperçu du rapport mensuel pour "${hotel.name}" (${options.month})...`,
    );

    const rawData = await repo.getHotelMonthlyReportData(
      hotel.id,
      hotel.name,
      from,
      to,
      'fr',
    );
    const reportData = HotelMonthlyReportDataSchema.parse(rawData);

    const pdfGenerator = deps.generatePdf ?? generateHotelMonthlyReportPdf;
    const pdfBytes = await pdfGenerator(reportData, 'fr');

    const hotelSlug = sanitizeFilename(hotel.name);
    const hotelSlugOuId = hotelSlug.length > 0 ? hotelSlug : hotel.id;
    const filename = computeReportFilename(hotelSlugOuId, options.month);
    const targetDir = deps.tmpDir ?? tmpdir();
    const filePath = resolve(targetDir, filename);

    const writeFn = deps.writeFile ?? writeFile;
    await writeFn(filePath, pdfBytes);

    log(`Rapport mensuel PDF écrit avec succès :`);
    log(`- Fichier : ${filePath}`);
    log(`- Taille : ${String(pdfBytes.byteLength)} octets`);

    return {
      filePath,
      bytesCount: pdfBytes.byteLength,
      hotelId: hotel.id,
      hotelName: hotel.name,
      month: options.month,
    };
  } finally {
    if (ownPrisma !== undefined) {
      await ownPrisma.$disconnect();
    }
  }
}

export async function main(): Promise<void> {
  loadLocalEnvFile();
  try {
    await runMonthlyReportPreview(process.argv.slice(2));
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
