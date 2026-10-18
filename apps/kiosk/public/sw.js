/* global self, caches, fetch */
/**
 * Service Worker Xplor Kiosque (M5 F-62)
 *
 * Écrit à la main, sans bibliothèque externe (D-126).
 *
 * Rôles :
 * 1. Précache le shell de l'application (index.html, styles, manifest, icône).
 * 2. Répond en Cache-First aux requêtes ciblant les ressources de visites
 *    mises en cache par tour-cache.ts (caches nommés `tour-<id>`).
 * 3. Pour toutes les autres requêtes GET (shell, navigation, assets), répond
 *    via le Réseau avec repli sur le cache en cas de perte de connexion (Network-First).
 * 4. Préserve scrupuleusement les caches de visites `tour-<id>` lors des nettoyages.
 */

const SHELL_CACHE_NAME = 'kiosk-shell-v1';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

/**
 * Extrait par regex les URLs des <script src> et <link rel="stylesheet" href> depuis une chaîne HTML.
 * @param {string} html
 * @returns {string[]}
 */
function extractAssetUrlsFromHtml(html) {
  if (typeof html !== 'string' || !html) {
    return [];
  }
  const urls = [];

  // Extraire les scripts : <script ... src="..." ...>
  const scriptRegex = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const src = scriptMatch[1].trim();
    if (src && !urls.includes(src)) {
      urls.push(src);
    }
  }

  // Extraire les feuilles de style : <link ... rel="stylesheet" ... href="..." ...> (dans n'importe quel ordre d'attributs)
  const linkRegex = /<link\b[^>]*>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const linkTag = linkMatch[0];
    if (/\brel\s*=\s*["'][^"']*\bstylesheet\b[^"']*["']/i.test(linkTag)) {
      const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(linkTag);
      if (hrefMatch && hrefMatch[1]) {
        const href = hrefMatch[1].trim();
        if (href && !urls.includes(href)) {
          urls.push(href);
        }
      }
    }
  }

  return urls;
}

// Exposer la fonction pure pour les tests (Node.js / Vitest / ServiceWorker)
if (typeof self !== 'undefined') {
  self.extractAssetUrlsFromHtml = extractAssetUrlsFromHtml;
}
if (typeof globalThis !== 'undefined') {
  globalThis.extractAssetUrlsFromHtml = extractAssetUrlsFromHtml;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then(async (cache) => {
        let extractedUrls = [];
        try {
          const indexResponse = await fetch('/index.html');
          if (indexResponse.ok) {
            await cache.put('/index.html', indexResponse.clone());
            const html = await indexResponse.text();
            extractedUrls = extractAssetUrlsFromHtml(html);
          }
        } catch {
          // Échec ponctuel toléré lors de la récupération d'index.html
        }

        const assetsToPrecache = Array.from(
          new Set([...STATIC_SHELL_ASSETS, ...extractedUrls]),
        );

        await Promise.all(
          assetsToPrecache.map(async (assetUrl) => {
            try {
              const response = await fetch(assetUrl);
              if (response.ok) {
                await cache.put(assetUrl, response);
              }
            } catch {
              // Ignore les échecs ponctuels sur les assets individuels
            }
          }),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (cacheNames) => {
        await Promise.all(
          cacheNames.map((name) => {
            // Supprimer uniquement les anciens caches de shell, JAMAIS les caches tour-<id>
            if (name.startsWith('kiosk-shell-') && name !== SHELL_CACHE_NAME) {
              return caches.delete(name);
            }
            return Promise.resolve();
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

/**
 * Recherche une réponse dans les caches de visites `tour-<id>`.
 * Les caches staging `tour-<id>-staging` sont ignorés car non finalisés.
 */
async function matchTourCaches(request) {
  try {
    const allCacheNames = await caches.keys();
    const committedTourCaches = allCacheNames.filter(
      (name) => name.startsWith('tour-') && !name.endsWith('-staging'),
    );
    for (const cacheName of committedTourCaches) {
      const cache = await caches.open(cacheName);
      const matched = await cache.match(request);
      if (matched) {
        return matched;
      }
    }
  } catch {
    // Tolérance aux erreurs d'accès au cache
  }
  return null;
}

/**
 * Stratégie réseau avec repli sur le cache (Network-First).
 */
async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (request.mode === 'navigate') {
      const shellCache = await caches.open(SHELL_CACHE_NAME);
      const fallback =
        (await shellCache.match('/index.html')) ||
        (await shellCache.match('/')) ||
        (await caches.match('/index.html')) ||
        (await caches.match('/'));
      if (fallback) {
        return fallback;
      }
    }
    throw new Error(`Hors-ligne : ressource non disponible en cache (${request.url})`);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  event.respondWith(
    (async () => {
      // 1. Visites en cache (tour-<id>) -> Cache-First
      const tourMatch = await matchTourCaches(request);
      if (tourMatch) {
        return tourMatch;
      }

      // 2. Autres requêtes -> Réseau avec repli sur le cache
      return networkWithCacheFallback(request);
    })(),
  );
});
