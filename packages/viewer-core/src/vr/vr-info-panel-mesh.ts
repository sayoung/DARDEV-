import * as THREE from 'three';
import {
  drawInfoPanel,
  InfoPanelCanvasContext,
  DrawInfoPanelOptions,
} from './vr-info-panel-canvas.js';

/**
 * Largeur par défaut du panneau d'information en mètres (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_WIDTH_M = 1.6;

/**
 * Hauteur par défaut du panneau d'information en mètres (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_HEIGHT_M = 0.8;

/**
 * Distance par défaut du panneau d'information par rapport à la caméra en mètres (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_DISTANCE_M = 2.0;

/**
 * Résolution horizontale par défaut du canvas en pixels (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_CANVAS_WIDTH = 1024;

/**
 * Résolution verticale par défaut du canvas en pixels (M6 F-71).
 */
export const DEFAULT_INFO_PANEL_CANVAS_HEIGHT = 512;

/**
 * Sous-ensemble minimal du canvas requis pour le panneau VR.
 */
export interface InfoPanelCanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): InfoPanelCanvasContext | null;
}

/**
 * Options de configuration du panneau d'information 3D VR (M6 F-71).
 */
export interface CreateInfoPanelOptions {
  widthM?: number;
  heightM?: number;
  distanceM?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  rtl?: boolean;
  padding?: number;
  lineHeight?: number;
  font?: string;
  backgroundColor?: string;
  textColor?: string;
  createCanvas?: (width: number, height: number) => InfoPanelCanvasLike;
}

/**
 * Handle de contrôle du panneau d'information 3D VR (M6 F-71).
 */
export interface InfoPanelHandle {
  mesh: THREE.Mesh;
  show(lines: string[], rtl?: boolean): void;
  hide(): void;
  dispose(): void;
}

/**
 * Fabrique de canvas par défaut dans le navigateur.
 */
function defaultCreateCanvas(width: number, height: number): InfoPanelCanvasLike {
  if (typeof document === 'undefined') {
    throw new Error(
      'document is not defined in this environment. Please provide a custom createCanvas factory in Node.js.',
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Crée le panneau d'information 3D pour l'espace VR (M6 F-71).
 *
 * Le panneau est composé d'un mesh Three.js (PlaneGeometry, MeshBasicMaterial transparent,
 * CanvasTexture) invisible par défaut. La méthode show() permet de dessiner le texte formaté
 * via drawInfoPanel sur le canvas 2D, puis rend le mesh visible.
 *
 * @param opts Dimensions, distance et fabrique injectable de canvas.
 * @returns Le handle de gestion du panneau { mesh, show, hide, dispose }.
 */
export function createInfoPanel(opts: CreateInfoPanelOptions = {}): InfoPanelHandle {
  const widthM =
    typeof opts.widthM === 'number' && Number.isFinite(opts.widthM) && opts.widthM > 0
      ? opts.widthM
      : DEFAULT_INFO_PANEL_WIDTH_M;

  const heightM =
    typeof opts.heightM === 'number' && Number.isFinite(opts.heightM) && opts.heightM > 0
      ? opts.heightM
      : DEFAULT_INFO_PANEL_HEIGHT_M;

  const distanceM =
    typeof opts.distanceM === 'number' && Number.isFinite(opts.distanceM) && opts.distanceM > 0
      ? opts.distanceM
      : DEFAULT_INFO_PANEL_DISTANCE_M;

  const canvasWidth =
    typeof opts.canvasWidth === 'number' &&
    Number.isFinite(opts.canvasWidth) &&
    opts.canvasWidth > 0
      ? opts.canvasWidth
      : DEFAULT_INFO_PANEL_CANVAS_WIDTH;

  const canvasHeight =
    typeof opts.canvasHeight === 'number' &&
    Number.isFinite(opts.canvasHeight) &&
    opts.canvasHeight > 0
      ? opts.canvasHeight
      : DEFAULT_INFO_PANEL_CANVAS_HEIGHT;

  const canvasFactory = opts.createCanvas ?? defaultCreateCanvas;
  const canvas = canvasFactory(canvasWidth, canvasHeight);

  const effectiveCanvasWidth = canvas.width > 0 ? canvas.width : canvasWidth;
  const effectiveCanvasHeight = canvas.height > 0 ? canvas.height : canvasHeight;

  const geometry = new THREE.PlaneGeometry(widthM, heightM);
  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'xplor-vr-info-panel';
  mesh.visible = false;
  mesh.position.set(0, 0, -distanceM);
  mesh.userData = {
    type: 'info-panel',
    widthM,
    heightM,
    distanceM,
  };

  let isDisposed = false;

  function show(lines: string[], rtl?: boolean): void {
    if (isDisposed) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx !== null) {
      const isRtl = rtl !== undefined ? rtl : opts.rtl;
      const drawOpts: DrawInfoPanelOptions = {
        width: effectiveCanvasWidth,
        height: effectiveCanvasHeight,
        rtl: isRtl,
        padding: opts.padding,
        lineHeight: opts.lineHeight,
        font: opts.font,
        backgroundColor: opts.backgroundColor,
        textColor: opts.textColor,
      };

      drawInfoPanel(ctx, lines, drawOpts);
    }

    texture.needsUpdate = true;
    mesh.visible = true;
  }

  function hide(): void {
    if (isDisposed) {
      return;
    }
    mesh.visible = false;
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;

    mesh.visible = false;
    if (mesh.parent !== null) {
      mesh.parent.remove(mesh);
    }

    geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  return {
    mesh,
    show,
    hide,
    dispose,
  };
}
