import { z } from '@xplor/shared';
import type {
  VirtualTourPluginConfig,
  VirtualTourLink,
  VirtualTourNode,
  VirtualTourTransitionOptions,
} from '@photo-sphere-viewer/virtual-tour-plugin';
import type { TourGraph } from '@xplor/shared';
import { toTourNodes, type TourLinkDir } from './tour-nodes.js';
import { computeSceneOrientation } from './orientation.js';

export const TRANSITION_MS = 800;
export const ARROW_SIZE = 56;

export const CIRCULAR_ARROW_NEXT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="100%" height="100%" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="#1E9E4A" stroke="#ffffff" stroke-width="2"/><path fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M19 29 L28 19 L37 29 M28 19 L28 37"/></svg>`;

export const CIRCULAR_ARROW_PREV_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="100%" height="100%" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="#D64545" stroke="#ffffff" stroke-width="2"/><path fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M19 27 L28 37 L37 27 M28 19 L28 37"/></svg>`;

export const CIRCULAR_ARROW_OTHER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="100%" height="100%" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="#6958A5" stroke="#ffffff" stroke-width="2"/><path fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M19 29 L28 19 L37 29 M28 19 L28 37"/></svg>`;

export const CIRCULAR_ARROW_SVG = CIRCULAR_ARROW_OTHER_SVG;

export const CIRCULAR_ARROW_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(CIRCULAR_ARROW_SVG)}`;

export const CIRCULAR_ARROW_SVGS: Record<TourLinkDir, string> = {
  next: CIRCULAR_ARROW_NEXT_SVG,
  prev: CIRCULAR_ARROW_PREV_SVG,
  other: CIRCULAR_ARROW_OTHER_SVG,
};

export const TourLinkDirSchema = z.enum(['next', 'prev', 'other']);

const LinkDataSchema = z.looseObject({
  label: z.string().optional(),
  dir: z.unknown().optional(),
});

export function extractHotspotLabel(link?: VirtualTourLink | null): string {
  const parsed = LinkDataSchema.safeParse(link?.data);
  if (parsed.success && typeof parsed.data.label === 'string') {
    return parsed.data.label;
  }
  return '';
}

export function extractHotspotDir(link?: VirtualTourLink | null): TourLinkDir {
  const parsed = LinkDataSchema.safeParse(link?.data);
  if (parsed.success) {
    const dirParsed = TourLinkDirSchema.safeParse(parsed.data.dir);
    if (dirParsed.success) {
      return dirParsed.data;
    }
  }
  return 'other';
}

export function getCircularArrowSvg(dir?: TourLinkDir | null): string {
  if (dir === 'next') {
    return CIRCULAR_ARROW_NEXT_SVG;
  }
  if (dir === 'prev') {
    return CIRCULAR_ARROW_PREV_SVG;
  }
  return CIRCULAR_ARROW_OTHER_SVG;
}

export function getLinkTooltip(content: string, link: VirtualTourLink): string {
  const label = extractHotspotLabel(link);
  if (label.trim().length > 0) {
    return label;
  }
  return content;
}

export function createArrowElement(link?: VirtualTourLink | null): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('document is not defined');
  }
  const dir = extractHotspotDir(link);
  // Flèches de scène : positionnement physique dans la sphère 3D géré par Photo Sphere Viewer
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `psv-virtual-tour-arrow xplor-tour-arrow xplor-tour-arrow--${dir}`;
  const label = extractHotspotLabel(link);
  if (label.length > 0) {
    button.title = label;
    button.setAttribute('aria-label', label);
  }
  button.innerHTML = getCircularArrowSvg(dir);
  return button;
}

export function tourPluginOptions(graph: TourGraph, sceneId?: string | null): VirtualTourPluginConfig {
  const nodes = toTourNodes(graph);
  
  let startNodeId = graph.startSceneId;
  if (sceneId && graph.scenes.some((s) => s.id === sceneId)) {
    startNodeId = sceneId;
  }

  return {
    nodes,
    positionMode: 'manual',
    renderMode: '2d',
    startNodeId,
    preload: true,
    transitionOptions: (
      toNode: VirtualTourNode,
      _fromNode?: VirtualTourNode,
      fromLink?: VirtualTourLink
    ): VirtualTourTransitionOptions => {
      const scene = graph.scenes.find((s) => s.id === toNode.id);
      if (!scene) {
        return {
          effect: 'fade',
          speed: TRANSITION_MS,
          rotation: false,
        };
      }
      const { yaw, pitch, zoom } = computeSceneOrientation(scene, fromLink);
      return {
        effect: 'fade',
        speed: TRANSITION_MS,
        rotation: false,
        rotateTo: { yaw, pitch },
        ...(zoom != null ? { zoomTo: zoom } : {}),
      };
    },
    arrowStyle: {
      size: { width: ARROW_SIZE, height: ARROW_SIZE },
      element: createArrowElement,
      style: {
        cursor: 'pointer',
        filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))',
      },
    },
    getLinkTooltip,
  };
}
