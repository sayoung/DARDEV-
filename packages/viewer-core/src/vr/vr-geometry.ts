/**
 * Vecteur 3D cartésien dans le repère standard Three.js (main droite).
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Coordonnées sphériques d'orientation en radians.
 * En cohérence avec les conventions de scene-markers.ts et orientation.ts.
 */
export interface SphericalPosition {
  yaw: number;
  pitch: number;
}

/**
 * Cible candidate pour la sélection de hotspot en VR.
 */
export interface HotspotTarget {
  id: string;
  yaw: number;
  pitch: number;
}

/**
 * Convertit des coordonnées sphériques en vecteur cartésien {x, y, z} dans le repère Three.js.
 *
 * Conventions d'unités et de repère :
 * - `yaw` (radians) : angle azimuthal horizontal autour de l'axe vertical Y.
 *   En cohérence avec `scene-markers.ts` et `orientation.ts`, l'unité est le radian.
 *   Un yaw = 0 correspond à la direction avant le long de l'axe -Z.
 *   Un yaw positif (> 0) tourne vers la droite (+X).
 * - `pitch` (radians) : angle d'élévation vertical au-dessus du plan horizontal (de -π/2 à +π/2).
 *   En cohérence avec `scene-markers.ts` et `orientation.ts`, l'unité est le radian.
 *   pitch = 0 correspond à l'horizon (plan XZ).
 *   pitch = +π/2 correspond au zénith (+Y vers le haut).
 *   pitch = -π/2 correspond au nadir (-Y vers le bas).
 * - `radius` : distance radiale (rayon de la sphère), défaut: 1.
 * - Repère Three.js (main droite) :
 *   - +Y orienté vers le haut
 *   - -Z devant pour yaw = 0, pitch = 0
 *   - +X à droite pour yaw = +π/2, pitch = 0
 *   - +Z en arrière pour yaw = ±π, pitch = 0
 *   - -X à gauche pour yaw = -π/2, pitch = 0
 *
 * @param yaw Angle horizontal en radians.
 * @param pitch Angle d'élévation en radians.
 * @param radius Rayon de la sphère (défaut : 1).
 * @returns Coordonnées cartésiennes { x, y, z }.
 */
export function sphericalToVector(
  yaw: number,
  pitch: number,
  radius = 1
): Vector3D {
  const cosPitch = Math.cos(pitch);
  return {
    x: radius * cosPitch * Math.sin(yaw),
    y: radius * Math.sin(pitch),
    z: -radius * cosPitch * Math.cos(yaw),
  };
}

/**
 * Convertit un vecteur cartésien {x, y, z} en coordonnées sphériques {yaw, pitch} dans le repère Three.js.
 *
 * Inverse exacte de `sphericalToVector` :
 * - Même repère et mêmes conventions :
 *   - `yaw` (radians) : angle horizontal autour de l'axe vertical Y,
 *     -Z devant pour yaw = 0,
 *     +X à droite pour yaw = +π/2,
 *     -X à gauche pour yaw = -π/2,
 *     +Z derrière pour yaw = ±π.
 *   - `pitch` (radians) : angle d'élévation au-dessus du plan horizontal XZ,
 *     compris dans [-π/2, +π/2] (+Y vers le haut / zénith, -Y vers le bas / nadir).
 * - Le vecteur `v` n'a pas besoin d'être normalisé.
 * - En cas de vecteur nul ({x: 0, y: 0, z: 0}), renvoie { yaw: 0, pitch: 0 }.
 *
 * @param v Vecteur cartésien { x, y, z }.
 * @returns Coordonnées sphériques { yaw, pitch } en radians.
 */
export function vectorToSpherical(v: Vector3D): SphericalPosition {
  if (v.x === 0 && v.y === 0 && v.z === 0) {
    return { yaw: 0, pitch: 0 };
  }

  const xz = Math.hypot(v.x, v.z);
  const rawYaw = xz === 0 ? 0 : Math.atan2(v.x, -v.z);
  const rawPitch = Math.atan2(v.y, xz);

  return {
    yaw: rawYaw === 0 ? 0 : rawYaw,
    pitch: rawPitch === 0 ? 0 : rawPitch,
  };
}

/**
 * Calcule l'angle (distance angulaire) en radians entre deux directions sphériques.
 *
 * Utilise la géométrie vectorielle 3D (produit scalaire et norme du produit vectoriel
 * via Math.atan2) afin d'assurer une parfaite robustesse numérique :
 * - Précision optimale pour les très petits angles sans perte de chiffres significatifs.
 * - Gestion naturelle du wrap du yaw autour de ±π et des multiples de 2π.
 * - Absence de singularité aux pôles (zénith / nadir).
 *
 * @param a Première direction sphérique { yaw, pitch } en radians.
 * @param b Seconde direction sphérique { yaw, pitch } en radians.
 * @returns Angle en radians compris dans l'intervalle [0, π].
 */
export function angularDistance(
  a: SphericalPosition,
  b: SphericalPosition
): number {
  const va = sphericalToVector(a.yaw, a.pitch, 1);
  const vb = sphericalToVector(b.yaw, b.pitch, 1);

  const dot = va.x * vb.x + va.y * vb.y + va.z * vb.z;
  const cx = va.y * vb.z - va.z * vb.y;
  const cy = va.z * vb.x - va.x * vb.z;
  const cz = va.x * vb.y - va.y * vb.x;
  const crossLength = Math.sqrt(cx * cx + cy * cy + cz * cz);

  return Math.atan2(crossLength, dot);
}

/**
 * Sélectionne l'identifiant du hotspot le plus proche de la direction du regard dans la limite d'un seuil angulaire.
 *
 * @param gaze Direction du regard { yaw, pitch } en radians.
 * @param targets Liste des cibles candidates { id, yaw, pitch }.
 * @param maxRad Seuil angulaire maximal en radians (défaut : 0.12 rad, soit environ 6.87°).
 * @returns Identifiant de la cible éligible la plus proche, ou null si aucune cible n'est dans le seuil.
 */
export function pickHotspot(
  gaze: SphericalPosition,
  targets: readonly HotspotTarget[],
  maxRad = 0.12
): string | null {
  if (targets.length === 0 || maxRad < 0) {
    return null;
  }

  let closestId: string | null = null;
  let minDistance = Infinity;

  for (const target of targets) {
    const dist = angularDistance(gaze, target);
    if (dist <= maxRad && dist < minDistance) {
      minDistance = dist;
      closestId = target.id;
    }
  }

  return closestId;
}
