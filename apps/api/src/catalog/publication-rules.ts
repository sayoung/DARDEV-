import {
  HotspotType,
  ProcessingStatus,
  TourStatus,
  ValidationIssueCode,
  type ValidationIssue,
} from '@xplor/shared';

/** Scène telle que la voit la validation, sans Prisma. */
export type TourSceneSnapshot = {
  id: string;
  deleted: boolean;
  panoramaStatus: ProcessingStatus;
  hotspots: readonly TourHotspotSnapshot[];
};

/** Hotspot réduit aux champs qui comptent pour le graphe (F-03). */
export type TourHotspotSnapshot = {
  id: string;
  type: HotspotType;
  targetSceneId?: string | null;
  targetTourId?: string | null;
  targetTourSceneId?: string | null;
};

/** Visite à publier. `startSceneId` null : pas de scène de départ. */
export type TourSnapshot = {
  id: string;
  startSceneId: string | null;
  scenes: readonly TourSceneSnapshot[];
};

/** Visite cible déjà chargée. `sceneIds` : scènes vivantes de cette visite. */
export type TargetTourSnapshot = {
  status: TourStatus;
  deleted: boolean;
  sceneIds: readonly string[];
};

/** Recherche des visites cibles. `undefined` si l'identifiant est inconnu. */
export type FindTargetTour = (tourId: string) => TargetTourSnapshot | undefined;

type GraphNode = {
  id: string;
  deleted: boolean;
  panoramaStatus: ProcessingStatus;
  hotspots: readonly TourHotspotSnapshot[];
  next: GraphNode[];
};

const MESSAGES: Record<ValidationIssueCode, string> = {
  [ValidationIssueCode.START_SCENE_MISSING]: 'La scène de départ est absente.',
  [ValidationIssueCode.START_SCENE_FOREIGN]: "La scène de départ n'appartient pas à cette visite.",
  [ValidationIssueCode.PANORAMA_NOT_READY]: "Le panorama de cette scène n'est pas prêt.",
  [ValidationIssueCode.SCENE_UNREACHABLE]:
    'Cette scène est inatteignable depuis la scène de départ.',
  [ValidationIssueCode.SCENE_LINK_TARGET_MISSING]: "Le lien de scène n'a pas de scène cible.",
  [ValidationIssueCode.SCENE_LINK_SELF]: 'Le lien de scène pointe vers sa propre scène.',
  [ValidationIssueCode.SCENE_LINK_FOREIGN]: "La scène cible n'appartient pas à cette visite.",
  [ValidationIssueCode.SCENE_LINK_TARGET_DELETED]: 'La scène cible a été supprimée.',
  [ValidationIssueCode.TOUR_LINK_TARGET_MISSING]: "Le lien de visite n'a pas de visite cible.",
  [ValidationIssueCode.TOUR_LINK_SELF]: 'Le lien de visite pointe vers la visite courante.',
  [ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED]: "La visite cible n'est pas publiée.",
  [ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN]:
    "La scène d'arrivée n'appartient pas à la visite cible.",
};

/**
 * Règles de publication (cahier 5.4, F-03).
 * Fonction pure : l'appelant fournit l'instantané et la recherche des visites cibles.
 */
export function validateTour(
  tour: TourSnapshot,
  findTargetTour: FindTargetTour,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = indexScenes(tour.scenes);
  const start = resolveStart(tour.startSceneId, nodes, issues);

  for (const node of nodes.values()) {
    if (node.deleted) {
      continue;
    }
    if (node.panoramaStatus !== ProcessingStatus.READY) {
      issues.push(problem(ValidationIssueCode.PANORAMA_NOT_READY, node.id));
    }
    for (const hotspot of node.hotspots) {
      const target = linkTarget(tour.id, node, hotspot, nodes, findTargetTour, issues);
      if (target !== undefined) {
        node.next.push(target);
      }
    }
  }

  if (start !== undefined) {
    const reachable = reachableIds(start);
    for (const node of nodes.values()) {
      if (!node.deleted && !reachable.has(node.id)) {
        issues.push(problem(ValidationIssueCode.SCENE_UNREACHABLE, node.id));
      }
    }
  }

  return issues;
}

