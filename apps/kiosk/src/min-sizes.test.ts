import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

export interface ParsedCssRules {
  rules: Map<string, Record<string, string>>;
}

/**
 * Analyse une feuille CSS et extrait les déclarations par sélecteur.
 */
export function parseCssDeclarations(css: string): Map<string, Record<string, string>> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleMap = new Map<string, Record<string, string>>();
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match: RegExpExecArray | null = ruleRegex.exec(withoutComments);

  while (match !== null) {
    const rawSelectors = match[1];
    const rawBody = match[2];
    if (typeof rawSelectors === 'string' && typeof rawBody === 'string') {
      const selectors = rawSelectors
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('@'));
      const decls: Record<string, string> = {};
      const pairs = rawBody.split(';');
      for (const pair of pairs) {
        const colonIndex = pair.indexOf(':');
        if (colonIndex !== -1) {
          const prop = pair.slice(0, colonIndex).trim();
          const val = pair.slice(colonIndex + 1).trim();
          if (prop.length > 0 && val.length > 0) {
            decls[prop] = val;
          }
        }
      }
      for (const selector of selectors) {
        const existing = ruleMap.get(selector) ?? {};
        ruleMap.set(selector, { ...existing, ...decls });
      }
    }
    match = ruleRegex.exec(withoutComments);
  }

  return ruleMap;
}

/**
 * Extrait la valeur numérique en pixels d'une chaîne CSS (ex: "48px" -> 48).
 */
export function parsePixelValue(val: string | undefined): number | null {
  if (typeof val !== 'string') {
    return null;
  }
  const match = /^(\d+(?:\.\d+)?)px$/.exec(val.trim());
  if (!match) {
    return null;
  }
  const numStr = match[1];
  if (typeof numStr !== 'string') {
    return null;
  }
  const num = Number(numStr);
  return Number.isNaN(num) ? null : num;
}

/**
 * Vérifie qu'un sélecteur déclare des dimensions minimales au moins égales au seuil.
 */
export function validateButtonDimensions(
  ruleMap: Map<string, Record<string, string>>,
  selector: string,
  minThresholdPx: number = 48,
): { valid: boolean; minBlockSize: number | null; minInlineSize: number | null; error?: string } {
  const decls = ruleMap.get(selector);
  if (!decls) {
    return {
      valid: false,
      minBlockSize: null,
      minInlineSize: null,
      error: `Sélecteur "${selector}" introuvable dans la feuille CSS`,
    };
  }

  const minBlock = parsePixelValue(decls['min-block-size']);
  const minInline = parsePixelValue(decls['min-inline-size']);

  if (minBlock === null || minBlock < minThresholdPx) {
    return {
      valid: false,
      minBlockSize: minBlock,
      minInlineSize: minInline,
      error: `Sélecteur "${selector}" déclare min-block-size=${String(minBlock)}px (attendu >= ${String(minThresholdPx)}px)`,
    };
  }

  if (minInline === null || minInline < minThresholdPx) {
    return {
      valid: false,
      minBlockSize: minBlock,
      minInlineSize: minInline,
      error: `Sélecteur "${selector}" déclare min-inline-size=${String(minInline)}px (attendu >= ${String(minThresholdPx)}px)`,
    };
  }

  return {
    valid: true,
    minBlockSize: minBlock,
    minInlineSize: minInline,
  };
}

