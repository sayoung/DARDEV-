import { randomUUID } from 'node:crypto';
import {
  TourCreateSchema,
  SceneCreateSchema,
  HotspotCreateSchema,
  TourCreate,
  SceneCreate,
  HotspotCreate,
  HotspotType,
} from '@xplor/shared';

export interface TourDataScene {
  file: string;
  name: string;
  info: string;
}

export interface TourData {
  title: string;
  city: string;
  description: string;
  scenes: TourDataScene[];
}

export interface TourPlanPayloads {
  tour: TourCreate;
  scenes: Array<{
    id: string;
    payload: SceneCreate;
    hotspots: HotspotCreate[];
  }>;
}

const LABEL_NEXT = { fr: 'Suivante', ar: 'التالي', en: 'Next' };
const LABEL_PREV = { fr: 'Précédente', ar: 'السابق', en: 'Previous' };
const LABEL_INFO = { fr: 'Information', ar: 'معلومات', en: 'Information' };

export function generateId(): string {
  const v4 = randomUUID();
  return v4.substring(0, 14) + '7' + v4.substring(15);
}

export function buildTourPlan(
  data: TourData,
  assetIdsByFile: Record<string, string>,
  cityId: string = generateId(),
  categoryId: string = generateId(),
  coverAssetId?: string
): TourPlanPayloads {
  const firstScene = data.scenes[0];
  if (!firstScene) {
    throw new Error('La visite doit contenir au moins une scène');
  }

  for (const scene of data.scenes) {
    if (!assetIdsByFile[scene.file]) {
      throw new Error(`Asset manquant pour le fichier ${scene.file}`);
    }
  }

  const tourCoverAssetId = coverAssetId || assetIdsByFile[firstScene.file];
  if (!tourCoverAssetId) {
    throw new Error('coverAssetId manquant');
  }

  const tourPayload = TourCreateSchema.parse({
    title: { fr: data.title },
    summary: { fr: data.description },
    cityId,
    categoryIds: [categoryId],
    coverAssetId: tourCoverAssetId,
  });

  const sceneIds = data.scenes.map(() => generateId());

  const scenes = data.scenes.map((sceneData, index) => {
    const sceneId = sceneIds[index];
    if (!sceneId) throw new Error('Erreur de génération d\'ID');
    
    const prevIndex = index === 0 ? data.scenes.length - 1 : index - 1;
    const nextIndex = index === data.scenes.length - 1 ? 0 : index + 1;
    
    const prevSceneId = sceneIds[prevIndex];
    const nextSceneId = sceneIds[nextIndex];
    if (!prevSceneId || !nextSceneId) throw new Error('Erreur de génération d\'ID de navigation');

    const payload = SceneCreateSchema.parse({
      title: { fr: sceneData.name },
      panoramaAssetId: assetIdsByFile[sceneData.file],
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: index,
    });

    const hotspots: HotspotCreate[] = [];

    if (data.scenes.length > 1) {
      hotspots.push(
        HotspotCreateSchema.parse({
          type: HotspotType.SCENE_LINK,
          yaw: 0,
          pitch: -0.12,
          label: LABEL_NEXT,
          targetSceneId: nextSceneId,
        })
      );

      hotspots.push(
        HotspotCreateSchema.parse({
          type: HotspotType.SCENE_LINK,
          yaw: Math.PI,
          pitch: -0.12,
          label: LABEL_PREV,
          targetSceneId: prevSceneId,
        })
      );
    }

    hotspots.push(
      HotspotCreateSchema.parse({
        type: HotspotType.INFO,
        yaw: 0.7,
        pitch: 0.05,
        label: LABEL_INFO,
        body: { fr: sceneData.info },
      })
    );

    return {
      id: sceneId,
      payload,
      hotspots,
    };
  });

  return {
    tour: tourPayload,
    scenes,
  };
}
