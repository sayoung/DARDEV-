import { HotspotIcon, HotspotType, TourGraphSchema, type Lang, type TourGraph } from '@xplor/shared';
import { TourLoadError, TourNotFoundError } from '@xplor/viewer-core';
import { describe, expect, it } from 'vitest';

import { collectUrlsFromTourGraph, createUrlsForTour } from './urls-for-tour.js';

function createSampleGraph(): TourGraph {
  return TourGraphSchema.parse({
    id: '01990000-0000-7000-8000-000000000100',
    contentVersion: 1,
    lang: 'fr',
    title: 'Visite de démonstration',
    summary: 'Une superbe visite pour tester la collecte des URLs',
    city: 'Rabat',
    categories: ['Patrimoine', 'Monuments'],
    coverUrl: 'https://media.test/tours/tour-1/cover.jpg',
    practicalInfo: 'Ouvert tous les jours.',
    location: { lat: 34.02, lng: -6.83 },
    startSceneId: 'scene-1',
    scenes: [
      {
        id: 'scene-1',
        title: 'Entrée principale',
        caption: 'La porte Bab',
        panorama: {
          preview: 'https://media.test/tours/tour-1/scene-1/preview.jpg',
          web: 'https://media.test/tours/tour-1/scene-1/web.jpg',
          tiles: {
            width: 8192,
            cols: 2,
            rows: 2,
            baseUrl: 'https://media.test/tours/tour-1/scene-1/tiles/{col}_{row}.jpg',
          },
        },
        initialView: { yaw: 0.1, pitch: -0.05, zoom: 50 },
        narrationUrl: 'https://media.test/tours/tour-1/scene-1/narration.mp3',
        ambientUrl: 'https://media.test/shared/wind.mp3',
        thumb: 'https://media.test/tours/tour-1/scene-1/thumb.jpg',
        hotspots: [
          {
            id: 'h-info-1',
            type: HotspotType.INFO,
            yaw: 0.4,
            pitch: 0.1,
            label: 'Détail de la voûte',
            icon: HotspotIcon.INFO,
            bodyHtml: '<p>Sculpture en pierre.</p>',
            images: [
              'https://media.test/tours/tour-1/hotspots/voute-1.jpg',
              'https://media.test/tours/tour-1/hotspots/voute-2.jpg',
            ],
          },
          {
            id: 'h-media-1',
            type: HotspotType.MEDIA,
            yaw: -0.8,
            pitch: 0.2,
            label: 'Vidéo historique',
            icon: HotspotIcon.PLAY,
            media: [
              {
                url: 'https://media.test/tours/tour-1/hotspots/video.mp4',
                mimeType: 'video/mp4',
              },
            ],
          },
          {
            id: 'h-link-scene',
            type: HotspotType.SCENE_LINK,
            yaw: 1.2,
            pitch: 0.0,
            label: 'Vers la cour',
            icon: HotspotIcon.ARROW,
            targetSceneId: 'scene-2',
          },
        ],
      },
      {
        id: 'scene-2',
        title: 'Cour intérieure',
        caption: null,
        panorama: {
          preview: 'https://media.test/tours/tour-1/scene-2/preview.jpg',
          web: 'https://media.test/tours/tour-1/scene-2/web.jpg',
          tiles: {
            width: 4096,
            cols: 1,
            rows: 2,
            baseUrl: 'https://media.test/tours/tour-1/scene-2/tiles/{col}_{row}.jpg',
          },
        },
        initialView: { yaw: 0.0, pitch: 0.0, zoom: 45 },
        narrationUrl: null,
        ambientUrl: 'https://media.test/shared/wind.mp3', // doublon volontaire avec scene-1
        thumb: 'https://media.test/tours/tour-1/scene-2/thumb.jpg',
        hotspots: [
          {
            id: 'h-link-tour',
            type: HotspotType.TOUR_LINK,
            yaw: -1.5,
            pitch: 0.0,
            label: 'Vers le jardin',
            icon: HotspotIcon.PORTAL,
            targetTourId: '01990000-0000-7000-8000-000000000200',
          },
          {
            id: 'h-external-url',
            type: HotspotType.URL,
            yaw: 0.5,
            pitch: 0.2,
            label: 'Guide officiel',
            icon: HotspotIcon.INFO,
            url: 'https://monuments.test/guide',
          },
        ],
      },
    ],
    linkedTours: [],
  });
}