describe('M8 NF-05 : Tailles minimales du kiosque', () => {
  const cssPath = typeof __dirname !== 'undefined'
    ? path.resolve(__dirname, 'style.css')
    : path.resolve(process.cwd(), 'apps/kiosk/src/style.css');

  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const ruleMap = parseCssDeclarations(cssContent);

  const REQUIRED_BUTTON_SELECTORS = [
    'button',
    '.kiosk-lang-btn',
    '.kiosk-featured-btn',
    '.kiosk-category-btn',
    '.kiosk-tour-card',
    '.kiosk-enroll-btn',
    '.kiosk-pin-btn',
    '.kiosk-pin-cancel-btn',
    '.kiosk-btn',
    '.kiosk-tour-back-btn',
    '.kiosk-tour-audio-btn',
    '.psv-gallery-item',
    '.psv-gallery-arrow',
    '.psv-virtual-tour-arrow',
  ] as const;

  describe('Taille de police de base (NF-05 : textes >= 18px)', () => {
    it('déclare une taille de police de base d’au moins 18px sur body et html', () => {
      const bodyDecls = ruleMap.get('body');
      const htmlDecls = ruleMap.get('html');

      expect(bodyDecls).toBeDefined();
      expect(htmlDecls).toBeDefined();

      if (bodyDecls) {
        const bodyFontSize = parsePixelValue(bodyDecls['font-size']);
        expect(bodyFontSize).not.toBeNull();
        if (bodyFontSize !== null) {
          expect(bodyFontSize).toBeGreaterThanOrEqual(18);
        }
      }

      if (htmlDecls) {
        const htmlFontSize = parsePixelValue(htmlDecls['font-size']);
        expect(htmlFontSize).not.toBeNull();
        if (htmlFontSize !== null) {
          expect(htmlFontSize).toBeGreaterThanOrEqual(18);
        }
      }
    });

    it('n’utilise aucune taille de police absolue ou relative inférieure à 1rem / 18px', () => {
      // Vérifie que les déclarations de font-size en rem sont toutes >= 1rem (18px)
      const fontSizeMatches = cssContent.matchAll(/font-size:\s*([0-9.]+)(rem|px)/g);
      for (const match of fontSizeMatches) {
        const value = Number(match[1]);
        const unit = match[2];
        if (unit === 'px') {
          expect(value).toBeGreaterThanOrEqual(18);
        } else if (unit === 'rem') {
          expect(value).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Tailles des éléments interactifs (NF-05 : zones tactiles >= 48px)', () => {
    for (const selector of REQUIRED_BUTTON_SELECTORS) {
      it(`le sélecteur "${selector}" déclare min-block-size >= 48px et min-inline-size >= 48px`, () => {
        const result = validateButtonDimensions(ruleMap, selector, 48);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.minBlockSize).not.toBeNull();
        expect(result.minInlineSize).not.toBeNull();
        if (result.minBlockSize !== null) {
          expect(result.minBlockSize).toBeGreaterThanOrEqual(48);
        }
        if (result.minInlineSize !== null) {
          expect(result.minInlineSize).toBeGreaterThanOrEqual(48);
        }
      });
    }

    it('utilise des propriétés logiques (min-block-size et min-inline-size) et aucune dimension physique résiduelle', () => {
      expect(cssContent).toMatch(/min-block-size:\s*48px/);
      expect(cssContent).toMatch(/min-inline-size:\s*48px/);

      // Aucune propriété physique min-height ou min-width dans les sélecteurs de boutons
      for (const selector of REQUIRED_BUTTON_SELECTORS) {
        const decls = ruleMap.get(selector);
        if (decls) {
          expect(decls['min-height']).toBeUndefined();
          expect(decls['min-width']).toBeUndefined();
        }
      }
    });
  });

  describe('Rendu et styles calculés sous Happy DOM', () => {
    beforeEach(() => {
      document.head.replaceChildren();
      document.body.replaceChildren();

      const styleEl = document.createElement('style');
      styleEl.textContent = cssContent;
      document.head.appendChild(styleEl);
    });

    it('applique la taille de police de base de 18px au document', () => {
      const computedBody = window.getComputedStyle(document.body);
      expect(computedBody.getPropertyValue('font-size')).toBe('18px');
    });

    it('applique les dimensions minimales logiques >= 48px sur les boutons instanciés dans le DOM', () => {
      const testCases: { className: string; expectedMinBlock: number; expectedMinInline: number }[] = [
        { className: 'kiosk-lang-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-featured-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-category-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-tour-card', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-enroll-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-pin-btn', expectedMinBlock: 54, expectedMinInline: 48 },
        { className: 'kiosk-pin-cancel-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-tour-back-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'kiosk-tour-audio-btn', expectedMinBlock: 48, expectedMinInline: 48 },
        { className: 'psv-gallery-item', expectedMinBlock: 48, expectedMinInline: 48 },
      ];

      for (const tc of testCases) {
        const btn = document.createElement('button');
        btn.className = tc.className;
        document.body.appendChild(btn);

        const computed = window.getComputedStyle(btn);
        const minBlock = parsePixelValue(computed.getPropertyValue('min-block-size'));
        const minInline = parsePixelValue(computed.getPropertyValue('min-inline-size'));

        expect(minBlock).not.toBeNull();
        expect(minInline).not.toBeNull();
        if (minBlock !== null) {
          expect(minBlock).toBeGreaterThanOrEqual(tc.expectedMinBlock);
        }
        if (minInline !== null) {
          expect(minInline).toBeGreaterThanOrEqual(tc.expectedMinInline);
        }

        document.body.removeChild(btn);
      }
    });
  });

  describe('Validation d’erreur / détection des valeurs insuffisantes', () => {
    it('détecte et rejette un sélecteur absent', () => {
      const emptyMap = new Map<string, Record<string, string>>();
      const result = validateButtonDimensions(emptyMap, '.btn-missing', 48);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('introuvable');
    });

    it('détecte et rejette un min-block-size inférieur à 48px', () => {
      const mockMap = new Map<string, Record<string, string>>([
        ['.btn-too-small', { 'min-block-size': '36px', 'min-inline-size': '48px' }],
      ]);
      const result = validateButtonDimensions(mockMap, '.btn-too-small', 48);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('min-block-size=36px');
    });

    it('détecte et rejette un min-inline-size inférieur à 48px', () => {
      const mockMap = new Map<string, Record<string, string>>([
        ['.btn-too-narrow', { 'min-block-size': '48px', 'min-inline-size': '32px' }],
      ]);
      const result = validateButtonDimensions(mockMap, '.btn-too-narrow', 48);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('min-inline-size=32px');
    });

    it('détecte et rejette une absence de dimensions minimales', () => {
      const mockMap = new Map<string, Record<string, string>>([
        ['.btn-no-dims', { padding: '8px' }],
      ]);
      const result = validateButtonDimensions(mockMap, '.btn-no-dims', 48);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('parsePixelValue retourne null pour des valeurs invalides', () => {
      expect(parsePixelValue(undefined)).toBeNull();
      expect(parsePixelValue('auto')).toBeNull();
      expect(parsePixelValue('100%')).toBeNull();
      expect(parsePixelValue('not-a-number')).toBeNull();
    });
  });
});
