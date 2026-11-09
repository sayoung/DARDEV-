# Protocole et Suivi des Performances (NF-03) — Projet Xplor

> **Référence :** Cahier des charges Xplor v2.0 — Exigence non fonctionnelle **NF-03 Performance** et jalon **M8 — Durcissement & pilote**.  
> **Dernière mise à jour :** 09/11/2026.

Ce document formalise le protocole d'évaluation des performances de la plateforme Xplor au regard des cinq seuils définis par l'exigence **NF-03**. Il rassemble les commandes d'exécution exactes, les scénarios de test de charge, les profils d'émulation réseau et la procédure de stockage des rapports d'audit.

> [!CAUTION]
> **Interdiction formelle de tester sur l'environnement de production** (`api.xplor.ma`, `admin.xplor.ma`, `v.xplor.ma` ou tout autre domaine de production) sans accord explicite et préalable du porteur du projet.
> Les tirs k6 et les audits de charge génèrent un trafic soutenu susceptible de saturer les ressources, de déclencher le rate limiting applicatif (`ThrottlerGuard` / Redis) ou de dégrader le service pour les utilisateurs finaux.
> En outre, le script d'insertion d'événements (`perf/k6/events.js`) effectue des écritures réelles et répétées en base de données PostgreSQL, ce qui polluerait irréversiblement les métriques de fréquentation et les statistiques des visites réelles.
> Les mesures doivent être réalisées exclusivement en **local** ou sur un **environnement de préproduction dédié**.

---

## 1. Tableau récapitulatif des seuils NF-03

