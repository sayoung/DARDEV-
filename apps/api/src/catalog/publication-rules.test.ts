import {
  HotspotType,
  ProcessingStatus,
  TourStatus,
  ValidationIssueCode,
  type ValidationIssue,
} from '@xplor/shared';
import { describe, expect, it } from 'vitest';

import {
  validateTour,
  type FindTargetTour,
  type TargetTourSnapshot,
  type TourHotspotSnapshot,
  type TourSceneSnapshot,
  type TourSnapshot,
} from './publication-rules.js';

const PORTE = 'porte';
const JARDIN = 'jardin';
const REMPARTS = 'remparts';
const VISITE = 'visite-manuelle';

const unreachable = 'Cette scène est inatteignable depuis la scène de départ.';

function scene(
  id: string,
  hotspots: readonly TourHotspotSnapshot[] = [],
  overrides: Partial<Pick<TourSceneSnapshot, 'deleted' | 'panoramaStatus'>> = {},
): TourSceneSnapshot {
  return {
    id,
    deleted: overrides.deleted ?? false,
    panoramaStatus: overrides.panoramaStatus ?? ProcessingStatus.READY,
    hotspots,
  };
}

function sceneLink(id: string, targetSceneId?: string | null): TourHotspotSnapshot {
  return { id, type: HotspotType.SCENE_LINK, targetSceneId };
}

function tourLink(
  id: string,
  targetTourId?: string | null,
  targetTourSceneId?: string | null,
): TourHotspotSnapshot {
  return { id, type: HotspotType.TOUR_LINK, targetTourId, targetTourSceneId };
}

function snapshot(
  id: string,
  startSceneId: string | null,
  scenes: readonly TourSceneSnapshot[],
): TourSnapshot {
  return { id, startSceneId, scenes };
}

function issue(
  code: ValidationIssueCode,
  message: string,
  sceneId?: string,
  hotspotId?: string,
): ValidationIssue {
  return {
    code,
    message,
    ...(sceneId === undefined ? {} : { sceneId }),
    ...(hotspotId === undefined ? {} : { hotspotId }),
  };
}

const none: FindTargetTour = () => undefined;

function published(sceneIds: readonly string[] = []): TargetTourSnapshot {
  return { status: TourStatus.PUBLISHED, deleted: false, sceneIds };
}

describe('Visite manuelle', () => {
  function visite(lienJardinRemparts: boolean): TourSnapshot {
    return snapshot(VISITE, PORTE, [
      scene(PORTE, [sceneLink('h-porte-jardin', JARDIN)]),
      scene(JARDIN, lienJardinRemparts ? [sceneLink('h-jardin-remparts', REMPARTS)] : []),
      scene(REMPARTS),
    ]);
  }

  it("signale seulement Remparts quand aucun lien n'y mène", () => {
    expect(validateTour(visite(false), none)).toEqual([
      issue(ValidationIssueCode.SCENE_UNREACHABLE, unreachable, REMPARTS),
    ]);
  });

  it("n'a aucun problème une fois que Jardin mène à Remparts", () => {
    expect(validateTour(visite(true), none)).toEqual([]);
  });
});

describe('scène de départ', () => {
  it('refuse une visite sans scène de départ', () => {
    const tour = snapshot(VISITE, null, [scene(PORTE)]);
    expect(validateTour(tour, none)).toEqual([
      issue(ValidationIssueCode.START_SCENE_MISSING, 'La scène de départ est absente.'),
    ]);
  });

  it("refuse une scène de départ qui n'appartient pas à la visite", () => {
    const tour = snapshot(VISITE, 'ailleurs', [scene(PORTE)]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.START_SCENE_FOREIGN,
        "La scène de départ n'appartient pas à cette visite.",
        'ailleurs',
      ),
    ]);
  });

  it('refuse une scène de départ supprimée sans déclarer les autres inatteignables', () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [], { deleted: true }),
      scene(JARDIN, [], { panoramaStatus: ProcessingStatus.PENDING }),
    ]);
    expect(validateTour(tour, none)).toEqual([
      issue(ValidationIssueCode.START_SCENE_MISSING, 'La scène de départ est absente.', PORTE),
      issue(
        ValidationIssueCode.PANORAMA_NOT_READY,
        "Le panorama de cette scène n'est pas prêt.",
        JARDIN,
      ),
    ]);
  });
});

