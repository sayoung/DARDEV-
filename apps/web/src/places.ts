import {
  LocalizedTextSchema,
  localize,
  type LocalizedText,
  type TourGraphScene,
} from '@xplor/shared';

export interface Place {
  name: string;
  count: number;
  firstSceneId: string;
  thumb: string;
  sceneIds: string[];
}

const SUFFIX_REGEX = / \(\d+\/\d+\)$/;

function resolveSceneTitle(title: string | LocalizedText, lang: string = 'fr'): string {
  if (typeof title === 'string') {
    return title;
  }
  const parsed = LocalizedTextSchema.safeParse(title);
  if (parsed.success) {
    try {
      return localize(parsed.data, lang);
    } catch {
      return parsed.data.fr;
    }
  }
  return '';
}

/**
 * Regroupe les scènes consécutives en « lieux ».
 * Un lieu est une suite de scènes consécutives dont le titre, sans le suffixe final ` (n/m)`, est identique.
 * Une scène sans suffixe forme un lieu seule.
 * Deux lieux non consécutifs qui portent le même nom restent deux entrées séparées.
 * `thumb` est celui de la première scène du lieu.
 */
export function groupScenesIntoPlaces(
  scenes: readonly (TourGraphScene | (Omit<TourGraphScene, 'title'> & { title: LocalizedText }))[],
  lang: string = 'fr',
): Place[] {
  const places: Place[] = [];
  let currentGroup: { place: Place; hasSuffix: boolean } | null = null;

  for (const scene of scenes) {
    const rawTitle = resolveSceneTitle(scene.title, lang);
    const hasSuffix = SUFFIX_REGEX.test(rawTitle);
    const name = rawTitle.replace(SUFFIX_REGEX, '');

    if (currentGroup !== null && currentGroup.hasSuffix && hasSuffix && currentGroup.place.name === name) {
      currentGroup.place.count += 1;
      currentGroup.place.sceneIds.push(scene.id);
    } else {
      const newPlace: Place = {
        name,
        count: 1,
        firstSceneId: scene.id,
        thumb: scene.thumb,
        sceneIds: [scene.id],
      };
      places.push(newPlace);
      currentGroup = { place: newPlace, hasSuffix };
    }
  }

  return places;
}
