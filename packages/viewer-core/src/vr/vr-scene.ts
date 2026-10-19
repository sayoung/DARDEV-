import * as THREE from 'three';
import { sphericalToVector } from './vr-geometry.js';

/**
 * Cible d'un marqueur en coordonnées sphériques (radians).
 */
export interface VrMarkerTarget {
  id: string;
  yaw: number;
  pitch: number;
}

/**
 * Contrat de contrôle de la scène VR Three.js.
 */
export interface VrSceneHandle {
  scene: THREE.Scene;
  sphere: THREE.Mesh;
  setTexture(tex: THREE.Texture | null): void;
  setMarkers(markers: readonly VrMarkerTarget[]): void;
  getMarkerTargets(): VrMarkerTarget[];
  setYaw(yaw: number): void;
  dispose(): void;
}

/**
 * Construit sans WebGL ni DOM la scène Three.js pour le mode immersif VR.
 *
 * Contient :
 * - Une THREE.Scene isolée.
 * - Une sphère équirectangulaire de rayon 10 nommée 'xplor-vr-sphere',
 *   avec une seule inversion de surface via MeshBasicMaterial (side: THREE.BackSide).
 * - Une gestion dynamique de marqueurs (RingGeometry de rayon extérieur 0.35) positionnés
 *   à une distance de 8 unités avec sphericalToVector(yaw, pitch, 8) et orientés vers l'origine.
 * - Les fonctions setTexture, setMarkers, getMarkerTargets et dispose pour le cycle de vie.
 *
 * @returns Le handle de la scène VR.
 */
export function createVrScene(): VrSceneHandle {
  const scene = new THREE.Scene();

  const sphereGeometry = new THREE.SphereGeometry(10, 60, 40);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
  });

  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.name = 'xplor-vr-sphere';
  scene.add(sphere);

  let currentMarkerMeshes: THREE.Mesh[] = [];
  let currentTargets: VrMarkerTarget[] = [];
  let currentYaw = 0;
  let isDisposed = false;

  function clearCurrentMarkers(): void {
    for (const markerMesh of currentMarkerMeshes) {
      scene.remove(markerMesh);
      markerMesh.geometry.dispose();
      if (Array.isArray(markerMesh.material)) {
        for (const mat of markerMesh.material) {
          mat.dispose();
        }
      } else {
        markerMesh.material.dispose();
      }
    }
    currentMarkerMeshes = [];
    currentTargets = [];
  }

  function setTexture(tex: THREE.Texture | null): void {
    sphereMaterial.map = tex;
    sphereMaterial.needsUpdate = true;
  }

  function setMarkers(markers: readonly VrMarkerTarget[]): void {
    clearCurrentMarkers();

    for (const marker of markers) {
      currentTargets.push({
        id: marker.id,
        yaw: marker.yaw,
        pitch: marker.pitch,
      });

      const markerGeometry = new THREE.RingGeometry(0.2, 0.35, 32);
      const markerMaterial = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
      });

      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
      markerMesh.name = marker.id;
      markerMesh.userData = {
        id: marker.id,
        yaw: marker.yaw,
        pitch: marker.pitch,
      };

      const pos = sphericalToVector(marker.yaw, marker.pitch, 8);
      markerMesh.position.set(pos.x, pos.y, pos.z);
      markerMesh.lookAt(0, 0, 0);

      scene.add(markerMesh);
      currentMarkerMeshes.push(markerMesh);
    }
  }

  function getMarkerTargets(): VrMarkerTarget[] {
    return currentTargets.map((target) => {
      if (currentYaw === 0) {
        return {
          id: target.id,
          yaw: target.yaw,
          pitch: target.pitch,
        };
      }
      const diff = target.yaw - currentYaw;
      const normalizedYaw = Math.atan2(Math.sin(diff), Math.cos(diff));
      return {
        id: target.id,
        yaw: normalizedYaw,
        pitch: target.pitch,
      };
    });
  }

  function setYaw(yaw: number): void {
    currentYaw = yaw;
    scene.rotation.y = yaw;
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;

    currentYaw = 0;
    scene.rotation.y = 0;
    clearCurrentMarkers();
    scene.remove(sphere);
    sphereGeometry.dispose();
    if (sphereMaterial.map !== null) {
      sphereMaterial.map.dispose();
      sphereMaterial.map = null;
    }
    sphereMaterial.dispose();
    scene.clear();
  }

  return {
    scene,
    sphere,
    setTexture,
    setMarkers,
    getMarkerTargets,
    setYaw,
    dispose,
  };
}