describe('panorama et atteignabilité', () => {
  it("signale un panorama qui n'est pas prêt, puis la scène inatteignable", () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE),
      scene(JARDIN, [], { panoramaStatus: ProcessingStatus.ERROR }),
    ]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.PANORAMA_NOT_READY,
        "Le panorama de cette scène n'est pas prêt.",
        JARDIN,
      ),
      issue(ValidationIssueCode.SCENE_UNREACHABLE, unreachable, JARDIN),
    ]);
  });

  it('ignore une scène supprimée, même si son panorama et ses liens sont invalides', () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [sceneLink('h-porte', JARDIN)]),
      scene(JARDIN),
      scene('ancienne', [sceneLink('h-ancien', null)], {
        deleted: true,
        panoramaStatus: ProcessingStatus.PENDING,
      }),
    ]);
    expect(validateTour(tour, none)).toEqual([]);
  });

  it("ne suit pas un lien qui part d'une scène supprimée", () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE),
      scene('couloir', [sceneLink('h-couloir', JARDIN)], { deleted: true }),
      scene(JARDIN),
    ]);
    expect(validateTour(tour, none)).toEqual([
      issue(ValidationIssueCode.SCENE_UNREACHABLE, unreachable, JARDIN),
    ]);
  });

  it('ne remonte pas les liens à contre-sens', () => {
    const tour = snapshot(VISITE, REMPARTS, [
      scene(PORTE, [sceneLink('h-porte', JARDIN)]),
      scene(JARDIN, [sceneLink('h-jardin', REMPARTS)]),
      scene(REMPARTS),
    ]);
    expect(validateTour(tour, none)).toEqual([
      issue(ValidationIssueCode.SCENE_UNREACHABLE, unreachable, PORTE),
      issue(ValidationIssueCode.SCENE_UNREACHABLE, unreachable, JARDIN),
    ]);
  });

  it('accepte une scène atteinte par deux chemins', () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [sceneLink('h-jardin', JARDIN), sceneLink('h-remparts', REMPARTS)]),
      scene(JARDIN, [sceneLink('h-jardin-remparts', REMPARTS)]),
      scene(REMPARTS, [sceneLink('h-retour', PORTE)]),
    ]);
    expect(validateTour(tour, none)).toEqual([]);
  });
});

describe('SCENE_LINK', () => {
  it('refuse un lien sans scène cible, y compris null', () => {
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [sceneLink('h-vide', null)])]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.SCENE_LINK_TARGET_MISSING,
        "Le lien de scène n'a pas de scène cible.",
        PORTE,
        'h-vide',
      ),
    ]);
  });

  it('refuse un lien omis de la même façon', () => {
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [sceneLink('h-omis')])]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.SCENE_LINK_TARGET_MISSING,
        "Le lien de scène n'a pas de scène cible.",
        PORTE,
        'h-omis',
      ),
    ]);
  });

  it('refuse un lien vers la scène elle-même', () => {
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [sceneLink('h-self', PORTE)])]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.SCENE_LINK_SELF,
        'Le lien de scène pointe vers sa propre scène.',
        PORTE,
        'h-self',
      ),
    ]);
  });

  it('refuse une scène cible hors de la visite', () => {
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [sceneLink('h-foreign', 'ailleurs')])]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.SCENE_LINK_FOREIGN,
        "La scène cible n'appartient pas à cette visite.",
        PORTE,
        'h-foreign',
      ),
    ]);
  });

  it('refuse une scène cible supprimée', () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [sceneLink('h-deleted', JARDIN)]),
      scene(JARDIN, [], { deleted: true }),
    ]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.SCENE_LINK_TARGET_DELETED,
        'La scène cible a été supprimée.',
        PORTE,
        'h-deleted',
      ),
    ]);
  });
});

