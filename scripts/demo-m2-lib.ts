import { ProcessingStatus } from '@xplor/shared';

export function listPanoramaFiles(names: string[]): { file: string; expectInvalid: boolean }[] {
  return names
    .filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    })
    .sort()
    .map((name) => ({
      file: name,
      expectInvalid: name.toLowerCase().startsWith('invalide_'),
    }));
}

export function isUnexpected(r: { expectInvalid: boolean; status: ProcessingStatus | 'TIMEOUT' }): boolean {
  if (r.expectInvalid) {
    return r.status === ProcessingStatus.READY;
  } else {
    return r.status !== ProcessingStatus.READY;
  }
}

export interface ProcessingResult {
  file: string;
  dimensions?: { width: number; height: number } | null;
  status: ProcessingStatus | 'TIMEOUT';
  durationSeconds?: number;
  expectInvalid: boolean;
  raison?: string;
}

export function summarize(results: ProcessingResult[]): { lines: string[]; exitCode: number } {
  let hasUnexpected = false;
  const lines: string[] = [];

  for (const r of results) {
    if (isUnexpected(r)) {
      hasUnexpected = true;
    }
    const dim = r.dimensions ? `${String(r.dimensions.width)}x${String(r.dimensions.height)}` : '-';
    const dur = r.durationSeconds !== undefined ? `${String(r.durationSeconds)}s` : '-';
    const raisonStr = r.raison ? r.raison : '-';
    lines.push(`| ${r.file} | ${dim} | ${r.status} | ${dur} | ${raisonStr} |`);
  }

  return {
    lines,
    exitCode: hasUnexpected ? 1 : 0,
  };
}