| Seuil | Outil / Script | Commande exacte | Environnement de mesure (local ou préproduction ; jamais la production sans l'accord du porteur) | P95 mesuré | Conforme |
|---|---|---|---|---|---|
| API back-office < 300 ms P95 | k6 (`perf/k6/admin-api.js`) | `k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=<email-admin> -e ADMIN_PASSWORD=<mot-de-passe> perf/k6/admin-api.js` | Local ou préproduction (jamais la production sans l'accord du porteur) | à mesurer | à mesurer |
| Manifeste < 200 ms P95 | k6 (`perf/k6/manifest.js`) | `k6 run -e BASE_URL=http://localhost:3000 -e SHARE_TOKEN=<shareToken> perf/k6/manifest.js` | Local ou préproduction (jamais la production sans l'accord du porteur) | à mesurer | à mesurer |
| Insertion de 200 événements < 100 ms | k6 (`perf/k6/events.js`) | `k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=<kioskToken> perf/k6/events.js` | Local ou préproduction (jamais la production sans l'accord du porteur) | à mesurer | à mesurer |
| Visionneuse web premier affichage < 3 s en 4G | Lighthouse (profil Slow 4G) | `npx lighthouse <url-visionneuse> --throttling-method=simulate --throttling.rttMs=150 --throttling.throughputKbps=1638.4 --throttling.cpuSlowdownMultiplier=4 --output=json --output-path=perf/reports/lighthouse-viewer.json` | Local ou préproduction (jamais la production sans l'accord du porteur) | à mesurer | à mesurer |
| Kiosque changement de scène < 1 s depuis le cache | Chromium DevTools (mesure manuelle) | Procédure DevTools (onglet Performance / Network avec cache activé, mesure du délai de transition entre scènes) | Local ou préproduction (jamais la production sans l'accord du porteur) | à mesurer | à mesurer |

---

## 2. Détail des protocoles de mesure et modes opératoires

### 2.1 API back-office : consultation des listes (`perf/k6/admin-api.js`)

Le script teste la rapidité de réponse des requêtes de consultation du back-office administrateur sur les trois listes principales en lecture seule :
- Visites virtuelles : `GET /api/v1/admin/tours`
- Hôtels : `GET /api/v1/admin/hotels`
- Kiosques : `GET /api/v1/admin/kiosks`

#### Variables d'environnement réelles
- `BASE_URL` (optionnel) : URL de base de l'API cible (défaut : `http://localhost:3000`).
- `ADMIN_EMAIL` (**obligatoire**) : Adresse e-mail d'un compte administrateur ou gestionnaire (ex. `<email-admin>`).
- `ADMIN_PASSWORD` (**obligatoire**) : Mot de passe associé au compte (ex. `<mot-de-passe>`).

#### Profil de charge et seuils
- **Montée en charge :** 10 utilisateurs virtuels simultanés (`vus: 10`) pendant 1 minute (`duration: '1m'`).
- **Gestion de la session :** Une unique authentification `POST /api/v1/auth/login` est réalisée lors de la phase `setup()` afin de respecter le limiteur de débit strict (`ThrottlerGuard` configuré à 5 requêtes par minute et par IP). Le cookie de session `xplor_sid` est ensuite transmis à chaque itération par les utilisateurs virtuels.
- **Seuils d'acceptation NF-03 :**
  - `http_req_duration: ['p(95)<300']` (95 % des requêtes doivent répondre en moins de 300 ms).
  - `http_req_failed: ['rate<0.01']` (taux d'erreur HTTP strictement inférieur à 1 %).

#### Commande d'exécution
```bash
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=<email-admin> -e ADMIN_PASSWORD=<mot-de-passe> perf/k6/admin-api.js
```

---

### 2.2 Téléchargement du manifeste public (`perf/k6/manifest.js`)

Le script teste l'endpoint public de récupération du graphe et des métadonnées d'une visite virtuelle :
- `GET /api/v1/public/tours/:shareToken`

#### Variables d'environnement réelles
- `BASE_URL` (optionnel) : URL de base de l'API cible (défaut : `http://localhost:3000`).
- `SHARE_TOKEN` (**obligatoire**) : Jeton public d'une visite active et publiée (`publicShare: true`, statut `PUBLISHED`).

#### Profil de charge et seuils
- **Montée en charge :** Rampe progressive de 0 à 20 VU pendant 30 secondes, suivie d'un palier à 20 VU pendant 1 minute.
- **Seuils d'acceptation NF-03 :**
  - `http_req_duration: ['p(95)<200']` (95 % des requêtes doivent répondre en moins de 200 ms).
  - `http_req_failed: ['rate<0.01']` (taux d'erreur HTTP strictement inférieur à 1 %).

#### Commande d'exécution
```bash
k6 run -e BASE_URL=http://localhost:3000 -e SHARE_TOKEN=<shareToken> perf/k6/manifest.js
```

---

### 2.3 Ingestion d'événements statistiques (`perf/k6/events.js`)

Le script teste l'ingestion massive d'analytique par lots de 200 événements :
- `POST /api/v1/events` (avec en-tête `Authorization: Bearer <kioskToken>`).

Chaque lot de 200 événements est généré conformément au schéma Zod `eventsBatchSchema` défini dans `packages/shared`, dans le strict respect de la loi marocaine 09-08 (NF-02, aucune donnée personnelle de voyageur).

#### Variables d'environnement réelles
- `BASE_URL` (optionnel) : URL de base de l'API cible (défaut : `http://localhost:3000`).
- `KIOSK_TOKEN` (**obligatoire**) : Jeton d'authentification porteur d'un kiosque enrôlé. Ce jeton permet au guard `OptionalKioskTokenGuard` d'identifier l'appareil et d'éviter le rate limiting appliqué aux requêtes anonymes.

#### Profil de charge et seuils
- **Montée en charge :** 5 utilisateurs virtuels simultanés (`vus: 5`) pendant 1 minute (`duration: '1m'`).
- **Seuils d'acceptation NF-03 :**
  - `http_req_duration: ['p(95)<100']` (95 % des requêtes d'insertion d'un lot de 200 événements doivent répondre en moins de 100 ms).
  - `http_req_failed: ['rate<0.01']` (taux d'erreur HTTP strictement inférieur à 1 %).

#### Commande d'exécution
```bash
k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=<kioskToken> perf/k6/events.js
```

---

### 2.4 Visionneuse web : premier affichage en 4G (Lighthouse)

L'exigence NF-03 impose que le premier affichage de la visionneuse web (`apps/web`) s'effectue en moins de 3 secondes sous un profil de connectivité mobile 4G dégradée (*Slow 4G*).

#### Paramètres de simulation Slow 4G
La simulation est réalisée via Lighthouse CLI en appliquant les paramètres réseau et CPU recommandés pour le profil mobile Slow 4G :
- **Méthode de throttling :** simulation (`--throttling-method=simulate`).
- **Latence aller-retour (RTT) :** 150 ms (`--throttling.rttMs=150`).
- **Débit descendant :** 1 638,4 kbps ≈ 1,6 Mbps (`--throttling.throughputKbps=1638.4`).
- **Ralentissement CPU :** facteur 4 (`--throttling.cpuSlowdownMultiplier=4`).

#### Commande d'exécution
```bash
npx lighthouse <url-visionneuse> \
  --throttling-method=simulate \
  --throttling.rttMs=150 \
  --throttling.throughputKbps=1638.4 \
  --throttling.cpuSlowdownMultiplier=4 \
  --output=json \
  --output-path=perf/reports/lighthouse-viewer.json
```

*(Remplacer `<url-visionneuse>` par l'URL locale ou de préproduction de la visite publique, ex. `http://localhost:5174/v/<shareToken>`)*.

#### Critères d'évaluation
Les métriques extraites du rapport JSON généré (`perf/reports/lighthouse-viewer.json`) pour évaluer le premier affichage sont :
- Le **First Contentful Paint (FCP)**.
- Le **Largest Contentful Paint (LCP)**.
Le délai d'affichage initial complet doit demeurer sous le seuil maximal de 3 000 ms.

---

### 2.5 Kiosque : changement de scène depuis le cache (Procédure DevTools)

L'exigence NF-03 impose un délai de changement de scène inférieur à 1 seconde lorsque les contenus de la visite sont servis depuis le cache local du navigateur du kiosque.

#### Procédure de mesure manuelle via Chromium DevTools
La mesure s'effectue via les outils de développement intégrés à Chromium (sur l'application `apps/kiosk`) selon les étapes suivantes :

1. **Démarrer l'application kiosque** sur l'environnement de mesure (en local ou sur un poste tactile de préproduction).
2. **Ouvrir les outils de développement Chromium** (`F12` ou `Ctrl + Shift + I`).
3. **Vérifier l'activation du cache :**
   - Accéder à l'onglet **Network**.
   - S'assurer que l'option **Disable cache** est formellement **décochée** (le cache navigateur doit être actif).
4. **Préchauffer le cache de la visite :**
   - Naviguer une première fois sur les différentes scènes de la visite virtuelle sélectionnée afin que l'ensemble des tuiles panoramiques et ressources associées soient enregistrées dans le cache HTTP / disque du navigateur.
5. **Enregistrer la transition :**
   - Ouvrir l'onglet **Performance** (ou l'onglet **Network** en filtrant sur les requêtes de médias / images).
   - Déclencher l'enregistrement du profil de performance.
   - Cliquer sur un hotspot de navigation pour basculer vers une scène adjacente déjà mise en cache.
   - Dès que le panorama de la nouvelle scène est visible et interactif, arrêter l'enregistrement.
6. **Analyser la durée de transition :**
   - Dans le relevé de l'enregistrement, mesurer l'intervalle de temps séparant l'événement utilisateur (clic / tap sur le hotspot) du rendu complet de la nouvelle scène dans le canevas de visualisation.
   - Vérifier également dans l'onglet **Network** que les tuiles et images requises ont bien été servies depuis le cache (`(disk cache)` ou `(memory cache)`).
   - Valider que le temps total mesuré reste strictement sous le seuil maximal de 1 000 ms.
7. **Consigner le relevé :**
   - Noter la durée observée dans le tableau de suivi des performances.

---

## 3. Stockage et archivage des rapports

Tous les artefacts d'exécution, exports de métriques et rapports d'audit de performance sont centralisés dans le répertoire :
```text
perf/reports/
```

Ce dossier contient un fichier `.gitkeep` afin d'être suivi dans l'arborescence du dépôt, tandis que les fichiers générés lors des tirs de performance y sont déposés :
- **Rapports Lighthouse :** fichier `perf/reports/lighthouse-viewer.json`.
- **Résumés de tirs k6 :** exports optionnels au format JSON via l'option `--summary-export` de k6, par exemple :
  - `perf/reports/admin-api-summary.json`
  - `perf/reports/manifest-summary.json`
  - `perf/reports/events-summary.json`
- **Relevés DevTools :** captures ou profils de performance exportés depuis l'onglet Performance de Chromium lors des mesures sur l'application kiosque.

Toutes les valeurs mesurées restent à consigner et valider formellement lors des campagnes de test de charge officielles.
