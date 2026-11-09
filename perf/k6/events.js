import http from 'k6/http';
import { check } from 'k6';

// Lecture et validation des variables d'environnement
const env = typeof __ENV !== 'undefined' ? __ENV : {};
const rawBaseUrl = env.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');
const KIOSK_TOKEN = env.KIOSK_TOKEN ? env.KIOSK_TOKEN.trim() : '';

if (!KIOSK_TOKEN) {
  throw new Error(
    'Variable d\'environnement KIOSK_TOKEN obligatoire. ' +
    'Exemple : k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=<token> perf/k6/events.js'
  );
}

// Validation dans le cycle de vie setup de k6
export function setup() {
  if (!KIOSK_TOKEN) {
    throw new Error(
      'Variable d\'environnement KIOSK_TOKEN obligatoire. ' +
      'Exemple : k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=<token> perf/k6/events.js'
    );
  }
}

// Endpoint d'ingestion issu de apps/api/src/events/events.controller.ts :
// Contrôleur : @Controller('events')
// Méthode : @Post() avec @HttpCode(HttpStatus.OK) -> retourne le statut HTTP 200
// Guard : @UseGuards(OptionalKioskTokenGuard) -> vérifie l'en-tête "Authorization: Bearer <KIOSK_TOKEN>" (kiosk-token.guard.ts)
// Préfixe global de l'API : /api/v1 (configuré dans apps/api/src/main.ts)
const apiPrefix = BASE_URL.endsWith('/api/v1') ? '' : '/api/v1';
const eventsUrl = `${BASE_URL}${apiPrefix}/events`;

// Rate limiting (vérifié dans apps/api/src/events/events.controller.ts et apps/api/src/events/events-rate-limit.ts) :
// Dans EventsController.ingest(), le rate-limiting Redis (EventsRateLimitService.consume) s'applique uniquement si
// request.kioskDevice === undefined (limite anonyme : EVENTS_ANON_RATE_LIMIT_MAX = 60 requêtes/minute par IP).
// Les requêtes authentifiées avec un jeton kiosque valide via l'en-tête "Authorization: Bearer <KIOSK_TOKEN>"
// renseignent request.kioskDevice grâce à OptionalKioskTokenGuard et évitent ainsi la limite anonyme.

// Profil de test et seuils d'acceptation NF-03 (insertion événements < 100 ms P95)
export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

// Types d'événements statistiques conformes à packages/shared/src/events.ts (F-80, §5.9)
const EVENT_TYPES = [
  'SESSION_START',
  'TOUR_OPEN',
  'SCENE_VIEW',
  'HOTSPOT_CLICK',
  'AUDIO_PLAY',
  'LANG_CHANGE',
  'VR_ENTER',
  'VR_EXIT',
  'QR_SHOWN',
  'SESSION_END',
];

// Construction d'un lot valide de 200 événements (eventsBatchSchema, NF-02, sans donnée personnelle)
function buildBatch200(timestamp) {
  const events = [];
  for (let i = 0; i < 200; i++) {
    const sessionNum = Math.floor(i / 10) + 1;
    const sessionHex = sessionNum.toString(16).padStart(12, '0');
    const type = EVENT_TYPES[i % EVENT_TYPES.length];
    events.push({
      sessionId: `01990000-0000-7000-8000-${sessionHex}`,
      type: type,
      channel: 'KIOSK',
      tourId: '01990000-0000-7000-8000-000000000002',
      sceneId: '01990000-0000-7000-8000-000000000003',
      hotspotId: type === 'HOTSPOT_CLICK' ? '01990000-0000-7000-8000-000000000004' : null,
      lang: 'fr',
      durationMs: type === 'SCENE_VIEW' || type === 'AUDIO_PLAY' ? 1500 : null,
      occurredAt: timestamp,
    });
  }
  return { events };
}

const httpParams = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${KIOSK_TOKEN}`,
  },
};

export default function () {
  const payload = JSON.stringify(buildBatch200(new Date().toISOString()));
  const res = http.post(eventsUrl, payload, httpParams);

  check(res, {
    'statut 200': (r) => r.status === 200,
  });
}
