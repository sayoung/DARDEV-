import { describe, it, expect } from 'vitest';
import {
  sphericalToVector,
  angularDistance,
  pickHotspot,
  type SphericalPosition,
  type HotspotTarget,
} from './vr-geometry.js';
import {
  sphericalToVector as sphericalToVectorFromIndex,
  angularDistance as angularDistanceFromIndex,
  pickHotspot as pickHotspotFromIndex,
} from '../index.js';

describe('vr-geometry (M6 F-71)', () => {
  it('est exporté depuis index.ts', () => {
    expect(sphericalToVectorFromIndex).toBe(sphericalToVector);
    expect(angularDistanceFromIndex).toBe(angularDistance);
    expect(pickHotspotFromIndex).toBe(pickHotspot);
  });

  describe('sphericalToVector', () => {
    describe('axes principaux (repère Three.js : Y haut, -Z devant pour yaw=0)', () => {
      it('oriente le vecteur vers -Z pour yaw=0 et pitch=0 (devant)', () => {
        const v = sphericalToVector(0, 0, 1);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(-1);
      });

      it('oriente le vecteur vers +X pour yaw=π/2 et pitch=0 (droite)', () => {
        const v = sphericalToVector(Math.PI / 2, 0, 1);
        expect(v.x).toBeCloseTo(1);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(0);
      });

      it('oriente le vecteur vers -X pour yaw=-π/2 et pitch=0 (gauche)', () => {
        const v = sphericalToVector(-Math.PI / 2, 0, 1);
        expect(v.x).toBeCloseTo(-1);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(0);
      });

      it('oriente le vecteur vers +Z pour yaw=π et pitch=0 (derrière)', () => {
        const v = sphericalToVector(Math.PI, 0, 1);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(1);
      });

      it('oriente le vecteur vers +Z pour yaw=-π et pitch=0 (derrière)', () => {
        const v = sphericalToVector(-Math.PI, 0, 1);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(1);
      });

      it('oriente le vecteur vers +Y pour pitch=π/2 (zénith / haut)', () => {
        const v = sphericalToVector(0, Math.PI / 2, 1);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(1);
        expect(v.z).toBeCloseTo(0);
      });

      it('oriente le vecteur vers -Y pour pitch=-π/2 (nadir / bas)', () => {
        const v = sphericalToVector(0, -Math.PI / 2, 1);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(-1);
        expect(v.z).toBeCloseTo(0);
      });
    });

    describe('rayon (radius)', () => {
      it('utilise un rayon par défaut égal à 1', () => {
        const v = sphericalToVector(0, 0);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(-1);
      });

      it('applique un rayon personnalisé', () => {
        const radius = 10;
        const v = sphericalToVector(0, 0, radius);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(0);
        expect(v.z).toBeCloseTo(-10);

        const vRight = sphericalToVector(Math.PI / 2, 0, radius);
        expect(vRight.x).toBeCloseTo(10);
        expect(vRight.y).toBeCloseTo(0);
        expect(vRight.z).toBeCloseTo(0);

        const vUp = sphericalToVector(0, Math.PI / 2, radius);
        expect(vUp.x).toBeCloseTo(0);
        expect(vUp.y).toBeCloseTo(10);
        expect(vUp.z).toBeCloseTo(0);
      });

      it('conserve la norme Euclidienne égale au rayon pour toute direction', () => {
        const radius = 4.5;
        const v = sphericalToVector(1.23, -0.45, radius);
        const norm = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        expect(norm).toBeCloseTo(radius);
      });

      it('renvoie un vecteur nul si radius=0', () => {
        const v = sphericalToVector(1.2, 0.4, 0);
        expect(v.x).toBe(0);
        expect(v.y).toBe(0);
        expect(v.z).toBe(-0);
      });
    });

    describe('périodicité et wrap du yaw', () => {
      it('produit le même vecteur à yaw=0 et yaw=2π', () => {
        const v0 = sphericalToVector(0, 0.2, 2);
        const v2pi = sphericalToVector(2 * Math.PI, 0.2, 2);
        expect(v2pi.x).toBeCloseTo(v0.x);
        expect(v2pi.y).toBeCloseTo(v0.y);
        expect(v2pi.z).toBeCloseTo(v0.z);
      });

      it('produit le même vecteur à yaw=π et yaw=-π', () => {
        const vPosPi = sphericalToVector(Math.PI, 0.3, 1.5);
        const vNegPi = sphericalToVector(-Math.PI, 0.3, 1.5);
        expect(vPosPi.x).toBeCloseTo(vNegPi.x);
        expect(vPosPi.y).toBeCloseTo(vNegPi.y);
        expect(vPosPi.z).toBeCloseTo(vNegPi.z);
      });
    });
  });

  describe('angularDistance', () => {
    it('renvoie 0 pour deux directions strictement identiques', () => {
      expect(angularDistance({ yaw: 0, pitch: 0 }, { yaw: 0, pitch: 0 })).toBe(0);
      expect(angularDistance({ yaw: 1.25, pitch: -0.3 }, { yaw: 1.25, pitch: -0.3 })).toBe(0);
    });

    it('calcule la distance angulaire exacte sur les axes principaux', () => {
      // 90° horizontal
      expect(
        angularDistance({ yaw: 0, pitch: 0 }, { yaw: Math.PI / 2, pitch: 0 })
      ).toBeCloseTo(Math.PI / 2);

      // 180° horizontal (diamétralement opposés)
      expect(
        angularDistance({ yaw: 0, pitch: 0 }, { yaw: Math.PI, pitch: 0 })
      ).toBeCloseTo(Math.PI);

      // 90° vertical (horizon vers zénith)
      expect(
        angularDistance({ yaw: 0, pitch: 0 }, { yaw: 0, pitch: Math.PI / 2 })
      ).toBeCloseTo(Math.PI / 2);

      // 180° vertical (zénith vers nadir)
      expect(
        angularDistance({ yaw: 0, pitch: Math.PI / 2 }, { yaw: 0, pitch: -Math.PI / 2 })
      ).toBeCloseTo(Math.PI);
    });

    it('est symétrique : distance(a, b) === distance(b, a)', () => {
      const a: SphericalPosition = { yaw: 0.8, pitch: -0.2 };
      const b: SphericalPosition = { yaw: -1.4, pitch: 0.5 };
      expect(angularDistance(a, b)).toBeCloseTo(angularDistance(b, a));
    });

    describe('wrap du yaw autour de ±π', () => {
      it('calcule la plus courte distance angulaire à travers la frontière ±π', () => {
        // Deux points à 0.05 rad de chaque côté de la démarcation π / -π (écart total 0.1 rad)
        const a: SphericalPosition = { yaw: Math.PI - 0.05, pitch: 0 };
        const b: SphericalPosition = { yaw: -Math.PI + 0.05, pitch: 0 };
        expect(angularDistance(a, b)).toBeCloseTo(0.1);
      });

      it('calcule correctement la distance avec des multiples de 2π', () => {
        const a: SphericalPosition = { yaw: 0, pitch: 0.1 };
        const b: SphericalPosition = { yaw: 2 * Math.PI + 0.08, pitch: 0.1 };
        expect(angularDistance(a, b)).toBeCloseTo(0.08);

        const c: SphericalPosition = { yaw: -4 * Math.PI, pitch: 0 };
        const d: SphericalPosition = { yaw: 0, pitch: 0 };
        expect(angularDistance(c, d)).toBeCloseTo(0);
      });

      it('gère l indépendance du yaw aux pôles (zénith / nadir)', () => {
        // Au pôle nord (pitch = π/2), tous les yaws désignent le même point géométrique
        const pole1: SphericalPosition = { yaw: 0, pitch: Math.PI / 2 };
        const pole2: SphericalPosition = { yaw: 2.5, pitch: Math.PI / 2 };
        expect(angularDistance(pole1, pole2)).toBeCloseTo(0);
      });
    });
  });

  describe('pickHotspot', () => {
    const targets: HotspotTarget[] = [
      { id: 'spot-forward', yaw: 0, pitch: 0 },
      { id: 'spot-close-right', yaw: 0.05, pitch: 0 },
      { id: 'spot-medium-right', yaw: 0.10, pitch: 0 },
      { id: 'spot-far-right', yaw: 0.25, pitch: 0 },
      { id: 'spot-up', yaw: 0, pitch: 0.08 },
    ];

    describe('seuil (maxRad)', () => {
      it('sélectionne une cible située dans le seuil par défaut (0.12 rad)', () => {
        // Regard orienté à yaw=0.04, pitch=0 -> proche de 'spot-close-right' (dist=0.01)
        const gaze: SphericalPosition = { yaw: 0.04, pitch: 0 };
        const picked = pickHotspot(gaze, targets);
        expect(picked).toBe('spot-close-right');
      });

      it('renvoie null si aucune cible n est dans le seuil par défaut', () => {
        // Regard orienté à 90° à gauche (yaw=-π/2), aucune cible à proximité
        const gaze: SphericalPosition = { yaw: -Math.PI / 2, pitch: 0 };
        const picked = pickHotspot(gaze, targets);
        expect(picked).toBeNull();
      });

      it('respecte un seuil maxRad personnalisé', () => {
        const gaze: SphericalPosition = { yaw: 0.09, pitch: 0 };
        // distance avec spot-medium-right: 0.01, spot-close-right: 0.04, spot-forward: 0.09

        // Avec maxRad=0.02, spot-medium-right est dans le seuil (0.01 <= 0.02)
        expect(pickHotspot(gaze, targets, 0.02)).toBe('spot-medium-right');

        // Avec un seuil très strict maxRad=0.005, aucune cible n'est retenue
        expect(pickHotspot(gaze, targets, 0.005)).toBeNull();
      });

      it('sélectionne une cible située exactement à la limite du seuil', () => {
        const gaze: SphericalPosition = { yaw: 0, pitch: 0 };
        const singleTarget: HotspotTarget[] = [{ id: 'spot-exact', yaw: 0.1, pitch: 0 }];
        // Exactement à distance 0.1 avec maxRad = 0.1
        expect(pickHotspot(gaze, singleTarget, 0.1)).toBe('spot-exact');
      });

      it('renvoie null si maxRad est négatif', () => {
        const gaze: SphericalPosition = { yaw: 0, pitch: 0 };
        expect(pickHotspot(gaze, targets, -0.01)).toBeNull();
      });
    });

    describe('cible la plus proche', () => {
      it('choisit la cible la plus proche quand plusieurs sont dans le seuil', () => {
        // Regard à yaw=0.09, pitch=0
        // spot-medium-right (yaw=0.10) est à 0.01 rad
        // spot-close-right (yaw=0.05) est à 0.04 rad
        // spot-forward (yaw=0) est à 0.09 rad
        // Les trois sont <= 0.12, la plus proche est 'spot-medium-right'
        const gaze: SphericalPosition = { yaw: 0.09, pitch: 0 };
        expect(pickHotspot(gaze, targets)).toBe('spot-medium-right');
      });

      it('distingue l élévation (pitch) pour retenir la cible la plus proche', () => {
        // Regard à yaw=0, pitch=0.07 -> plus proche de 'spot-up' (pitch=0.08, dist=0.01)
        // que de 'spot-forward' (pitch=0, dist=0.07)
        const gaze: SphericalPosition = { yaw: 0, pitch: 0.07 };
        expect(pickHotspot(gaze, targets)).toBe('spot-up');
      });

      it('gère le wrap de yaw lors de la sélection de la cible la plus proche', () => {
        const wrapTargets: HotspotTarget[] = [
          { id: 'target-wrap-neg', yaw: -Math.PI + 0.03, pitch: 0 },
          { id: 'target-other', yaw: 0, pitch: 0 },
        ];
        // Regard juste avant la bordure +π (yaw = π - 0.02)
        // La distance angulaire avec 'target-wrap-neg' est ~0.05 rad <= 0.12
        const gaze: SphericalPosition = { yaw: Math.PI - 0.02, pitch: 0 };
        expect(pickHotspot(gaze, wrapTargets)).toBe('target-wrap-neg');
      });
    });

    describe('cas limites', () => {
      it('renvoie null pour une liste de cibles vide', () => {
        expect(pickHotspot({ yaw: 0, pitch: 0 }, [])).toBeNull();
      });
    });
  });
});
