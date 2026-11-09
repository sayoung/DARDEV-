import http from 'k6/http';
import { check } from 'k6';

// Lecture et validation des variables d'environnement
const env = typeof __ENV !== 'undefined' ? __ENV : {};
const rawBaseUrl = env.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');
const SHARE_TOKEN = env.SHARE_TOKEN ? env.SHARE_TOKEN.trim() : '';

if (!SHARE_TOKEN) {
  throw new Error(
    'Variable d\'environnement SHARE_TOKEN obligatoire. ' +
    'Exemple : k6 run -e BASE_URL=http://localhost:3000 -e SHARE_TOKEN=<token> perf/k6/manifest.js'
  );
}

// Chemin du manifeste public issu de apps/api/src/viewer/public-tours.controller.ts :
// Contrôleur : @Controller('public/tours')
// Méthode : @Get(':shareToken')
// Préfixe global de l'API : /api/v1 (configuré dans apps/api/src/main.ts)
const apiPrefix = BASE_URL.endsWith('/api/v1') ? '' : '/api/v1';
const manifestUrl = `${BASE_URL}${apiPrefix}/public/tours/${encodeURIComponent(SHARE_TOKEN)}`;

// Profil de montée en charge et seuils d'acceptation NF-03
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(manifestUrl);

  check(res, {
    'statut 200': (r) => r.status === 200,
  });
}