function indexScenes(scenes: readonly TourSceneSnapshot[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  for (const scene of scenes) {
    nodes.set(scene.id, {
      id: scene.id,
      deleted: scene.deleted,
      panoramaStatus: scene.panoramaStatus,
      hotspots: scene.hotspots,
      next: [],
    });
  }
  return nodes;
}

function resolveStart(
  startSceneId: string | null,
  nodes: ReadonlyMap<string, GraphNode>,
  issues: ValidationIssue[],
): GraphNode | undefined {
  if (startSceneId === null) {
    issues.push(problem(ValidationIssueCode.START_SCENE_MISSING));
    return undefined;
  }
  const start = nodes.get(startSceneId);
  if (start === undefined) {
    issues.push(problem(ValidationIssueCode.START_SCENE_FOREIGN, startSceneId));
    return undefined;
  }
  if (start.deleted) {
    issues.push(problem(ValidationIssueCode.START_SCENE_MISSING, start.id));
    return undefined;
  }
  return start;
}

function linkTarget(
  tourId: string,
  node: GraphNode,
  hotspot: TourHotspotSnapshot,
  nodes: ReadonlyMap<string, GraphNode>,
  findTargetTour: FindTargetTour,
  issues: ValidationIssue[],
): GraphNode | undefined {
  if (hotspot.type === HotspotType.SCENE_LINK) {
    return sceneLink(node, hotspot, nodes, issues);
  }
  if (hotspot.type === HotspotType.TOUR_LINK) {
    tourLink(tourId, node, hotspot, findTargetTour, issues);
  }
  return undefined;
}

function sceneLink(
  node: GraphNode,
  hotspot: TourHotspotSnapshot,
  nodes: ReadonlyMap<string, GraphNode>,
  issues: ValidationIssue[],
): GraphNode | undefined {
  if (missingId(hotspot.targetSceneId)) {
    issues.push(problem(ValidationIssueCode.SCENE_LINK_TARGET_MISSING, node.id, hotspot.id));
    return undefined;
  }
  if (hotspot.targetSceneId === node.id) {
    issues.push(problem(ValidationIssueCode.SCENE_LINK_SELF, node.id, hotspot.id));
    return undefined;
  }
  const target = nodes.get(hotspot.targetSceneId);
  if (target === undefined) {
    issues.push(problem(ValidationIssueCode.SCENE_LINK_FOREIGN, node.id, hotspot.id));
    return undefined;
  }
  if (target.deleted) {
    issues.push(problem(ValidationIssueCode.SCENE_LINK_TARGET_DELETED, node.id, hotspot.id));
    return undefined;
  }
  return target;
}

function tourLink(
  tourId: string,
  node: GraphNode,
  hotspot: TourHotspotSnapshot,
  findTargetTour: FindTargetTour,
  issues: ValidationIssue[],
): void {
  if (missingId(hotspot.targetTourId)) {
    issues.push(problem(ValidationIssueCode.TOUR_LINK_TARGET_MISSING, node.id, hotspot.id));
    return;
  }
  if (hotspot.targetTourId === tourId) {
    issues.push(problem(ValidationIssueCode.TOUR_LINK_SELF, node.id, hotspot.id));
    return;
  }
  const target = findTargetTour(hotspot.targetTourId);
  if (target === undefined || target.deleted || target.status !== TourStatus.PUBLISHED) {
    issues.push(problem(ValidationIssueCode.TOUR_LINK_TARGET_UNPUBLISHED, node.id, hotspot.id));
  }
  if (
    target !== undefined &&
    !missingId(hotspot.targetTourSceneId) &&
    !target.sceneIds.includes(hotspot.targetTourSceneId)
  ) {
    issues.push(problem(ValidationIssueCode.TOUR_LINK_SCENE_FOREIGN, node.id, hotspot.id));
  }
}

/** Parcours en largeur. Un nœud déjà vu (second chemin ou cycle) est ignoré. */
function reachableIds(start: GraphNode): Set<string> {
  const reachable = new Set<string>();
  const queue: GraphNode[] = [start];
  let current = queue.shift();
  while (current !== undefined) {
    if (!reachable.has(current.id)) {
      reachable.add(current.id);
      for (const next of current.next) {
        queue.push(next);
      }
    }
    current = queue.shift();
  }
  return reachable;
}

function missingId(value: string | null | undefined): value is null | undefined {
  return value === undefined || value === null;
}

function problem(code: ValidationIssueCode, sceneId?: string, hotspotId?: string): ValidationIssue {
  return {
    code,
    message: MESSAGES[code],
    ...(sceneId === undefined ? {} : { sceneId }),
    ...(hotspotId === undefined ? {} : { hotspotId }),
  };
}
