import { Role, ValidationIssueCode } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import { dir, isRtl, resources } from './index.js';
import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

const locales = { fr, ar, en } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const leaves = new Map<string, unknown>();
  if (!isRecord(value)) {
    if (prefix !== '') {
      leaves.set(prefix, value);
    }
    return leaves;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isRecord(child)) {
      for (const [nestedKey, nestedValue] of flatten(child, path)) {
        leaves.set(nestedKey, nestedValue);
      }
    } else {
      leaves.set(path, child);
    }
  }
  return leaves;
}

function faultyKeys(trees: Record<string, unknown>): { faultsFr: string[], warnings: string[] } {
  const flat = new Map<string, Map<string, unknown>>();
  const keys = new Set<string>();
  for (const [lang, tree] of Object.entries(trees)) {
    const leaves = flatten(tree);
    flat.set(lang, leaves);
    for (const key of leaves.keys()) {
      keys.add(key);
    }
  }

  const faultsFr: string[] = [];
  const warnings: string[] = [];
  for (const key of [...keys].sort()) {
    for (const lang of Object.keys(trees).sort()) {
      const value = flat.get(lang)?.get(key);
      if (value === undefined) {
        if (lang === 'fr') faultsFr.push(`${lang}: ${key} (manquante)`);
        else warnings.push(`${lang}: ${key} (manquante)`);
      } else if (typeof value !== 'string' || value.trim() === '') {
        if (lang === 'fr') faultsFr.push(`${lang}: ${key} (vide)`);
        else warnings.push(`${lang}: ${key} (vide)`);
      }
    }
  }
  return { faultsFr, warnings };
}

describe('clés i18n', () => {
  it('exige les clés non vides en fr, signale les manquantes en ar et en', () => {
    const { faultsFr, warnings } = faultyKeys(locales);
    if (warnings.length > 0) {
      console.warn('Traductions manquantes (non bloquantes) :\n' + warnings.join('\n'));
    }
    expect(faultsFr, faultsFr.join('\n')).toEqual([]);
  });

  it('expose les trois fichiers via resources', () => {
    expect(resources).toEqual(locales);
  });

  it('traduit chaque rôle sans reprendre le code d’énumération', () => {
    for (const role of Object.values(Role)) {
      for (const lang of ['fr', 'ar', 'en'] as const) {
        const label = resources[lang].auth.role[role];
        expect(label).not.toBe(role);
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('traduit chaque ValidationIssueCode en français', () => {
    for (const code of Object.values(ValidationIssueCode)) {
      const label = resources.fr.catalog.issue[code as keyof typeof resources.fr.catalog.issue];
      expect(label, `La clé catalog.issue.${code} est manquante ou vide en français`).toBeDefined();
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('isRtl / dir', () => {
  it("ne marque que l'arabe comme RTL", () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(isRtl('en')).toBe(false);
    expect(dir('ar')).toBe('rtl');
    expect(dir('fr')).toBe('ltr');
    expect(dir('en')).toBe('ltr');
  });
});
