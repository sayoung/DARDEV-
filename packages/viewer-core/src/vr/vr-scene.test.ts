import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { createVrScene, type VrMarkerTarget } from './vr-scene.js';
import * as viewerCoreExports from '../index.js';
import { sphericalToVector } from './vr-geometry.js';

describe('vr-scene (M6 F-70)', () => {
  it('est exporté depuis index.ts', () => {
    expect(viewerCoreExports.createVrScene).toBe(createVrScene);
  });

  describe('sphère VR initiale (1)', () => {
    it('crée une THREE.Scene contenant un mesh unique nommé xplor-vr-sphere', () => {
      const handle = createVrScene();

      expect(handle.scene).toBeInstanceOf(THREE.Scene);
      expect(handle.sphere).toBeInstanceOf(THREE.Mesh);
      expect(handle.sphere.name).toBe('xplor-vr-sphere');

      expect(handle.scene.children.length).toBe(1);
      expect(handle.scene.children.includes(handle.sphere)).toBe(true);
      expect(handle.scene.getObjectByName('xplor-vr-sphere')).toBe(handle.sphere);
    });

    it('utilise une SphereGeometry de rayon 10', () => {
      const handle = createVrScene();

      expect(handle.sphere.geometry).toBeInstanceOf(THREE.SphereGeometry);
      if (handle.sphere.geometry instanceof THREE.SphereGeometry) {
        expect(handle.sphere.geometry.parameters.radius).toBe(10);
      }
    });

    it('utilise un MeshBasicMaterial avec material.side === THREE.BackSide', () => {
      const handle = createVrScene();

      expect(handle.sphere.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      if (handle.sphere.material instanceof THREE.MeshBasicMaterial) {
        expect(handle.sphere.material.side).toBe(THREE.BackSide);
      }
    });

    it('maintient sphere.scale.x === 1 sans double inversion d échelle', () => {
      const handle = createVrScene();

      expect(handle.sphere.scale.x).toBe(1);
      expect(handle.sphere.scale.y).toBe(1);
      expect(handle.sphere.scale.z).toBe(1);
    });
  });

  describe('positionnement des marqueurs et getMarkerTargets (2)', () => {
    it('place chaque marqueur à la position de sphericalToVector(yaw, pitch, 8) avec toBeCloseTo', () => {
      const handle = createVrScene();
      const markers: readonly VrMarkerTarget[] = [
        { id: 'target-nord', yaw: 0, pitch: 0 },
        { id: 'target-est', yaw: Math.PI / 2, pitch: 0.25 },
        { id: 'target-ouest', yaw: -Math.PI / 2, pitch: -0.35 },
        { id: 'target-sud', yaw: Math.PI, pitch: 0.1 },
      ];

      handle.setMarkers(markers);

      for (const marker of markers) {
        const markerObject = handle.scene.getObjectByName(marker.id);
        expect(markerObject).toBeInstanceOf(THREE.Mesh);

        if (markerObject instanceof THREE.Mesh) {
          const expected = sphericalToVector(marker.yaw, marker.pitch, 8);
          expect(markerObject.position.x).toBeCloseTo(expected.x, 5);
          expect(markerObject.position.y).toBeCloseTo(expected.y, 5);
          expect(markerObject.position.z).toBeCloseTo(expected.z, 5);

          const userData = markerObject.userData;
          expect(userData['id']).toBe(marker.id);
          expect(userData['yaw']).toBe(marker.yaw);
          expect(userData['pitch']).toBe(marker.pitch);

          expect(markerObject.geometry).toBeInstanceOf(THREE.RingGeometry);
          expect(markerObject.material).toBeInstanceOf(THREE.MeshBasicMaterial);
          if (markerObject.material instanceof THREE.MeshBasicMaterial) {
            expect(markerObject.material.side).toBe(THREE.DoubleSide);
          }
        }
      }
    });

    it('retourne les id/yaw/pitch via getMarkerTargets', () => {
      const handle = createVrScene();
      const markers: readonly VrMarkerTarget[] = [
        { id: 'm-1', yaw: 0.5, pitch: -0.2 },
        { id: 'm-2', yaw: -1.4, pitch: 0.8 },
      ];

      handle.setMarkers(markers);
      const retrieved = handle.getMarkerTargets();

      expect(retrieved).toEqual([
        { id: 'm-1', yaw: 0.5, pitch: -0.2 },
        { id: 'm-2', yaw: -1.4, pitch: 0.8 },
      ]);
    });

    it('fournit une copie défensive dans getMarkerTargets', () => {
      const handle = createVrScene();
      const markers: readonly VrMarkerTarget[] = [
        { id: 'm-defensive', yaw: 0.1, pitch: 0.2 },
      ];

      handle.setMarkers(markers);
      const retrieved = handle.getMarkerTargets();
      const first = retrieved.at(0);
      if (first !== undefined) {
        first.id = 'mutated';
        first.yaw = 999;
      }

      const freshRetrieval = handle.getMarkerTargets();
      const freshFirst = freshRetrieval.at(0);
      if (freshFirst !== undefined) {
        expect(freshFirst.id).toBe('m-defensive');
        expect(freshFirst.yaw).toBe(0.1);
      }
    });

    it('getMarkerTargets retourne un tableau vide par défaut', () => {
      const handle = createVrScene();
      expect(handle.getMarkerTargets()).toEqual([]);
    });
  });

  describe('remplacement des marqueurs (3)', () => {
    it('remplace les premiers marqueurs et ajuste le nombre d enfants à sphère + nouveaux', () => {
      const handle = createVrScene();
      const firstMarkers: readonly VrMarkerTarget[] = [
        { id: 'initial-1', yaw: 0.1, pitch: 0.2 },
        { id: 'initial-2', yaw: 0.5, pitch: -0.3 },
      ];

      handle.setMarkers(firstMarkers);
      expect(handle.scene.children.length).toBe(3); // 1 sphère + 2 marqueurs

      const oldMesh1 = handle.scene.getObjectByName('initial-1');
      const oldMesh2 = handle.scene.getObjectByName('initial-2');
      expect(oldMesh1).toBeInstanceOf(THREE.Mesh);
      expect(oldMesh2).toBeInstanceOf(THREE.Mesh);

      if (oldMesh1 instanceof THREE.Mesh && oldMesh2 instanceof THREE.Mesh) {
        const geomDispose1 = vi.spyOn(oldMesh1.geometry, 'dispose');
        const geomDispose2 = vi.spyOn(oldMesh2.geometry, 'dispose');

        const matSpies1 = Array.isArray(oldMesh1.material)
          ? oldMesh1.material.map((mat) => vi.spyOn(mat, 'dispose'))
          : [vi.spyOn(oldMesh1.material, 'dispose')];
        const matSpies2 = Array.isArray(oldMesh2.material)
          ? oldMesh2.material.map((mat) => vi.spyOn(mat, 'dispose'))
          : [vi.spyOn(oldMesh2.material, 'dispose')];

        const nextMarkers: readonly VrMarkerTarget[] = [
          { id: 'replacement-1', yaw: 1.2, pitch: 0.4 },
          { id: 'replacement-2', yaw: -0.8, pitch: -0.1 },
          { id: 'replacement-3', yaw: 2.1, pitch: 0.0 },
        ];

        handle.setMarkers(nextMarkers);

        // Nombre d enfants de la scène = sphère + nouveaux marqueurs
        expect(handle.scene.children.length).toBe(1 + nextMarkers.length);
        expect(handle.scene.children.length).toBe(4);

        // Anciens marqueurs retirés
        expect(handle.scene.getObjectByName('initial-1')).toBeUndefined();
        expect(handle.scene.getObjectByName('initial-2')).toBeUndefined();
        expect(handle.scene.children.includes(oldMesh1)).toBe(false);
        expect(handle.scene.children.includes(oldMesh2)).toBe(false);

        // Nouveaux marqueurs présents
        for (const marker of nextMarkers) {
          expect(handle.scene.getObjectByName(marker.id)).toBeInstanceOf(THREE.Mesh);
        }

        // Appels de dispose sur les anciennes géométries et matériaux
        expect(geomDispose1).toHaveBeenCalledTimes(1);
        expect(geomDispose2).toHaveBeenCalledTimes(1);
        for (const spy of matSpies1) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
        for (const spy of matSpies2) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
      }
    });

    it('vide les marqueurs et conserve uniquement la sphère lors d un appel avec tableau vide', () => {
      const handle = createVrScene();
      handle.setMarkers([{ id: 'to-empty', yaw: 0, pitch: 0 }]);
      expect(handle.scene.children.length).toBe(2);

      handle.setMarkers([]);
      expect(handle.scene.children.length).toBe(1);
      expect(handle.scene.children.includes(handle.sphere)).toBe(true);
      expect(handle.getMarkerTargets()).toEqual([]);
    });
  });

  describe('setTexture (4)', () => {
    it('affecte material.map lors de l appel avec une instance de THREE.Texture', () => {
      const handle = createVrScene();
      const texture = new THREE.Texture();

      expect(handle.sphere.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      if (handle.sphere.material instanceof THREE.MeshBasicMaterial) {
        expect(handle.sphere.material.map).toBeNull();

        handle.setTexture(texture);
        expect(handle.sphere.material.map).toBe(texture);
      }
    });

    it('fonctionne avec null et réinitialise material.map', () => {
      const handle = createVrScene();
      const texture = new THREE.Texture();

      handle.setTexture(texture);
      if (handle.sphere.material instanceof THREE.MeshBasicMaterial) {
        expect(handle.sphere.material.map).toBe(texture);

        handle.setTexture(null);
        expect(handle.sphere.material.map).toBeNull();
      }
    });
  });

  describe('dispose (5)', () => {
    it('libère la géométrie et le matériau de la sphère ainsi que les marqueurs', () => {
      const handle = createVrScene();
      const texture = new THREE.Texture();
      handle.setTexture(texture);

      const markers: readonly VrMarkerTarget[] = [
        { id: 'disp-marker-1', yaw: 0.1, pitch: 0.2 },
        { id: 'disp-marker-2', yaw: -0.3, pitch: 0.4 },
      ];
      handle.setMarkers(markers);

      const markerMesh1 = handle.scene.getObjectByName('disp-marker-1');
      const markerMesh2 = handle.scene.getObjectByName('disp-marker-2');
      expect(markerMesh1).toBeInstanceOf(THREE.Mesh);
      expect(markerMesh2).toBeInstanceOf(THREE.Mesh);

      if (
        handle.sphere.geometry instanceof THREE.SphereGeometry &&
        handle.sphere.material instanceof THREE.MeshBasicMaterial &&
        markerMesh1 instanceof THREE.Mesh &&
        markerMesh2 instanceof THREE.Mesh
      ) {
        const sphereGeomSpy = vi.spyOn(handle.sphere.geometry, 'dispose');
        const sphereMatSpy = vi.spyOn(handle.sphere.material, 'dispose');
        const textureSpy = vi.spyOn(texture, 'dispose');

        const marker1GeomSpy = vi.spyOn(markerMesh1.geometry, 'dispose');
        const marker2GeomSpy = vi.spyOn(markerMesh2.geometry, 'dispose');
        const marker1MatSpies = Array.isArray(markerMesh1.material)
          ? markerMesh1.material.map((mat) => vi.spyOn(mat, 'dispose'))
          : [vi.spyOn(markerMesh1.material, 'dispose')];
        const marker2MatSpies = Array.isArray(markerMesh2.material)
          ? markerMesh2.material.map((mat) => vi.spyOn(mat, 'dispose'))
          : [vi.spyOn(markerMesh2.material, 'dispose')];

        handle.dispose();

        expect(sphereGeomSpy).toHaveBeenCalledTimes(1);
        expect(sphereMatSpy).toHaveBeenCalledTimes(1);
        expect(textureSpy).toHaveBeenCalledTimes(1);
        expect(marker1GeomSpy).toHaveBeenCalledTimes(1);
        expect(marker2GeomSpy).toHaveBeenCalledTimes(1);
        for (const spy of marker1MatSpies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
        for (const spy of marker2MatSpies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }

        expect(handle.scene.children.length).toBe(0);
        expect(handle.scene.getObjectByName('xplor-vr-sphere')).toBeUndefined();
        expect(handle.getMarkerTargets()).toEqual([]);

        // Un second appel est sans effet
        handle.dispose();

        expect(sphereGeomSpy).toHaveBeenCalledTimes(1);
        expect(sphereMatSpy).toHaveBeenCalledTimes(1);
        expect(textureSpy).toHaveBeenCalledTimes(1);
        expect(marker1GeomSpy).toHaveBeenCalledTimes(1);
        expect(marker2GeomSpy).toHaveBeenCalledTimes(1);
        for (const spy of marker1MatSpies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
        for (const spy of marker2MatSpies) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
      }
    });

    it('fonctionne lorsque aucune texture n a été affectée', () => {
      const handle = createVrScene();
      expect(() => {
        handle.dispose();
      }).not.toThrow();

      expect(handle.scene.children.length).toBe(0);

      // Deuxième appel sans effet et sans erreur
      expect(() => {
        handle.dispose();
      }).not.toThrow();
    });
  });
});
