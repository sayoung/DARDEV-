import { describe, expect, it } from 'vitest';

import {
  AssetKind,
  AssetListQuerySchema,
  AssetFoldersQuerySchema,
  AssetFoldersResponseSchema,
  AssetResponseSchema,
  AssetUploadRequestSchema,
  AssetUploadResponseSchema,
  CategoryCreateSchema,
  CategoryResponseSchema,
  CategoryUpdateSchema,
  CityCreateSchema,
  CityResponseSchema,
  CityUpdateSchema,
  HotspotCreateSchema,
  HotspotIcon,
  HotspotResponseSchema,
  HotspotType,
  HotspotUpdateSchema,
  PaginatedAssetResponseSchema,
  PaginatedTourResponseSchema,
  PaginationQuerySchema,
  ProcessingStatus,
  SceneCreateSchema,
  SceneListResponseSchema,
  SceneReorderRequestSchema,
  SceneResponseSchema,
  SceneUpdateSchema,
  SetStartSceneRequestSchema,
  TourCreateSchema,
  TourListQuerySchema,
  TourResponseSchema,
  TourStatus,
  TourUpdateSchema,
  TourValidationResponseSchema,
  ValidationIssueCode,
  ValidationIssueSchema,
  paginated,
  TourLinkMapSchema,
  type CityResponse,
  type Paginated,
} from './catalog.js';

const id = {
  city: '01990000-0000-7000-8000-000000000001',
  category: '01990000-0000-7000-8000-000000000002',
  cover: '01990000-0000-7000-8000-000000000003',
  panorama: '01990000-0000-7000-8000-000000000004',
  scene: '01990000-0000-7000-8000-000000000005',
  tour: '01990000-0000-7000-8000-000000000006',
  media: '01990000-0000-7000-8000-000000000007',
  categoryResponse: '01990000-0000-7000-8000-000000000008',
  user: '01990000-0000-7000-8000-000000000009',
  hotspot: '01990000-0000-7000-8000-00000000000a',
} as const;

const uuidV4 = '01990000-0000-4000-8000-000000000001';

const city = {
  name: { fr: 'Rabat', ar: 'الرباط', en: 'Rabat' },
  region: 'Rabat-Salé-Kénitra',
  lat: 34.02,
  lng: -6.84,
};

const category = {
  name: { fr: 'Monuments' },
  icon: 'landmark',
  color: '#1B4F72',
  weight: 10,
};

const tour = {
  title: { fr: 'Kasbah des Oudayas' },
  summary: { fr: 'Remparts face à la mer' },
  cityId: id.city,
  categoryIds: [id.category],
  coverAssetId: id.cover,
};

describe('enums de contenu', () => {
  it('reprend les valeurs du cahier', () => {
    expect(Object.values(TourStatus)).toEqual(['DRAFT', 'PUBLISHED']);
    expect(Object.values(HotspotType)).toEqual(['SCENE_LINK', 'TOUR_LINK', 'INFO', 'MEDIA', 'URL']);
    expect(Object.values(HotspotIcon)).toEqual(['ARROW', 'INFO', 'PHOTO', 'PLAY', 'PORTAL']);
    expect(Object.values(AssetKind)).toEqual(['PANORAMA', 'IMAGE', 'AUDIO', 'VIDEO']);
    expect(Object.values(ProcessingStatus)).toEqual(['PENDING', 'PROCESSING', 'READY', 'ERROR']);
    expect(Object.values(ValidationIssueCode)).toEqual([
      'START_SCENE_MISSING',
      'START_SCENE_FOREIGN',
      'PANORAMA_NOT_READY',
      'SCENE_UNREACHABLE',
      'SCENE_LINK_TARGET_MISSING',
      'SCENE_LINK_SELF',
      'SCENE_LINK_FOREIGN',
      'SCENE_LINK_TARGET_DELETED',
      'TOUR_LINK_TARGET_MISSING',
      'TOUR_LINK_SELF',
      'TOUR_LINK_TARGET_UNPUBLISHED',
      'TOUR_LINK_SCENE_FOREIGN',
    ]);
  });
});

