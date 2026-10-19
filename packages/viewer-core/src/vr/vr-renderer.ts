import * as THREE from 'three';
import { vectorToSpherical, type SphericalPosition } from './vr-geometry.js';

/**
 * Handle de contrôle du renderer et de la caméra VR Three.js (M6 F-70).
 */
export interface VrRendererHandle {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  render(scene: THREE.Scene): void;
  getGazeDir(): SphericalPosition;
  dispose(): void;
}

/**
 * Crée le renderer Three.js dédié et la caméra pour le mode immersif VR (M6 F-70).
 *
 * Initialise :
 * - WebGLRenderer({ antialias: true }) avec xr.enabled = false par défaut.
 * - PerspectiveCamera(75, ratio, 0.1, 100) où ratio est calculé à partir de canvasParent.
 * - Le canvas domElement est ajouté à canvasParent.
 * - getGazeDir() calcule la direction monde de la caméra via camera.getWorldDirection() et vectorToSpherical().
 * - dispose() retire le canvas du DOM et libère les ressources du renderer Three.js.
 *
 * @param canvasParent Conteneur hôte dans lequel le canvas WebGL est inséré.
 * @returns Le handle VrRendererHandle.
 */
export function createVrRenderer(canvasParent: HTMLElement): VrRendererHandle {
  const width = canvasParent.clientWidth;
  const height = canvasParent.clientHeight;
  const ratio = height > 0 ? width / height : 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.xr.enabled = false;

  const camera = new THREE.PerspectiveCamera(75, ratio, 0.1, 100);

  if (width > 0 && height > 0) {
    renderer.setSize(width, height);
  }

  canvasParent.appendChild(renderer.domElement);

  const gazeVector = new THREE.Vector3();

  function render(scene: THREE.Scene): void {
    renderer.render(scene, camera);
  }

  function getGazeDir(): SphericalPosition {
    camera.getWorldDirection(gazeVector);
    return vectorToSpherical(gazeVector);
  }

  function dispose(): void {
    const canvas = renderer.domElement;
    if (canvas.parentNode !== null) {
      canvas.parentNode.removeChild(canvas);
    }
    renderer.dispose();
  }

  return {
    renderer,
    camera,
    render,
    getGazeDir,
    dispose,
  };
}
