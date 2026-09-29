import { describe, expect, it } from 'vitest';

import {
  AssetKind,
  CategoryCreateSchema,
  CategoryResponseSchema,
  CategoryUpdateSchema,
  CityCreateSchema,
  CityResponseSchema,
  CityUpdateSchema,
  HotspotCreateSchema,
  HotspotIcon,
  HotspotType,
  PaginatedTourResponseSchema,
  PaginationQuerySchema,
  ProcessingStatus,
  SceneCreateSchema,
  SceneUpdateSchema,
  TourCreateSchema,
  TourListQuerySchema,
  TourResponseSchema,
  TourStatus,
  TourUpdateSchema,
  ValidationIssueCode,
  paginated,
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
  it('accepte le même corps qu’une création', () => {
    expect(TourUpdateSchema.parse(tour)).toEqual(tour);
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
};

describe('TourResponseSchema', () => {
  it('renvoie la visite, son statut et le nombre de scènes', () => {
    expect(TourResponseSchema.parse(tourResponse)).toEqual(tourResponse);
  });

  it('refuse un jeton de partage qui n’a pas 22 caractères', () => {
    expect(TourResponseSchema.safeParse({ ...tourResponse, shareToken: 'court' }).success).toBe(
      false,
    );
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