describe('CityCreateSchema', () => {
  it('accepte une ville dans les bornes géographiques', () => {
    expect(CityCreateSchema.parse(city)).toEqual(city);
    expect(CityCreateSchema.parse({ ...city, lat: -90, lng: 180 }).lat).toBe(-90);
  });

  it('refuse une latitude hors de -90…90', () => {
    expect(CityCreateSchema.safeParse({ ...city, lat: 91 }).success).toBe(false);
    expect(CityCreateSchema.safeParse({ ...city, lat: -90.1 }).success).toBe(false);
  });
});

describe('CityUpdateSchema', () => {
  it('accepte le même corps qu’une création', () => {
    expect(CityUpdateSchema.parse(city)).toEqual(city);
  });

  it('refuse une longitude hors de -180…180', () => {
    expect(CityUpdateSchema.safeParse({ ...city, lng: 180.1 }).success).toBe(false);
  });
});

describe('CityResponseSchema', () => {
  const response = { id: id.city, ...city };

  it('renvoie l’identifiant et les champs de la ville', () => {
    expect(CityResponseSchema.parse(response)).toEqual(response);
  });

  it('refuse un identifiant qui n’est pas un UUID v7', () => {
    expect(CityResponseSchema.safeParse({ ...response, id: uuidV4 }).success).toBe(false);
  });
});

describe('CategoryCreateSchema', () => {
  it('accepte une couleur #RRGGBB', () => {
    expect(CategoryCreateSchema.parse(category)).toEqual(category);
    expect(CategoryCreateSchema.parse({ ...category, color: '#aabbcc' }).color).toBe('#aabbcc');
  });

  it('refuse une couleur invalide', () => {
    expect(CategoryCreateSchema.safeParse({ ...category, color: '#abc' }).success).toBe(false);
    expect(CategoryCreateSchema.safeParse({ ...category, color: '#GGGGGG' }).success).toBe(false);
    expect(CategoryCreateSchema.safeParse({ ...category, color: '1B4F72' }).success).toBe(false);
  });
});

describe('CategoryUpdateSchema', () => {
  it('accepte le même corps qu’une création', () => {
    expect(CategoryUpdateSchema.parse(category)).toEqual(category);
  });

  it('refuse un poids qui n’est pas un entier', () => {
    expect(CategoryUpdateSchema.safeParse({ ...category, weight: 1.5 }).success).toBe(false);
  });
});

describe('CategoryResponseSchema', () => {
  const response = { id: id.categoryResponse, ...category };

  it('renvoie l’identifiant et les champs de la catégorie', () => {
    expect(CategoryResponseSchema.parse(response)).toEqual(response);
  });

  it('refuse une couleur invalide', () => {
    expect(CategoryResponseSchema.safeParse({ ...response, color: '#12' }).success).toBe(false);
  });
});

describe('TourCreateSchema', () => {
  it('accepte une visite avec les champs obligatoires', () => {
    expect(TourCreateSchema.parse(tour)).toEqual(tour);
  });

  it('accepte un résumé de 500 caractères dans chaque langue', () => {
    const summary = { fr: 'a'.repeat(500), ar: 'ا'.repeat(500), en: 'a'.repeat(500) };
    expect(TourCreateSchema.parse({ ...tour, summary }).summary).toEqual(summary);
  });

  it('refuse un résumé arabe de 501 caractères', () => {
    const summary = { fr: 'Résumé', ar: 'ا'.repeat(501) };
    expect(TourCreateSchema.safeParse({ ...tour, summary }).success).toBe(false);
  });

  it('refuse un résumé français ou anglais de 501 caractères', () => {
    expect(TourCreateSchema.safeParse({ ...tour, summary: { fr: 'a'.repeat(501) } }).success).toBe(
      false,
    );
    expect(
      TourCreateSchema.safeParse({ ...tour, summary: { fr: 'ok', en: 'a'.repeat(501) } }).success,
    ).toBe(false);
  });

  it('refuse une liste de catégories vide', () => {
    expect(TourCreateSchema.safeParse({ ...tour, categoryIds: [] }).success).toBe(false);
  });
});

