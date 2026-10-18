import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { z } from '@xplor/shared';
import { describe, expect, it } from 'vitest';

const WebManifestSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  display: z.string(),
  theme_color: z.string(),
  icons: z.array(
    z.object({
      src: z.string(),
      type: z.string(),
      sizes: z.string().optional(),
      purpose: z.string().optional(),
    }),
  ),
});

interface MockCache {
  readonly put: (request: string | Request, response: Response) => Promise<void>;
  readonly match: (request: string | Request) => Promise<Response | undefined>;
  readonly entries: () => Map<string, Response>;
}

interface MockServiceWorkerScope {
  readonly self: Record<string, unknown>;
  readonly extractAssetUrlsFromHtml?: (html: string) => string[];
  readonly getListeners: (type: string) => Array<(event: unknown) => void>;
}

interface MockInstallEvent {
  readonly waitUntil: (promise: Promise<unknown>) => void;
  readonly getPromise: () => Promise<unknown>;
}

interface MockFetchEvent {
  readonly request:
    | Request
    | { readonly url: string; readonly method: string; readonly mode?: string };
  readonly respondWith: (promise: Promise<Response>) => void;
  readonly getResponsePromise: () => Promise<Response> | undefined;
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function isAssetExtractor(value: unknown): value is (html: string) => string[] {
  return typeof value === 'function';
}

function createMockCache(): MockCache {
  const store = new Map<string, Response>();
  return {
    put: (request: string | Request, response: Response): Promise<void> => {
      const url = typeof request === 'string' ? request : request.url;
      store.set(url, response);
      return Promise.resolve();
    },
    match: (request: string | Request): Promise<Response | undefined> => {
      const url = typeof request === 'string' ? request : request.url;
      return Promise.resolve(store.get(url));
    },
    entries: (): Map<string, Response> => store,
  };
}

function createInstallEvent(): MockInstallEvent {
  let innerPromise: Promise<unknown> = Promise.resolve();
  return {
    waitUntil: (promise: Promise<unknown>): void => {
      innerPromise = promise;
    },
    getPromise: (): Promise<unknown> => innerPromise,
  };
}

function createFetchEvent(
  request:
    | Request
    | { readonly url: string; readonly method: string; readonly mode?: string },
): MockFetchEvent {
  let responsePromise: Promise<Response> | undefined;
  return {
    request,
    respondWith: (promise: Promise<Response>): void => {
      responsePromise = promise;
    },
    getResponsePromise: (): Promise<Response> | undefined => responsePromise,
  };
}

function loadSwContext(
  swCode: string,
  cacheRegistry: Map<string, MockCache>,
  fetchMock: (input: string | Request) => Promise<Response>,
): MockServiceWorkerScope {
  const listeners = new Map<string, Array<(event: unknown) => void>>();

  const mockCaches = {
    open: (name: string): Promise<MockCache> => {
      const existing = cacheRegistry.get(name);
      if (existing) {
        return Promise.resolve(existing);
      }
      const created = createMockCache();
      cacheRegistry.set(name, created);
      return Promise.resolve(created);
    },
    keys: (): Promise<string[]> => Promise.resolve(Array.from(cacheRegistry.keys())),
    delete: (name: string): Promise<boolean> =>
      Promise.resolve(cacheRegistry.delete(name)),
    match: async (request: string | Request): Promise<Response | undefined> => {
      for (const cache of cacheRegistry.values()) {
        const found = await cache.match(request);
        if (found) {
          return found;
        }
      }
      return undefined;
    },
  };

  const selfObj: Record<string, unknown> = {
    skipWaiting: (): Promise<void> => Promise.resolve(),
    clients: {
      claim: (): Promise<void> => Promise.resolve(),
    },
  };

  const sandbox: Record<string, unknown> = {
    self: selfObj,
    caches: mockCaches,
    fetch: fetchMock,
    addEventListener: (type: string, listener: (event: unknown) => void): void => {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
  };

  selfObj.addEventListener = sandbox.addEventListener;

  vm.createContext(sandbox);
  vm.runInContext(swCode, sandbox);

  const rawExtractor = selfObj.extractAssetUrlsFromHtml;
  const extractor = isAssetExtractor(rawExtractor) ? rawExtractor : undefined;

  return {
    self: selfObj,
    extractAssetUrlsFromHtml: extractor,
    getListeners: (type: string): Array<(event: unknown) => void> =>
      listeners.get(type) ?? [],
  };
}

describe('PWA Manifest & Service Worker (M5 F-62)', () => {
  const kioskDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(kioskDir, 'public', 'manifest.webmanifest');
  const swPath = path.join(kioskDir, 'public', 'sw.js');
  const iconPath = path.join(kioskDir, 'public', 'icon.svg');
  const htmlPath = path.join(kioskDir, 'index.html');

  describe('manifest.webmanifest', () => {
    it('existe et contient une configuration PWA conforme', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      const manifest = WebManifestSchema.parse(parsed);

      expect(manifest.name).toBe('Xplor Kiosque');
      expect(manifest.short_name).toBe('Xplor Kiosque');
      expect(manifest.display).toBe('fullscreen');
      expect(manifest.theme_color).toBe('#6958A5');
      expect(manifest.icons.length).toBeGreaterThan(0);

      const svgIcon = manifest.icons.find((icon) => icon.src === '/icon.svg');
      expect(svgIcon).toBeDefined();
      expect(svgIcon?.type).toBe('image/svg+xml');
      expect(svgIcon?.purpose).toBe('any');
    });

    it('fait référence à icon.svg qui existe et est un SVG valide', () => {
      expect(fs.existsSync(iconPath)).toBe(true);
      const iconContent = fs.readFileSync(iconPath, 'utf-8');
      expect(iconContent.trim().startsWith('<svg')).toBe(true);
      expect(iconContent.includes('</svg>')).toBe(true);
      expect(iconContent.includes('#6958A5')).toBe(true);
    });

    it('est lié dans apps/kiosk/index.html', () => {
      expect(fs.existsSync(htmlPath)).toBe(true);
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      expect(htmlContent).toContain('rel="manifest"');
      expect(htmlContent).toContain('/manifest.webmanifest');
      expect(htmlContent).toContain('name="theme-color"');
      expect(htmlContent).toContain('#6958A5');
    });
  });

  describe('sw.js - Analyse statique', () => {
    it('est écrit à la main sans dépendance Workbox', () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const swCode = fs.readFileSync(swPath, 'utf-8');

      // 1. Absence de Workbox (D-126)
      expect(swCode.toLowerCase()).not.toContain('workbox');

      // 2. Écouteurs Service Worker
      expect(swCode).toContain("addEventListener('install'");
      expect(swCode).toContain("addEventListener('activate'");
      expect(swCode).toContain("addEventListener('fetch'");

      // 3. Cache kiosk-shell-v1 et exclusion de /src/style.css de la liste fixe
      expect(swCode).toContain("'kiosk-shell-v1'");
      expect(swCode).toContain("'/index.html'");
      expect(swCode).toContain("'/manifest.webmanifest'");
      expect(swCode).toContain("'/icon.svg'");
      expect(swCode).not.toContain("'/src/style.css'");

      // 4. Stratégie Cache-First pour les caches de visite tour-<id>
      expect(swCode).toContain('matchTourCaches');
      expect(swCode).toContain("name.startsWith('tour-')");
      expect(swCode).toContain("!name.endsWith('-staging')");

      // 5. Stratégie réseau avec repli sur le cache (Network-First)
      expect(swCode).toContain('networkWithCacheFallback');
    });

    it('préserve les caches tour-<id> lors de l’activation', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      expect(swCode).toContain("name.startsWith('kiosk-shell-')");
      expect(swCode).toContain('SHELL_CACHE_NAME');
      expect(swCode).not.toContain("caches.delete('tour-");
    });
  });