describe('TOUR_LINK', () => {
  it("refuse un lien sans visite cible et n'appelle pas la recherche", () => {
    const calls: string[] = [];
    const find: FindTargetTour = (id) => {
      calls.push(id);
      return undefined;
    };
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-manquant', null, 'scene-x')])]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_TARGET_MISSING,
        "Le lien de visite n'a pas de visite cible.",
        PORTE,
        'h-manquant',
      ),
    ]);
    expect(calls).toEqual([]);
  });

  it('refuse un lien vers la visite courante sans chercher la cible', () => {
    const calls: string[] = [];
    const find: FindTargetTour = (id) => {
      calls.push(id);
      return published([JARDIN]);
    };
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-self', VISITE, 'ailleurs')])]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_SELF,
        'Le lien de visite pointe vers la visite courante.',
        PORTE,
        'h-self',
      ),
    ]);
    expect(calls).toEqual([]);
  });

  it("refuse une visite cible inconnue, même si une scène d'arrivée est indiquée", () => {
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-inconnu', 'autre', JARDIN)])]);
    expect(validateTour(tour, none)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED,
        "La visite cible n'est pas publiée.",
        PORTE,
        'h-inconnu',
      ),
    ]);
  });

  it('refuse une visite cible encore en brouillon', () => {
    const find: FindTargetTour = () => ({
      status: TourStatus.DRAFT,
      deleted: false,
      sceneIds: [JARDIN],
    });
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-brouillon', 'autre')])]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED,
        "La visite cible n'est pas publiée.",
        PORTE,
        'h-brouillon',
      ),
    ]);
  });

  it('refuse une visite cible supprimée', () => {
    const find: FindTargetTour = () => ({
      status: TourStatus.PUBLISHED,
      deleted: true,
      sceneIds: [JARDIN],
    });
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-suppr', 'autre', JARDIN)])]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED,
        "La visite cible n'est pas publiée.",
        PORTE,
        'h-suppr',
      ),
    ]);
  });

  it("signale à la fois une visite non publiée et une scène d'arrivée étrangère", () => {
    const find: FindTargetTour = () => ({
      status: TourStatus.DRAFT,
      deleted: false,
      sceneIds: [JARDIN],
    });
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [tourLink('h-deux', 'autre', 'scene-etrangere')]),
    ]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED,
        "La visite cible n'est pas publiée.",
        PORTE,
        'h-deux',
      ),
      issue(
        ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN,
        "La scène d'arrivée n'appartient pas à la visite cible.",
        PORTE,
        'h-deux',
      ),
    ]);
  });

  it("accepte une visite publiée sans scène d'arrivée", () => {
    const find: FindTargetTour = (id) => (id === 'autre' ? published([JARDIN]) : undefined);
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-ok', 'autre')])]);
    expect(validateTour(tour, find)).toEqual([]);
  });

  it("accepte une scène d'arrivée qui appartient à la visite publiée", () => {
    const find: FindTargetTour = () => published([JARDIN]);
    const tour = snapshot(VISITE, PORTE, [scene(PORTE, [tourLink('h-scene', 'autre', JARDIN)])]);
    expect(validateTour(tour, find)).toEqual([]);
  });

  it("refuse une scène d'arrivée hors de la visite cible", () => {
    const find: FindTargetTour = () => published([JARDIN]);
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [tourLink('h-foreign', 'autre', 'ailleurs')]),
    ]);
    expect(validateTour(tour, find)).toEqual([
      issue(
        ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN,
        "La scène d'arrivée n'appartient pas à la visite cible.",
        PORTE,
        'h-foreign',
      ),
    ]);
  });

  it('ignore les hotspots INFO, MEDIA et URL', () => {
    const tour = snapshot(VISITE, PORTE, [
      scene(PORTE, [
        { id: 'h-info', type: HotspotType.INFO },
        { id: 'h-media', type: HotspotType.MEDIA },
        { id: 'h-url', type: HotspotType.URL },
      ]),
    ]);
    expect(validateTour(tour, none)).toEqual([]);
  });
});