describe('TourUpdateSchema', () => {
  it('accepte le même corps qu’une création (sans publicShare)', () => {
    expect(TourUpdateSchema.parse(tour)).toEqual(tour);
  });

  it('accepte le corps complet avec publicShare', () => {
    const withShare = { ...tour, publicShare: true };
    expect(TourUpdateSchema.parse(withShare)).toEqual(withShare);
  });

  it('refuse un corps partiel (seulement publicShare)', () => {
    expect(TourUpdateSchema.safeParse({ publicShare: true }).success).toBe(false);
  });

  it('refuse une latitude hors bornes', () => {
    expect(TourUpdateSchema.safeParse({ ...tour, lat: 90.1 }).success).toBe(false);
  });
});

const tourResponse = {
  id: id.tour,
  ...tour,
  status: TourStatus.DRAFT,
  publicShare: false,
  shareToken: 'abcdefghijklmnopqrstuv',
  sceneCount: 0,
  createdById: id.user,
  contentVersion: 1,
  startSceneId: null,
  publishedAt: null,
};

describe('TourResponseSchema', () => {
  it('renvoie la visite, son statut et le nombre de scènes', () => {
    expect(TourResponseSchema.parse(tourResponse)).toEqual(tourResponse);
  });

  it('accepte startSceneId et publishedAt renseignés', () => {
    const filled = {
      ...tourResponse,
      startSceneId: id.scene,
      publishedAt: '2026-09-30T08:00:00.000Z',
    };
    expect(TourResponseSchema.parse(filled)).toEqual(filled);
  });

  it('refuse un startSceneId qui n’est pas un UUID v7', () => {
    expect(TourResponseSchema.safeParse({ ...tourResponse, startSceneId: 'abc' }).success).toBe(
      false,
    );
  });

  it('refuse un jeton de partage vide ou trop long ou invalide', () => {
    expect(TourResponseSchema.safeParse({ ...tourResponse, shareToken: '' }).success).toBe(false);
    expect(TourResponseSchema.safeParse({ ...tourResponse, shareToken: 'x'.repeat(23) }).success).toBe(false);
    expect(TourResponseSchema.safeParse({ ...tourResponse, shareToken: 'avec espace' }).success).toBe(false);
  });

  it('refuse un nombre de scènes négatif', () => {
    expect(TourResponseSchema.safeParse({ ...tourResponse, sceneCount: -1 }).success).toBe(false);
  });
});

