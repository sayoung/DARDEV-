import http from 'k6/http';
import { check } from 'k6';

// Lecture et validation des variables d'environnement
const env = typeof __ENV !== 'undefined' ? __ENV : {};
const rawBaseUrl = env.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');
const ADMIN_EMAIL = env.ADMIN_EMAIL ? env.ADMIN_EMAIL.trim() : '';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD ? env.ADMIN_PASSWORD : '';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    'Variables d\'environnement ADMIN_EMAIL et ADMIN_PASSWORD obligatoires. ' +
    'Exemple : k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=admin@xplor.local -e ADMIN_PASSWORD=xplor-seed-dev-2026 perf/k6/admin-api.js'
  );
}

// Préfixe global de l'API : /api/v1 (configuré dans apps/api/src/main.ts)
const apiPrefix = BASE_URL.endsWith('/api/v1') ? '' : '/api/v1';
const loginUrl = `${BASE_URL}${apiPrefix}/auth/login`;

// Endpoints de consultation des listes du back-office (GET en lecture seule) :
// 1. Visites virtuelles : ToursController.list (@Controller('admin/tours'), apps/api/src/catalog/tours.controller.ts)
// 2. Hôtels : HotelsController.list (@Controller('admin/hotels'), apps/api/src/hotels/hotels.controller.ts)
// 3. Kiosques : KiosksController.list (@Controller('admin/kiosks'), apps/api/src/kiosks/kiosks.controller.ts)
const toursUrl = `${BASE_URL}${apiPrefix}/admin/tours`;
const hotelsUrl = `${BASE_URL}${apiPrefix}/admin/hotels`;
const kiosksUrl = `${BASE_URL}${apiPrefix}/admin/kiosks`;

// Profil de test et seuils d'acceptation NF-03 (back-office : réponses API < 300 ms P95)
export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

/**
 * Phase d'initialisation k6 : exécutée UNE SEULE FOIS avant le tir de charge.
 *
 * L'endpoint POST /api/v1/auth/login est protégé par un ThrottlerGuard à 5 requêtes par minute
 * par IP (FIVE_PER_MINUTE dans apps/api/src/auth/auth.controller.ts).
 * La connexion ne doit donc JAMAIS être appelée dans la boucle des VU.
 * On effectue une unique authentification ici et on propage l'identifiant de session
 * (cookie xplor_sid) et le jeton CSRF à toutes les itérations des VU.
 */
export function setup() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'Variables d\'environnement ADMIN_EMAIL et ADMIN_PASSWORD obligatoires. ' +
      'Exemple : k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=admin@xplor.local -e ADMIN_PASSWORD=xplor-seed-dev-2026 perf/k6/admin-api.js'
    );
  }

  const payload = JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const res = http.post(loginUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (res.status !== 200) {
    throw new Error(
      `Échec de connexion dans setup() : statut HTTP ${res.status}. Réponse : ${res.body}`
    );
  }

  // Extraction du cookie de session xplor_sid (défini dans apps/api/src/auth/session-cookie.ts)
  let sessionId = null;
  if (res.cookies && res.cookies['xplor_sid'] && res.cookies['xplor_sid'].length > 0) {
    sessionId = res.cookies['xplor_sid'][0].value;
  }
  if (!sessionId) {
    const rawSetCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'];
    if (rawSetCookie) {
      const match = /xplor_sid=([^;]+)/.exec(rawSetCookie);
      if (match) {
        sessionId = match[1];
      }
    }
  }

  if (!sessionId) {
    throw new Error(
      'Cookie de session xplor_sid introuvable dans la réponse de login. ' +
      `En-têtes : ${JSON.stringify(res.headers)}`
    );
  }

  let csrfToken = null;
  try {
    const body = JSON.parse(res.body);
    if (body && body.twoFactorRequired === true) {
      throw new Error(
        'Compte avec 2FA requis : impossible de poursuivre sans saisie TOTP. ' +
        'Utilisez un compte sans double facteur actif pour ce test de charge (ex. compte seedé).'
      );
    }
    if (body && typeof body.csrfToken === 'string') {
      csrfToken = body.csrfToken;
    }
  } catch (err) {
    if (err && err.message && err.message.includes('2FA requis')) {
      throw err;
    }
  }

  return {
    sessionId,
    csrfToken,
  };
}

export default function (data) {
  const requestParams = {
    headers: {
      Cookie: `xplor_sid=${data.sessionId}`,
      ...(data.csrfToken ? { 'X-CSRF-Token': data.csrfToken } : {}),
    },
    cookies: {
      xplor_sid: data.sessionId,
    },
  };

  // 1. Liste des visites virtuelles (GET /api/v1/admin/tours)
  const toursRes = http.get(toursUrl, requestParams);
  check(toursRes, {
    'statut 200': (r) => r.status === 200,
  });

  // 2. Liste des hôtels (GET /api/v1/admin/hotels)
  const hotelsRes = http.get(hotelsUrl, requestParams);
  check(hotelsRes, {
    'statut 200': (r) => r.status === 200,
  });

  // 3. Liste des kiosques (GET /api/v1/admin/kiosks)
  const kiosksRes = http.get(kiosksUrl, requestParams);
  check(kiosksRes, {
    'statut 200': (r) => r.status === 200,
  });
}