function createMinimalGraph(): TourGraph {
  return TourGraphSchema.parse({
    id: '01990000-0000-7000-8000-000000000101',
    contentVersion: 2,
    lang: 'fr',
    title: 'Visite minimale',
    summary: 'Sans cover ni audio',
    city: 'Rabat',
    categories: [],
    coverUrl: null,
    practicalInfo: null,
    location: null,
    startSceneId: 'scene-min',
    scenes: [
      {
        id: 'scene-min',
        title: 'Scène minimale',
        caption: null,
        panorama: {
          preview: 'https://media.test/min/preview.jpg',
          web: 'https://media.test/min/web.jpg',
          tiles: {
            width: 1024,
            cols: 0,
            rows: 0,
            baseUrl: '',
          },
        },
        initialView: { yaw: 0, pitch: 0, zoom: 50 },
        narrationUrl: null,
        ambientUrl: null,
        thumb: 'https://media.test/min/thumb.jpg',
        hotspots: [],
      },
    ],
    linkedTours: [],
  });
}

describe('collectUrlsFromTourGraph (M5 F-62 / F-61)', () => {
  it('extrait toutes les URLs d’une visite complète avec son manifeste', () => {
    const graph = createSampleGraph();
    const manifestUrl = 'https://api.test/api/v1/tours/01990000-0000-7000-8000-000000000100';

    const urls = collectUrlsFromTourGraph(graph, manifestUrl);

    // 1. URL du manifeste en tête
    expect(urls[0]).toBe(manifestUrl);

    // 2. Image de couverture de la visite
    expect(urls).toContain('https://media.test/tours/tour-1/cover.jpg');

    // 3. Panoramas et dalles de la scène 1 (2x2 = 4 tuiles)
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/preview.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/web.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/tiles/0_0.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/tiles/0_1.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/tiles/1_0.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/tiles/1_1.jpg');

    // 4. Médias de la scène 1 (vignette, narration, ambiance)
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/thumb.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/narration.mp3');
    expect(urls).toContain('https://media.test/shared/wind.mp3');

    // 5. Médias des hotspots de la scène 1 (images INFO, média MEDIA)
    expect(urls).toContain('https://media.test/tours/tour-1/hotspots/voute-1.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/hotspots/voute-2.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/hotspots/video.mp4');

    // 6. Panoramas et dalles de la scène 2 (1x2 = 2 tuiles)
    expect(urls).toContain('https://media.test/tours/tour-1/scene-2/preview.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-2/web.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-2/tiles/0_0.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-2/tiles/0_1.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-2/thumb.jpg');
  });

  it('dédoublonne les URLs partagées entre scènes et dans la visite', () => {
    const graph = createSampleGraph();
    const urls = collectUrlsFromTourGraph(graph);

    const windOccurrences = urls.filter((u) => u === 'https://media.test/shared/wind.mp3');
    expect(windOccurrences).toHaveLength(1);

    const uniqueSet = new Set(urls);
    expect(uniqueSet.size).toBe(urls.length);
  });

  it('ne contient aucune chaîne vide ou composée uniquement d’espaces', () => {
    const graph = createSampleGraph();
    const urls = collectUrlsFromTourGraph(graph, '   ');

    for (const url of urls) {
      expect(url.trim().length).toBeGreaterThan(0);
      expect(url).not.toBe('');
    }
  });

  it('fonctionne correctement sans URL de manifeste', () => {
    const graph = createSampleGraph();
    const urls = collectUrlsFromTourGraph(graph);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toBe('https://media.test/tours/tour-1/cover.jpg');
  });

  it('ignore une URL de manifeste non définie ou vide', () => {
    const graph = createSampleGraph();
    const urlsUndefined = collectUrlsFromTourGraph(graph, undefined);
    const urlsEmpty = collectUrlsFromTourGraph(graph, '');

    expect(urlsUndefined).toEqual(urlsEmpty);
    expect(urlsUndefined[0]).toBe('https://media.test/tours/tour-1/cover.jpg');
  });

  it('gère une visite avec des champs optionnels nuls ou vides', () => {
    const minimalGraph = createMinimalGraph();
    const urls = collectUrlsFromTourGraph(minimalGraph);

    expect(urls).toEqual([
      'https://media.test/min/thumb.jpg',
      'https://media.test/min/preview.jpg',
      'https://media.test/min/web.jpg',
    ]);
  });

  it('gère les dalles sans variables {col} et {row} dans baseUrl', () => {
    const graph = TourGraphSchema.parse({
      id: '01990000-0000-7000-8000-000000000102',
      contentVersion: 1,
      lang: 'fr',
      title: 'Dalles fixes',
      summary: 'Sans templates',
      city: 'Casablanca',
      categories: [],
      coverUrl: null,
      practicalInfo: null,
      location: null,
      startSceneId: 'scene-single',
      scenes: [
        {
          id: 'scene-single',
          title: 'Scène fixe',
          caption: null,
          panorama: {
            preview: 'https://media.test/fixed/preview.jpg',
            web: 'https://media.test/fixed/web.jpg',
            tiles: {
              width: 2048,
              cols: 2,
              rows: 2,
              baseUrl: 'https://media.test/fixed/single-pano.jpg',
            },
          },
          initialView: { yaw: 0, pitch: 0, zoom: 50 },
          narrationUrl: null,
          ambientUrl: null,
          thumb: 'https://media.test/fixed/thumb.jpg',
          hotspots: [],
        },
      ],
      linkedTours: [],
    });

    const urls = collectUrlsFromTourGraph(graph);

    expect(urls).toContain('https://media.test/fixed/single-pano.jpg');
  });

  it('n’extrait aucun média pour les hotspots de navigation (SCENE_LINK, TOUR_LINK) ou liens externes (URL)', () => {
    const graph = createSampleGraph();
    const urls = collectUrlsFromTourGraph(graph);

    expect(urls).not.toContain('scene-2');
    expect(urls).not.toContain('01990000-0000-7000-8000-000000000200');
    expect(urls).not.toContain('https://monuments.test/guide');
  });

  it('lève une erreur de validation Zod si les données de visite sont invalides', () => {
    const invalidData = {
      id: 'pas-un-vrai-graphe',
    };

    expect(() => {
      // @ts-expect-error test explicite d'entrée invalide sans conversion forcée
      collectUrlsFromTourGraph(invalidData);
    }).toThrow();
  });
});

function extractRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function createFakeFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): typeof fetch {
  const fake: typeof fetch = (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = extractRequestUrl(input);
    return Promise.resolve(handler(url, init));
  };
  return fake;
}

function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createUrlsForTour (M5 F-62 / F-61)', () => {
  it('télécharge le graphe via fetchTourGraph et renvoie toutes les URLs collectées (succès nominal)', async () => {
    const graph = createSampleGraph();
    const requestedUrls: string[] = [];
    const fetchFn = createFakeFetch((url) => {
      requestedUrls.push(url);
      return jsonResponse(graph);
    });

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    const urls = await urlsForTour('01990000-0000-7000-8000-000000000100');

    expect(requestedUrls).toEqual([
      'https://api.test/public/tours/01990000-0000-7000-8000-000000000100?lang=fr',
    ]);
    expect(urls).toEqual(collectUrlsFromTourGraph(graph));
    expect(urls).toContain('https://media.test/tours/tour-1/cover.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/preview.jpg');
    expect(urls).toContain('https://media.test/tours/tour-1/scene-1/tiles/0_0.jpg');
  });

  it('gère une baseUrl avec slash final', async () => {
    const graph = createSampleGraph();
    const requestedUrls: string[] = [];
    const fetchFn = createFakeFetch((url) => {
      requestedUrls.push(url);
      return jsonResponse(graph);
    });

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test/api/v1/',
      lang: () => 'fr',
      fetchFn,
    });

    await urlsForTour('tour-slash');

    expect(requestedUrls).toEqual([
      'https://api.test/api/v1/public/tours/tour-slash?lang=fr',
    ]);
  });

  it('inclut l’URL de manifeste lorsque manifestUrlFor renvoie une chaîne valide', async () => {
    const graph = createSampleGraph();
    const fetchFn = createFakeFetch(() => jsonResponse(graph));

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
      manifestUrlFor: (tourId) => `https://api.test/kiosk/manifests/${tourId}`,
    });

    const urls = await urlsForTour('01990000-0000-7000-8000-000000000100');

    expect(urls).toEqual(
      collectUrlsFromTourGraph(
        graph,
        'https://api.test/kiosk/manifests/01990000-0000-7000-8000-000000000100',
      ),
    );
  });

  it('gère manifestUrlFor renvoyant undefined', async () => {
    const graph = createSampleGraph();
    const fetchFn = createFakeFetch(() => jsonResponse(graph));

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
      manifestUrlFor: () => undefined,
    });

    const urls = await urlsForTour('01990000-0000-7000-8000-000000000100');

    expect(urls).toEqual(collectUrlsFromTourGraph(graph));
  });

  it('fonctionne correctement sans fournir le paramètre optionnel manifestUrlFor', async () => {
    const graph = createSampleGraph();
    const fetchFn = createFakeFetch(() => jsonResponse(graph));

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    const urls = await urlsForTour('01990000-0000-7000-8000-000000000100');

    expect(urls).toEqual(collectUrlsFromTourGraph(graph));
  });

  it('évalue la langue dynamiquement via lang() à chaque appel', async () => {
    const graph = createSampleGraph();
    const requestedUrls: string[] = [];
    const fetchFn = createFakeFetch((url) => {
      requestedUrls.push(url);
      return jsonResponse(graph);
    });

    let currentLang: Lang = 'fr';
    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => currentLang,
      fetchFn,
    });

    await urlsForTour('tour-lang');
    currentLang = 'ar';
    await urlsForTour('tour-lang');
    currentLang = 'en';
    await urlsForTour('tour-lang');

    expect(requestedUrls).toEqual([
      'https://api.test/public/tours/tour-lang?lang=fr',
      'https://api.test/public/tours/tour-lang?lang=ar',
      'https://api.test/public/tours/tour-lang?lang=en',
    ]);
  });

  it('propage l’erreur HTTP 404 comme TourNotFoundError', async () => {
    const fetchFn = createFakeFetch(
      () => new Response(null, { status: 404, statusText: 'Not Found' }),
    );

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    await expect(urlsForTour('missing-tour')).rejects.toThrow(TourNotFoundError);
  });

  it('propage une erreur HTTP 500 comme TourLoadError', async () => {
    const fetchFn = createFakeFetch(
      () =>
        new Response('Erreur interne', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
    );

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    await expect(urlsForTour('server-error-tour')).rejects.toThrow(TourLoadError);
    await expect(urlsForTour('server-error-tour')).rejects.toThrow(
      'Failed to fetch tour: 500 Internal Server Error',
    );
  });

  it('propage une erreur réseau lorsque fetchFn rejette', async () => {
    const fetchFn = createFakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    await expect(urlsForTour('network-error-tour')).rejects.toThrow(TourLoadError);
    await expect(urlsForTour('network-error-tour')).rejects.toThrow(
      'Network error: Failed to fetch',
    );
  });

  it('propage une erreur lorsque la réponse HTTP n’est pas du JSON valide', async () => {
    const fetchFn = createFakeFetch(
      () =>
        new Response('<html>not-json</html>', {
          status: 200,
          statusText: 'OK',
        }),
    );

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    await expect(urlsForTour('bad-json-tour')).rejects.toThrow(TourLoadError);
    await expect(urlsForTour('bad-json-tour')).rejects.toThrow('Invalid JSON response');
  });

  it('propage une erreur lorsque le payload JSON ne respecte pas TourGraphSchema', async () => {
    const fetchFn = createFakeFetch(() => jsonResponse({ invalid: 'payload' }));

    const urlsForTour = createUrlsForTour({
      baseUrl: 'https://api.test',
      lang: () => 'fr',
      fetchFn,
    });

    await expect(urlsForTour('invalid-schema-tour')).rejects.toThrow(TourLoadError);
    await expect(urlsForTour('invalid-schema-tour')).rejects.toThrow(/Invalid tour data/);
  });
});
