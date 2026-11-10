import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function walk(dir: string, exts: string[], fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, exts, fileList);
    } else if (exts.includes(path.extname(filePath))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Physical CSS Audit (M8 i18n)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const targetDirs = [
    path.join(rootDir, 'apps/admin/src'),
    path.join(rootDir, 'apps/web/src'),
    path.join(rootDir, 'apps/kiosk/src'),
    path.join(rootDir, 'packages/viewer-core/src'),
  ];
  const exts = ['.css', '.ts', '.tsx'];

  it('ne doit contenir aucune propriété CSS physique dans les feuilles de style .css', () => {
    const cssPhysicalRegex = /(margin-left|margin-right|padding-left|padding-right|text-align\s*:\s*(?:left|right)|\bleft\s*:\s*|\bright\s*:\s*|border-left|border-right|float\s*:\s*(?:left|right))/i;
    const errors: string[] = [];

    for (const dir of targetDirs) {
      const cssFiles = walk(dir, ['.css']);
      for (const file of cssFiles) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          if (cssPhysicalRegex.test(line)) {
            errors.push(`${path.relative(rootDir, file)}:${String(index + 1)}: ${line.trim()}`);
          }
        });
      }
    }

    expect(errors, `Propriétés physiques trouvées dans les fichiers CSS:\n${errors.join('\n')}`).toEqual([]);
  });

  it('ne doit contenir aucune classe Tailwind physique (ml-, mr-, pl-, pr-, text-left, text-right)', () => {
    const tailwindPhysicalRegex = /\b(ml|mr|pl|pr)-|\btext-(left|right)\b/;
    const errors: string[] = [];

    for (const dir of targetDirs) {
      const files = walk(dir, ['.ts', '.tsx']);
      for (const file of files) {
        if (file.endsWith('style-guard.test.ts') || file.endsWith('physical-css-audit.test.ts')) {
          continue;
        }
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          if (tailwindPhysicalRegex.test(line)) {
            errors.push(`${path.relative(rootDir, file)}:${String(index + 1)}: ${line.trim()}`);
          }
        });
      }
    }

    expect(errors, `Classes Tailwind physiques trouvées:\n${errors.join('\n')}`).toEqual([]);
  });

  it('valide que tout usage physique résiduel (canevas 2D, coordonnées d’édition) est documenté', () => {
    const physicalPropRegex = /(margin-left|margin-right|padding-left|padding-right|text-align\s*:\s*(?:left|right)|\bleft\s*:\s*|\bright\s*:\s*|border-left|border-right|float\s*:\s*(?:left|right)|\bml-|\bmr-|\bpl-|\bpr-|\btext-left|\btext-right)/i;
    const unhandledMatches: string[] = [];

    for (const dir of targetDirs) {
      const files = walk(dir, exts);
      for (const file of files) {
        if (file.endsWith('style-guard.test.ts') || file.endsWith('physical-css-audit.test.ts')) {
          continue;
        }
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, index) => {
          if (physicalPropRegex.test(line)) {
            const rel = path.relative(rootDir, file).replace(/\\/g, '/');
            const isDocumentedPhysical =
              rel.includes('scene-editor') ||
              rel.includes('vr-info-panel-canvas') ||
              rel.includes('vr-geometry.test');

            if (!isDocumentedPhysical) {
              unhandledMatches.push(`${rel}:${String(index + 1)}: ${line.trim()}`);
            }
          }
        });
      }
    }

    expect(unhandledMatches, `Propriétés physiques non autorisées:\n${unhandledMatches.join('\n')}`).toEqual([]);
  });
});
