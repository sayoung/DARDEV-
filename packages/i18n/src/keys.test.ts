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

  it('définit les clés kiosque en français', () => {
    expect(resources.fr.kiosk.unavailable).toBe('Service momentanément indisponible');
    expect(resources.fr.kiosk.touchToExplore).toBe("Touchez l'écran pour explorer");
    expect(resources.fr.kiosk.loading).toBe('Chargement...');
    expect(resources.fr.kiosk.enroll.title).toBe('Enrôlement du kiosque');
    expect(resources.fr.kiosk.enroll.codeLabel).toBe("Code d'enrôlement");
    expect(resources.fr.kiosk.enroll.submit).toBe('Enrôler le kiosque');
    expect(resources.fr.kiosk.home.allCategories).toBe('Toutes les catégories');
    expect(resources.fr.kiosk.home.featured).toBe('À la une');
    expect(resources.fr.kiosk.home.explore).toBe('Explorer la visite');
    expect(resources.fr.kiosk.home.toursList).toBe('Nos visites virtuelles');
    expect(resources.fr.kiosk.home.noTours).toBe(
      'Aucune visite disponible dans cette catégorie.',
    );
    expect(resources.fr.kiosk.maintenance.title).toBe('Maintenance');
    expect(resources.fr.kiosk.maintenance.submit).toBe('Valider');
    expect(resources.fr.kiosk.maintenance.cancel).toBe('Annuler');
    expect(resources.fr.kiosk.maintenance.clear).toBe('Effacer');
    expect(resources.fr.kiosk.maintenance.error).toBe('Code PIN incorrect.');
    expect(resources.fr.kiosk.maintenance.tooShort).toBe(
      'Le code PIN doit comporter au moins 4 chiffres.',
    );
    expect(resources.fr.kiosk.maintenance.statusTitle).toBe('État du kiosque');
    expect(resources.fr.kiosk.maintenance.appVersion).toBe("Version de l'application");
    expect(resources.fr.kiosk.maintenance.manifestVersion).toBe('Version du manifeste');
    expect(resources.fr.kiosk.maintenance.lastSync).toBe('Dernière synchronisation');
    expect(resources.fr.kiosk.maintenance.none).toBe('Aucun');
    expect(resources.fr.kiosk.maintenance.never).toBe('Jamais');
    expect(resources.fr.kiosk.maintenance.syncStatus).toBe('État de la synchronisation');
    expect(resources.fr.kiosk.maintenance.syncStatusSuccess).toBe('Synchronisé');
    expect(resources.fr.kiosk.maintenance.syncStatusError).toBe('Erreurs de synchronisation');
    expect(resources.fr.kiosk.maintenance.failedTours).toBe('Visites en échec');
    expect(resources.fr.kiosk.maintenance.noFailedTours).toBe('Aucune visite en échec');
    expect(resources.fr.kiosk.maintenance.forceSync).toBe('Forcer la synchronisation');
    expect(resources.fr.kiosk.maintenance.forceSyncing).toBe('Synchronisation en cours...');
    expect(resources.fr.kiosk.maintenance.reenroll).toBe('Réenrôler');
    expect(resources.fr.kiosk.maintenance.confirmReenroll).toBe(
      'Voulez-vous vraiment réenrôler ce kiosque ? Toutes les données locales seront réinitialisées.',
    );
    expect(resources.fr.kiosk.maintenance.close).toBe('Fermer');
  });

  it('définit les clés vr en français', () => {
    expect(resources.fr.vr.enter).toBe('Vivre en VR');
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
