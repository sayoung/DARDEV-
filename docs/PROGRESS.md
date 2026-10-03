# Suivi — Xplor

## Jalon en cours : M3 — Visionneuse

Exigences : F-30 à F-35, F-40 à F-42, API-10, API-11, API-12

Livrable : Démo 1 : visite réelle de Rabat consultable sur mobile via QR

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | Toutes les exigences implémentées et CA vérifiés | à faire | - |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | à faire | - |
| 3 | pnpm lint, pnpm typecheck sans erreur | à faire | - |
| 4 | Migrations appliquées, seed à jour | à faire | - |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) | - |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | à faire | - |
| 7 | Démo avec données pertinentes | à faire | - |
| 8 | Démo au porteur et retours consignés | à faire | - |

DoD M3 remplie : non

Jalon précédent : M2 validé par le porteur ; détail dans docs/archive/PROGRESS-M2.md

## État des tâches

### En cours
- Aucun.

### Fait

- 03/10/2026 — M3 API-11 (4a/5, mappeur de scène, logique pure) : créer apps/api/src/viewer/tour-graph-scene.ts. Il exporte les types locaux `SceneSource` (id, title/caption/l… — Mappeur de scène conforme à la spécification (repli fr, narration, ambiance, hotspots filtrés, validation Zod) avec les 4 tests demandés ; lint, typecheck et test sont verts. (3878cea)
- 03/10/2026 — M3 API-11 (3c/5, mappeur de hotspots, TOUR_LINK, URL et décision) : dans apps/api/src/viewer/tour-graph-hotspot.ts, ajouter TOUR_LINK : retourne null si targetT… — TOUR_LINK et URL sont implémentés avec les garde-fous kiosk et httpUrl, les tests demandés sont ajoutés et D-97 est consigné ; lint, typecheck et test sont verts. (14a1ab6)
- 03/10/2026 — M3 API-11 (3b/5, mappeur de hotspots, INFO et MEDIA) : dans apps/api/src/viewer/tour-graph-hotspot.ts, ajouter les cas INFO et MEDIA à `toGraphHotspot`. INFO :… — Les cas INFO et MEDIA de toGraphHotspot sont conformes à la spec (échappement, paragraphes, repli fr, ordre des médias, null si vide), testés, et lint/typecheck/test passent. (8b452cc)
- 03/10/2026 — M3 API-11 (3a/5, mappeur de hotspots, socle + SCENE_LINK) : créer apps/api/src/viewer/tour-graph-hotspot.ts. Y déclarer en local, sans @prisma/client, le type `… — Mappeur SCENE_LINK conforme (label localisé avec repli fr, validation Zod, null pour cible absente et pour les types non implémentés), tests pertinents, contrôles verts, PROGRESS.md intact. (23f56b5)
- 03/10/2026 — M3 API-10/API-11 (2c/5, URL publique des médias) : dans docker-compose.yml, le service minio-init existe déjà (utilise `mc alias set local …`) : y ajouter, aprè… — minio-init rend le préfixe panoramas/ public (bucket via S3_BUCKET) et D-96 est consignée correctement; PROGRESS.md intact, contrôles verts. (3f52b02)
- 03/10/2026 — M3 API-10/API-11 (2b/5, URL publique des médias) : créer apps/api/src/viewer/media-url.ts avec deux fonctions pures. `mediaUrl(base, key)` joint la base et la c… — mediaUrl et panoramaUrls conformes à la demande (jointure, encodage par segment, « / » final des tuiles conservé, validation Zod alignée sur le worker), tests pertinents, contrôles verts. (528c8cc)
- 03/10/2026 — M3 API-10/API-11 (2a/5, URL publique des médias) : ajouter la variable MEDIA_PUBLIC_URL dans le schéma Zod d'apps/api/src/config/env.ts (URL http(s), sans « / »… — MEDIA_PUBLIC_URL ajoutée au schéma Zod et à .env.example avec défaut, refus du '/' final et tests couvrant les cas demandés ; contrôles verts. (21a06a7)
- 03/10/2026 — M3 API-10/API-11 (2/2, type partagé TourGraph) : écrire packages/shared/src/tour-graph.test.ts (Vitest, même style que catalog.test.ts) pour les schémas de pack… — Le test tour-graph.test.ts couvre les 4 cas demandés et la correction ciblée de tour-graph.ts (arrivalYaw/targetSceneId optionnels) est justifiée par l'exemple du cahier ; lint, typecheck et test sont… (22947f6)
- 03/10/2026 — M3 API-10/API-11 (1/2, type partagé TourGraph) : créer packages/shared/src/tour-graph.ts avec des schémas Zod suivant la section 7.4 du cahier (.orchestrator/do… — Les schémas Zod TourGraph, TourGraphScene et TourGraphHotspot sont conformes à la tâche et à la section 7.4 du cahier, exportés depuis index.ts, avec lint, typecheck et test verts. (9fa8c1e)
- 03/10/2026 — M3 Suivi (bilan M2, docs uniquement) : M2 a été validé par le porteur à la démo. Créer docs/archive/PROGRESS-M2.md en y copiant le tableau DoD M2 et les section… — Archive M2 créée et PROGRESS.md recentré sur M3 conformément à la demande, docs uniquement, fichier de 1,3 Ko, contrôles verts. (a261afc)

### Bloqué
- M1 critère 2, CI distante non confirmée (run GitHub Actions à fournir par le porteur)

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.