describe('TourListQuerySchema', () => {
  it('pose page à 1 et pageSize à 20 quand ils sont omis', () => {
    expect(TourListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepte les filtres de la liste', () => {
    expect(
      TourListQuerySchema.parse({
        page: 2,
        pageSize: 10,
        status: TourStatus.PUBLISHED,
        cityId: id.city,
        categoryId: id.category,
        q: 'kasbah',
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      status: TourStatus.PUBLISHED,
      cityId: id.city,
      categoryId: id.category,
      q: 'kasbah',
    });
  });

  it('refuse un statut inconnu', () => {
    expect(TourListQuerySchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('PaginatedTourResponseSchema', () => {
  it('décrit une page de visites', () => {
    const page = { items: [tourResponse], page: 1, pageSize: 20, total: 1 };
    expect(PaginatedTourResponseSchema.parse(page)).toEqual(page);
  });
});

describe('SceneCreateSchema', () => {
  const scene = {
    title: { fr: 'La porte' },
    panoramaAssetId: id.panorama,
    weight: 0,
  };

  it('applique la vue initiale par défaut', () => {
    expect(SceneCreateSchema.parse(scene)).toEqual({
      ...scene,
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
    });
  });

  it('accepte les bornes du zoom', () => {
    expect(SceneCreateSchema.parse({ ...scene, initialZoom: 0 }).initialZoom).toBe(0);
    expect(SceneCreateSchema.parse({ ...scene, initialZoom: 100 }).initialZoom).toBe(100);
  });

  it('refuse un zoom hors de 0…100', () => {
    expect(SceneCreateSchema.safeParse({ ...scene, initialZoom: 101 }).success).toBe(false);
    expect(SceneCreateSchema.safeParse({ ...scene, initialZoom: -1 }).success).toBe(false);
  });
});

describe('SceneResponseSchema', () => {
  const createdAt = '2026-09-29T18:00:00.000Z';
  const sceneResponse = {
    id: id.scene,
    tourId: id.tour,
    title: { fr: 'La porte' },
    panoramaAssetId: id.panorama,
    initialYaw: 0,
    initialPitch: 0,
    initialZoom: 50,
    weight: 1,
    hotspotCount: 0,
    createdAt,
    updatedAt: createdAt,
  };

  it('accepte une scène sans légende', () => {
    expect(SceneResponseSchema.parse(sceneResponse)).toEqual(sceneResponse);
  });

  it('accepte une légende', () => {
    const withCaption = { ...sceneResponse, caption: { fr: 'Entrée' } };
    expect(SceneResponseSchema.parse(withCaption).caption).toEqual({ fr: 'Entrée' });
  });

  it('refuse un compteur négatif ou une date invalide', () => {
    expect(SceneResponseSchema.safeParse({ ...sceneResponse, hotspotCount: -1 }).success).toBe(
      false,
    );
    expect(SceneResponseSchema.safeParse({ ...sceneResponse, createdAt: 'hier' }).success).toBe(
      false,
    );
  });
});

describe('SceneListResponseSchema', () => {
  it('accepte un tableau de scènes', () => {
    const createdAt = '2026-09-29T18:00:00.000Z';
    const sceneResponse = {
      id: id.scene,
      tourId: id.tour,
      title: { fr: 'La porte' },
      panoramaAssetId: id.panorama,
      initialYaw: 0,
      initialPitch: 0,
      initialZoom: 50,
      weight: 1,
      hotspotCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
    const valid = [sceneResponse, { ...sceneResponse, id: '018f6b21-4d39-7a1b-9e45-3f8c5b2a1d9a', weight: 2 }];
    expect(SceneListResponseSchema.parse(valid)).toEqual(valid);
  });

  it('refuse un objet simple', () => {
    expect(SceneListResponseSchema.safeParse({ id: id.scene }).success).toBe(false);
  });
});

describe('SceneUpdateSchema', () => {
  const scene = {
    title: { fr: 'Le jardin' },
    caption: { fr: 'Sous les orangers' },
    panoramaAssetId: id.panorama,
    initialYaw: Math.PI,
    initialPitch: -Math.PI / 2,
    initialZoom: 20,
    weight: 2,
  };

  it('accepte une vue initiale explicite', () => {
    expect(SceneUpdateSchema.parse(scene)).toEqual(scene);
  });

  it('refuse un cap hors de −π…π', () => {
    expect(SceneUpdateSchema.safeParse({ ...scene, initialYaw: Math.PI + 0.01 }).success).toBe(
      false,
    );
  });
});

describe('SceneReorderRequestSchema', () => {
  it('accepte une liste d’UUID v7, y compris vide ou avec un doublon', () => {
    expect(SceneReorderRequestSchema.parse({ sceneIds: [id.scene, id.tour] })).toEqual({
      sceneIds: [id.scene, id.tour],
    });
    expect(SceneReorderRequestSchema.parse({ sceneIds: [] })).toEqual({ sceneIds: [] });
    expect(SceneReorderRequestSchema.parse({ sceneIds: [id.scene, id.scene] }).sceneIds).toEqual([
      id.scene,
      id.scene,
    ]);
  });

  it('refuse un UUID qui n’est pas v7', () => {
    expect(SceneReorderRequestSchema.safeParse({ sceneIds: [uuidV4] }).success).toBe(false);
  });
});

describe('SetStartSceneRequestSchema', () => {
  it('accepte l’identifiant de la scène de départ', () => {
    expect(SetStartSceneRequestSchema.parse({ sceneId: id.scene })).toEqual({ sceneId: id.scene });
  });

  it('refuse un UUID qui n’est pas v7', () => {
    expect(SetStartSceneRequestSchema.safeParse({ sceneId: uuidV4 }).success).toBe(false);
  });
});

describe('HotspotCreateSchema', () => {
  const position = {
    yaw: 1.2,
    pitch: -0.1,
    label: { fr: 'Entrer dans la kasbah' },
  };

  it('accepte un lien de scène et pose l’icône ARROW', () => {
    expect(
      HotspotCreateSchema.parse({
        type: HotspotType.SCENE_LINK,
        ...position,
        yaw: Math.PI,
        pitch: -Math.PI / 2,
        targetSceneId: id.scene,
      }),
    ).toEqual({
      type: HotspotType.SCENE_LINK,
      ...position,
      yaw: Math.PI,
      pitch: -Math.PI / 2,
      targetSceneId: id.scene,
      icon: HotspotIcon.ARROW,
    });
  });

  it('refuse un SCENE_LINK sans targetSceneId', () => {
    expect(
      HotspotCreateSchema.safeParse({
        type: HotspotType.SCENE_LINK,
        ...position,
      }).success,
    ).toBe(false);
  });

  it('refuse un cap ou une hauteur hors de la sphère', () => {
    expect(
      HotspotCreateSchema.safeParse({
        type: HotspotType.SCENE_LINK,
        ...position,
        yaw: Math.PI + 0.01,
        targetSceneId: id.scene,
      }).success,
    ).toBe(false);
    expect(
      HotspotCreateSchema.safeParse({
        type: HotspotType.SCENE_LINK,
        ...position,
        pitch: Math.PI / 2 + 0.01,
        targetSceneId: id.scene,
      }).success,
    ).toBe(false);
  });

  it('accepte un lien de visite, avec ou sans scène d’arrivée', () => {
    const link = {
      type: HotspotType.TOUR_LINK,
      ...position,
      targetTourId: id.tour,
    };
    expect(HotspotCreateSchema.parse(link)).toEqual({ ...link, icon: HotspotIcon.PORTAL });
    expect(HotspotCreateSchema.parse({ ...link, targetTourSceneId: id.scene })).toEqual({
      ...link,
      targetTourSceneId: id.scene,
      icon: HotspotIcon.PORTAL,
    });
  });

  it('refuse un TOUR_LINK sans targetTourId', () => {
    expect(
      HotspotCreateSchema.safeParse({ type: HotspotType.TOUR_LINK, ...position }).success,
    ).toBe(false);
  });

  it('accepte une fiche INFO et pose l’icône INFO', () => {
    const info = {
      type: HotspotType.INFO,
      ...position,
      body: { fr: '<p>Histoire</p>' },
    };
    expect(HotspotCreateSchema.parse(info)).toEqual({ ...info, icon: HotspotIcon.INFO });
  });

  it('refuse un INFO sans body', () => {
    expect(HotspotCreateSchema.safeParse({ type: HotspotType.INFO, ...position }).success).toBe(
      false,
    );
  });

  it('accepte un média et permet de choisir PLAY', () => {
    const media = {
      type: HotspotType.MEDIA,
      ...position,
      mediaAssetIds: [id.media],
      icon: HotspotIcon.PLAY,
    };
    expect(HotspotCreateSchema.parse(media)).toEqual(media);
    expect(
      HotspotCreateSchema.parse({
        type: HotspotType.MEDIA,
        ...position,
        mediaAssetIds: [id.media],
      }).icon,
    ).toBe(HotspotIcon.PHOTO);
  });

  it('refuse un MEDIA sans asset', () => {
    expect(
      HotspotCreateSchema.safeParse({
        type: HotspotType.MEDIA,
        ...position,
        mediaAssetIds: [],
      }).success,
    ).toBe(false);
  });

  it('accepte une URL et pose l’icône INFO', () => {
    const link = {
      type: HotspotType.URL,
      ...position,
      url: 'https://example.com/lieu',
    };
    expect(HotspotCreateSchema.parse(link)).toEqual({ ...link, icon: HotspotIcon.INFO });
  });

  it('accepte aussi une URL http', () => {
    const link = {
      type: HotspotType.URL,
      ...position,
      url: 'http://visit.ma/page',
    };
    expect(HotspotCreateSchema.parse(link)).toEqual({ ...link, icon: HotspotIcon.INFO });
  });

  it('refuse une URL qui n’est pas http ou https', () => {
    for (const url of [
      'pas une url',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(
        HotspotCreateSchema.safeParse({
          type: HotspotType.URL,
          ...position,
          url,
        }).success,
      ).toBe(false);
    }
  });
});

describe('HotspotUpdateSchema', () => {
  const position = {
    yaw: 1.2,
    pitch: -0.1,
    label: { fr: 'Entrer dans la kasbah' },
  };

  it('accepte un remplacement complet, le type peut changer', () => {
    const sceneLink = {
      type: HotspotType.SCENE_LINK,
      ...position,
      targetSceneId: id.scene,
    };
    expect(HotspotUpdateSchema.parse(sceneLink)).toEqual({
      ...sceneLink,
      icon: HotspotIcon.ARROW,
    });
    const info = {
      type: HotspotType.INFO,
      ...position,
      body: { fr: '<p>Histoire</p>' },
    };
    expect(HotspotUpdateSchema.parse(info)).toEqual({ ...info, icon: HotspotIcon.INFO });
  });

  it('exige les champs requis de la variante choisie', () => {
    expect(HotspotUpdateSchema.safeParse({ type: HotspotType.INFO, ...position }).success).toBe(
      false,
    );
  });

  it('refuse une URL qui n’est pas http ou https', () => {
    for (const url of [
      'pas une url',
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(
        HotspotUpdateSchema.safeParse({
          type: HotspotType.URL,
          ...position,
          url,
        }).success,
      ).toBe(false);
    }
  });
});

describe('HotspotResponseSchema', () => {
  const createdAt = '2026-09-29T18:00:00.000Z';
  const base = {
    id: id.hotspot,
    sceneId: id.scene,
    yaw: 1.2,
    pitch: -0.1,
    label: { fr: 'Entrer dans la kasbah' },
    targetSceneId: null,
    targetTourId: null,
    targetTourSceneId: null,
    body: null,
    url: null,
    arrivalYaw: null,
    mediaAssetIds: [] as string[],
    icon: HotspotIcon.ARROW,
    createdAt,
    updatedAt: createdAt,
  };

  it('accepte une réponse par type', () => {
    const responses = [
      {
        ...base,
        type: HotspotType.SCENE_LINK,
        targetSceneId: id.scene,
        arrivalYaw: 0.4,
        icon: HotspotIcon.ARROW,
      },
      {
        ...base,
        type: HotspotType.TOUR_LINK,
        targetTourId: id.tour,
        targetTourSceneId: id.scene,
        icon: HotspotIcon.PORTAL,
      },
      {
        ...base,
        type: HotspotType.INFO,
        body: { fr: '<p>Histoire</p>', ar: 'تاريخ', en: 'History' },
        icon: HotspotIcon.INFO,
      },
      {
        ...base,
        type: HotspotType.MEDIA,
        mediaAssetIds: [id.media],
        icon: HotspotIcon.PHOTO,
      },
      {
        ...base,
        type: HotspotType.URL,
        url: 'https://example.com/lieu',
        icon: HotspotIcon.INFO,
      },
    ];
    for (const response of responses) {
      expect(HotspotResponseSchema.parse(response)).toEqual(response);
    }
  });

  it('refuse un type inconnu', () => {
    expect(HotspotResponseSchema.safeParse({ ...base, type: 'NOT_A_TYPE' }).success).toBe(false);
  });
});

describe('AssetResponseSchema', () => {
  const createdAt = '2026-09-29T12:00:00.000Z';
  const asset = {
    id: id.cover,
    kind: AssetKind.IMAGE,
    mimeType: 'image/jpeg',
    sizeBytes: 128,
    width: 4000,
    height: 2000,
    processingStatus: ProcessingStatus.READY,
    processingLog: null,
    copyright: 'Libre de droits', thumbnailUrl: null,
  derivatives: {}, panorama: null,
    createdAt,
  };

  it('accepte un média dont les dimensions et le copyright sont connus', () => {
    expect(AssetResponseSchema.parse(asset)).toEqual(asset);
  });

  it('accepte width, height et copyright à null', () => {
    const unknown = { ...asset, width: null, height: null, copyright: null };
    expect(AssetResponseSchema.parse(unknown)).toEqual(unknown);
  });

  it('accepte un processingLog non nul', () => {
    const withLog = { ...asset, processingLog: 'Traitement en cours...' };
    expect(AssetResponseSchema.parse(withLog)).toEqual(withLog);
  });

  it('refuse un kind inconnu ou une taille négative', () => {
    expect(AssetResponseSchema.safeParse({ ...asset, kind: 'GIF' }).success).toBe(false);
    expect(AssetResponseSchema.safeParse({ ...asset, sizeBytes: -1 }).success).toBe(false);
  });
});

describe('AssetListQuerySchema', () => {
  it('pose page à 1 et pageSize à 20, sans filtre kind', () => {
    expect(AssetListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepte un kind connu et refuse un kind inconnu', () => {
    expect(AssetListQuerySchema.parse({ page: 1, kind: AssetKind.PANORAMA })).toEqual({
      page: 1,
      pageSize: 20,
      kind: AssetKind.PANORAMA,
    });
    expect(AssetListQuerySchema.safeParse({ page: 1, kind: 'GIF' }).success).toBe(false);
  });

  it('accepte unused=true et refuse unused=false', () => {
    expect(AssetListQuerySchema.parse({ unused: 'true' })).toMatchObject({ unused: 'true' });
    expect(AssetListQuerySchema.safeParse({ unused: 'false' }).success).toBe(false);
  });

  it('accepte un tourId UUID', () => {
    expect(AssetListQuerySchema.parse({ tourId: id.tour })).toMatchObject({ tourId: id.tour });
    expect(AssetListQuerySchema.safeParse({ tourId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('AssetFoldersQuerySchema', () => {
  it('accepte un kind', () => {
    expect(AssetFoldersQuerySchema.parse({ kind: AssetKind.IMAGE })).toEqual({ kind: AssetKind.IMAGE });
    expect(AssetFoldersQuerySchema.safeParse({ kind: 'GIF' }).success).toBe(false);
  });
});

describe('AssetFoldersResponseSchema', () => {
  it('valide une liste de dossiers de visites', () => {
    const res = {
      total: 15,
      unusedCount: 3,
      tours: [
        {
          id: id.tour,
          title: { fr: 'Visite 1' },
          count: 12,
        },
      ],
    };
    expect(AssetFoldersResponseSchema.parse(res)).toEqual(res);
  });

  it('contrôle les clés total, unusedCount et tours', () => {
    expect(AssetFoldersResponseSchema.safeParse({ unusedCount: 3, tours: [] }).success).toBe(false);
    expect(AssetFoldersResponseSchema.safeParse({ total: 3, tours: [] }).success).toBe(false);
    expect(AssetFoldersResponseSchema.safeParse({ total: 3, unusedCount: 3 }).success).toBe(false);
  });
});

describe('PaginatedAssetResponseSchema', () => {
  it('accepte une page de médias', () => {
    const page = {
      items: [
        {
          id: id.cover,
          kind: AssetKind.AUDIO,
          mimeType: 'audio/mpeg',
          sizeBytes: 20,
          width: null,
          height: null,
          processingStatus: ProcessingStatus.PENDING,
          processingLog: null,
          copyright: null, thumbnailUrl: null,
  derivatives: {}, panorama: null,
          createdAt: '2026-09-29T12:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    expect(PaginatedAssetResponseSchema.parse(page)).toEqual(page);
  });
});

describe('PaginationQuerySchema', () => {
  it('pose pageSize à 20 quand il est omis', () => {
    expect(PaginationQuerySchema.parse({ page: 1 })).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepte les bornes de pageSize', () => {
    expect(PaginationQuerySchema.parse({ page: 2, pageSize: 1 })).toEqual({ page: 2, pageSize: 1 });
    expect(PaginationQuerySchema.parse({ page: 2, pageSize: 100 })).toEqual({
      page: 2,
      pageSize: 100,
    });
  });

  it('refuse une page inférieure à 1 ou un pageSize hors de 1…100', () => {
    expect(PaginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ page: 1, pageSize: 0 }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ page: 1, pageSize: 101 }).success).toBe(false);
  });
});

describe('ValidationIssueSchema', () => {
  it('accepte un problème avec scène et hotspot', () => {
    const issue = {
      code: ValidationIssueCode.SCENE_LINK_SELF,
      sceneId: id.scene,
      hotspotId: id.media,
      message: 'Le lien de scène pointe vers sa propre scène.',
    };
    expect(ValidationIssueSchema.parse(issue)).toEqual(issue);
  });

  it('refuse un code inconnu', () => {
    expect(
      ValidationIssueSchema.safeParse({
        code: 'NOT_A_CODE',
        message: 'inconnu',
      }).success,
    ).toBe(false);
  });
});

describe('TourValidationResponseSchema', () => {
  it('accepte une liste vide', () => {
    expect(TourValidationResponseSchema.parse({ issues: [] })).toEqual({ issues: [] });
  });

  it('accepte un problème de publication', () => {
    const body = {
      issues: [
        {
          code: ValidationIssueCode.SCENE_UNREACHABLE,
          sceneId: id.scene,
          message: 'Cette scène est inatteignable depuis la scène de départ.',
        },
      ],
    };
    expect(TourValidationResponseSchema.parse(body)).toEqual(body);
  });

  it('refuse un code inconnu ou un sceneId qui n’est pas un UUID', () => {
    expect(
      TourValidationResponseSchema.safeParse({
        issues: [{ code: 'NOT_A_CODE', message: 'inconnu' }],
      }).success,
    ).toBe(false);
    expect(
      TourValidationResponseSchema.safeParse({
        issues: [
          {
            code: ValidationIssueCode.SCENE_UNREACHABLE,
            sceneId: 'remparts',
            message: 'Cette scène est inatteignable depuis la scène de départ.',
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('paginated', () => {
  const cityPage = {
    items: [{ id: id.city, ...city }],
    page: 1,
    pageSize: 20,
    total: 1,
  };

  it('décrit une page d’éléments', () => {
    const parsed: Paginated<CityResponse> = paginated(CityResponseSchema).parse(cityPage);
    expect(parsed).toEqual(cityPage);
  });

  it('refuse un total négatif', () => {
    expect(paginated(CityResponseSchema).safeParse({ ...cityPage, total: -1 }).success).toBe(false);
  });
});

describe('AssetUploadRequestSchema', () => {
  it('accepte une requête d\'upload valide', () => {
    const req = {
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1048576,
      filename: 'photo.jpg',
    };
    expect(AssetUploadRequestSchema.parse(req)).toEqual(req);
  });

  it('refuse une taille de 0', () => {
    const req = {
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 0,
      filename: 'photo.jpg',
    };
    expect(AssetUploadRequestSchema.safeParse(req).success).toBe(false);
  });

  it('refuse un nom de fichier vide', () => {
    const req = {
      kind: AssetKind.PANORAMA,
      mimeType: 'image/jpeg',
      sizeBytes: 1048576,
      filename: '',
    };
    expect(AssetUploadRequestSchema.safeParse(req).success).toBe(false);
  });
});

describe('AssetUploadResponseSchema', () => {
  it('accepte une réponse d\'upload valide', () => {
    const res = {
      assetId: id.media,
      uploadUrl: 'https://minio.local/bucket/obj',
      uploadMethod: 'PUT' as const,
      expiresInSeconds: 3600,
    };
    expect(AssetUploadResponseSchema.parse(res)).toEqual(res);
  });

  it('refuse une méthode d\'upload différente de PUT', () => {
    const res = {
      assetId: id.media,
      uploadUrl: 'https://minio.local/bucket/obj',
      uploadMethod: 'POST',
      expiresInSeconds: 3600,
    };
    expect(AssetUploadResponseSchema.safeParse(res).success).toBe(false);
  });
});

describe('TourLinkMapSchema', () => {
  it('accepte une carte valide', () => {
    const map = {
      nodes: [
        { id: id.scene, kind: 'scene' as const, label: 'Entrée', isStart: true, orphan: false },
        { id: `tour:${id.tour}`, kind: 'external' as const, label: 'Autre visite', isStart: false, orphan: false }
      ],
      edges: [
        { id: id.hotspot, source: id.scene, target: `tour:${id.tour}`, kind: 'tour_link' as const }
      ]
    };
    expect(TourLinkMapSchema.parse(map)).toEqual(map);
  });

  it('refuse un kind de nœud invalide', () => {
    const map = {
      nodes: [
        { id: id.scene, kind: 'invalid', label: 'Entrée', isStart: true, orphan: false },
      ],
      edges: []
    };
    expect(TourLinkMapSchema.safeParse(map).success).toBe(false);
  });

  it('refuse un kind d\'arête invalide', () => {
    const map = {
      nodes: [
        { id: id.scene, kind: 'scene' as const, label: 'Entrée', isStart: true, orphan: false },
      ],
      edges: [
        { id: id.hotspot, source: id.scene, target: id.scene, kind: 'invalid' }
      ]
    };
    expect(TourLinkMapSchema.safeParse(map).success).toBe(false);
  });
});