  describe('extractAssetUrlsFromHtml - Fonction pure', () => {
    it('expose la fonction pure d’extraction sur self et globalThis', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );

      expect(swContext.extractAssetUrlsFromHtml).toBeDefined();
      expect(isFunction(swContext.extractAssetUrlsFromHtml)).toBe(true);
    });

    it('extrait les scripts src et link rel="stylesheet" href d’un HTML de production', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const extract = swContext.extractAssetUrlsFromHtml;
      expect(extract).toBeDefined();

      if (extract) {
        const prodHtml = `
          <!doctype html>
          <html>
            <head>
              <link rel="manifest" href="/manifest.webmanifest" />
              <link rel="icon" type="image/svg+xml" href="/icon.svg" />
              <script type="module" crossorigin src="/assets/index-cf-vQhcq.js"></script>
              <link rel="stylesheet" crossorigin href="/assets/index-CM62zbaP.css">
            </head>
            <body></body>
          </html>
        `;

        const extracted = extract(prodHtml);
        expect(extracted).toContain('/assets/index-cf-vQhcq.js');
        expect(extracted).toContain('/assets/index-CM62zbaP.css');
        // Doit ignorer le manifest et l'icône dans l'extraction dynamique (déjà dans STATIC_SHELL_ASSETS)
        expect(extracted).not.toContain('/manifest.webmanifest');
        expect(extracted).not.toContain('/icon.svg');
      }
    });

    it('extrait les balises <script type="module" src="/assets/index-abc.js"> et <link rel="stylesheet" href="/assets/index-abc.css">', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const extract = swContext.extractAssetUrlsFromHtml;
      expect(extract).toBeDefined();

      if (extract) {
        const html = `
          <!doctype html>
          <html>
            <head>
              <script type="module" src="/assets/index-abc.js"></script>
              <link rel="stylesheet" href="/assets/index-abc.css">
            </head>
            <body></body>
          </html>
        `;

        const extracted = extract(html);
        expect(extracted).toContain('/assets/index-abc.js');
        expect(extracted).toContain('/assets/index-abc.css');
        expect(extracted).not.toContain('/src/style.css');
      }
    });

    it('gère l’inversion de l’ordre des attributs rel et href', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const extract = swContext.extractAssetUrlsFromHtml;

      if (extract) {
        const html = `
          <link href="/assets/style-reversed.css" rel="stylesheet" />
          <script async src='/assets/vendor.js'></script>
        `;

        const extracted = extract(html);
        expect(extracted).toContain('/assets/style-reversed.css');
        expect(extracted).toContain('/assets/vendor.js');
      }
    });

    it('ignore les scripts inline et déduplique les doublons', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const extract = swContext.extractAssetUrlsFromHtml;

      if (extract) {
        const html = `
          <script>console.log("inline script sans src");</script>
          <script src="/assets/dup.js"></script>
          <script src="/assets/dup.js"></script>
          <link rel="stylesheet" href="/assets/dup.css" />
          <link rel="stylesheet" href="/assets/dup.css" />
        `;

        const extracted = extract(html);
        expect(extracted).toEqual(['/assets/dup.js', '/assets/dup.css']);
      }
    });

    it('renvoie un tableau vide pour un contenu vide ou non textuel', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const extract = swContext.extractAssetUrlsFromHtml;

      if (extract) {
        expect(extract('')).toEqual([]);
        expect(extract('<div>Pas de scripts ni styles</div>')).toEqual([]);
      }
    });
  });

  describe('Cycle de vie du Service Worker', () => {
    it('à l’installation : fetch /index.html, extrait les assets hachés et précache le shell', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      const mockIndexHtml = `
        <!doctype html>
        <html>
          <head>
            <script type="module" crossorigin src="/assets/main-hash123.js"></script>
            <link rel="stylesheet" crossorigin href="/assets/style-hash456.css">
          </head>
        </html>
      `;

      const fetchedUrls: string[] = [];

      const fetchMock = (input: string | Request): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.url;
        fetchedUrls.push(url);
        if (url === '/index.html') {
          return Promise.resolve(
            new Response(mockIndexHtml, { status: 200, statusText: 'OK' }),
          );
        }
        return Promise.resolve(
          new Response('dummy-content', { status: 200, statusText: 'OK' }),
        );
      };

      const swContext = loadSwContext(swCode, cacheRegistry, fetchMock);
      const installListeners = swContext.getListeners('install');
      expect(installListeners.length).toBeGreaterThan(0);

      const installEvent = createInstallEvent();
      const listener = installListeners[0];
      if (listener) {
        listener(installEvent);
      }

      await installEvent.getPromise();

      // Vérifie que /index.html a été lu pour extraire les assets
      expect(fetchedUrls).toContain('/index.html');
      expect(fetchedUrls).toContain('/assets/main-hash123.js');
      expect(fetchedUrls).toContain('/assets/style-hash456.css');
      expect(fetchedUrls).toContain('/');
      expect(fetchedUrls).toContain('/manifest.webmanifest');
      expect(fetchedUrls).toContain('/icon.svg');

      // Vérifie le contenu du cache kiosk-shell-v1
      const shellCache = cacheRegistry.get('kiosk-shell-v1');
      expect(shellCache).toBeDefined();
      if (shellCache) {
        const cachedKeys = Array.from(shellCache.entries().keys());
        expect(cachedKeys).toContain('/index.html');
        expect(cachedKeys).toContain('/assets/main-hash123.js');
        expect(cachedKeys).toContain('/assets/style-hash456.css');
        expect(cachedKeys).toContain('/manifest.webmanifest');
        expect(cachedKeys).toContain('/icon.svg');
      }
    });

    it('à l’installation : avec <script type="module" src="/assets/index-abc.js"> et <link rel="stylesheet" href="/assets/index-abc.css"> dans index.html, précache ces deux assets avec index.html, le manifeste et l’icône, et exclut /src/style.css', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      const mockIndexHtml = `
        <!doctype html>
        <html>
          <head>
            <script type="module" src="/assets/index-abc.js"></script>
            <link rel="stylesheet" href="/assets/index-abc.css">
          </head>
          <body></body>
        </html>
      `;

      const fetchedUrls: string[] = [];

      const fetchMock = (input: string | Request): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.url;
        fetchedUrls.push(url);
        if (url === '/index.html') {
          return Promise.resolve(
            new Response(mockIndexHtml, { status: 200, statusText: 'OK' }),
          );
        }
        return Promise.resolve(
          new Response('dummy-content', { status: 200, statusText: 'OK' }),
        );
      };

      const swContext = loadSwContext(swCode, cacheRegistry, fetchMock);
      const installListeners = swContext.getListeners('install');
      expect(installListeners.length).toBeGreaterThan(0);

      const installEvent = createInstallEvent();
      const listener = installListeners[0];
      if (listener) {
        listener(installEvent);
      }

      await installEvent.getPromise();

      // Vérifie les assets requis précachés
      expect(fetchedUrls).toContain('/index.html');
      expect(fetchedUrls).toContain('/manifest.webmanifest');
      expect(fetchedUrls).toContain('/icon.svg');
      expect(fetchedUrls).toContain('/assets/index-abc.js');
      expect(fetchedUrls).toContain('/assets/index-abc.css');

      // Vérifie que /src/style.css n'est pas précaché ni demandé
      expect(fetchedUrls).not.toContain('/src/style.css');

      // Vérifie le contenu du cache kiosk-shell-v1
      const shellCache = cacheRegistry.get('kiosk-shell-v1');
      expect(shellCache).toBeDefined();
      if (shellCache) {
        const cachedKeys = Array.from(shellCache.entries().keys());
        expect(cachedKeys).toContain('/index.html');
        expect(cachedKeys).toContain('/manifest.webmanifest');
        expect(cachedKeys).toContain('/icon.svg');
        expect(cachedKeys).toContain('/assets/index-abc.js');
        expect(cachedKeys).toContain('/assets/index-abc.css');
        expect(cachedKeys).not.toContain('/src/style.css');
      }
    });

    it('tolère un échec ponctuel lors du précache sans rejeter l’installation', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      const fetchMock = (input: string | Request): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.url;
        if (url === '/icon.svg') {
          return Promise.reject(new Error('Erreur réseau simulée sur icon.svg'));
        }
        return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
      };

      const swContext = loadSwContext(swCode, cacheRegistry, fetchMock);
      const installListeners = swContext.getListeners('install');
      const installEvent = createInstallEvent();

      const listener = installListeners[0];
      if (listener) {
        listener(installEvent);
      }

      await expect(installEvent.getPromise()).resolves.not.toThrow();
    });

    it('à l’activation : supprime les anciens shells kiosk-shell-* sans toucher aux tour-*', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      // Caches préexistants
      cacheRegistry.set('kiosk-shell-v0', createMockCache());
      cacheRegistry.set('kiosk-shell-v1', createMockCache());
      cacheRegistry.set('tour-rabat-oudayas', createMockCache());
      cacheRegistry.set('tour-marrakech-medina', createMockCache());

      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const activateListeners = swContext.getListeners('activate');
      expect(activateListeners.length).toBeGreaterThan(0);

      const activateEvent = createInstallEvent();
      const listener = activateListeners[0];
      if (listener) {
        listener(activateEvent);
      }

      await activateEvent.getPromise();

      // L'ancien shell v0 est supprimé, le v1 est conservé
      expect(cacheRegistry.has('kiosk-shell-v0')).toBe(false);
      expect(cacheRegistry.has('kiosk-shell-v1')).toBe(true);

      // Les caches de visite sont strictement préservés
      expect(cacheRegistry.has('tour-rabat-oudayas')).toBe(true);
      expect(cacheRegistry.has('tour-marrakech-medina')).toBe(true);
    });

    it('intercepte en Cache-First les requêtes des visites tour-* (hors -staging)', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      // Préparation du cache de visite tour-xyz
      const tourCache = createMockCache();
      const cachedPanoResponse = new Response('cached-panorama-content', { status: 200 });
      await tourCache.put('https://media.xplor.ma/tours/123/pano.jpg', cachedPanoResponse);
      cacheRegistry.set('tour-123', tourCache);

      // Préparation d'un cache staging non finalisé
      const stagingCache = createMockCache();
      await stagingCache.put(
        'https://media.xplor.ma/tours/staging/pano.jpg',
        new Response('staging-content', { status: 200 }),
      );
      cacheRegistry.set('tour-staging-id-staging', stagingCache);

      let networkCalled = false;
      const fetchMock = (): Promise<Response> => {
        networkCalled = true;
        return Promise.resolve(new Response('network-response', { status: 200 }));
      };

      const swContext = loadSwContext(swCode, cacheRegistry, fetchMock);
      const fetchListeners = swContext.getListeners('fetch');
      expect(fetchListeners.length).toBeGreaterThan(0);

      // 1. Requête ciblant une ressource dans tour-123 -> Doit renvoyer le cache SANS toucher au réseau
      const fetchEvent1 = createFetchEvent(
        new Request('https://media.xplor.ma/tours/123/pano.jpg', { method: 'GET' }),
      );

      const listener = fetchListeners[0];
      if (listener) {
        listener(fetchEvent1);
      }

      const responsePromise1 = fetchEvent1.getResponsePromise();
      expect(responsePromise1).toBeDefined();
      if (responsePromise1 !== undefined) {
        const res = await responsePromise1;
        const text = await res.text();
        expect(text).toBe('cached-panorama-content');
        expect(networkCalled).toBe(false);
      }

      // 2. Requête ciblant un cache -staging -> Ne doit PAS être servie par matchTourCaches
      const fetchEvent2 = createFetchEvent(
        new Request('https://media.xplor.ma/tours/staging/pano.jpg', { method: 'GET' }),
      );

      if (listener) {
        listener(fetchEvent2);
      }

      const responsePromise2 = fetchEvent2.getResponsePromise();
      expect(responsePromise2).toBeDefined();
      if (responsePromise2 !== undefined) {
        const res = await responsePromise2;
        const text = await res.text();
        expect(text).toBe('network-response');
        expect(networkCalled).toBe(true);
      }
    });

    it('intercepte en Network-First avec repli sur cache pour les autres requêtes GET', async () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();

      // Shell cache avec fallback
      const shellCache = createMockCache();
      await shellCache.put('/index.html', new Response('offline-shell', { status: 200 }));
      await shellCache.put(
        'https://kiosk.xplor.ma/assets/app.js',
        new Response('cached-app-js', { status: 200 }),
      );
      cacheRegistry.set('kiosk-shell-v1', shellCache);

      // Cas hors-ligne : fetch rejette
      const offlineFetch = (): Promise<Response> =>
        Promise.reject(new TypeError('Failed to fetch (offline)'));

      const swContext = loadSwContext(swCode, cacheRegistry, offlineFetch);
      const fetchListeners = swContext.getListeners('fetch');
      const listener = fetchListeners[0];

      // Requête asset hors-ligne -> repli sur le cache
      const assetEvent = createFetchEvent(
        new Request('https://kiosk.xplor.ma/assets/app.js', { method: 'GET' }),
      );

      if (listener) {
        listener(assetEvent);
      }

      const assetPromise = assetEvent.getResponsePromise();
      expect(assetPromise).toBeDefined();
      if (assetPromise !== undefined) {
        const res = await assetPromise;
        const text = await res.text();
        expect(text).toBe('cached-app-js');
      }

      // Requête de navigation hors-ligne -> repli sur /index.html
      const navEvent = createFetchEvent({
        url: 'https://kiosk.xplor.ma/autre-page',
        method: 'GET',
        mode: 'navigate',
      });

      if (listener) {
        listener(navEvent);
      }

      const navPromise = navEvent.getResponsePromise();
      expect(navPromise).toBeDefined();
      if (navPromise !== undefined) {
        const res = await navPromise;
        const text = await res.text();
        expect(text).toBe('offline-shell');
      }
    });

    it('ne modifie pas les requêtes non-GET ni les protocoles non-http(s)', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      const cacheRegistry = new Map<string, MockCache>();
      const swContext = loadSwContext(
        swCode,
        cacheRegistry,
        () => Promise.resolve(new Response('')),
      );
      const fetchListeners = swContext.getListeners('fetch');
      const listener = fetchListeners[0];

      let postResponded = false;
      const postEvent = {
        request: new Request('https://api.xplor.ma/kiosks/heartbeat', { method: 'POST' }),
        respondWith: (): void => {
          postResponded = true;
        },
      };

      if (listener) {
        listener(postEvent);
      }
      expect(postResponded).toBe(false);

      let dataResponded = false;
      const dataEvent = {
        request: {
          method: 'GET',
          url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        },
        respondWith: (): void => {
          dataResponded = true;
        },
      };

      if (listener) {
        listener(dataEvent);
      }
      expect(dataResponded).toBe(false);
    });
  });
});
