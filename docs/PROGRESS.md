# Suivi — Xplor

## Jalon en cours : M5 — Hôtels & kiosque

Exigences : F-50 à F-54, F-60 à F-67, API-01 à 03, API-26/27

Livrable : Démo 2 : kiosque de test enrôlé, fonctionnant réseau coupé

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

DoD M5 remplie : non

Jalon précédent : M4 validé par le porteur ; détail dans docs/archive/PROGRESS-M4.md

## Session en cours

## État des tâches

### En cours
- Aucun.

### Fait

- 16/10/2026 — M5 F-51 (sélection 3b/8) Client Prisma typé : dans apps/api/src/hotels/selection.service.ts, élargir l'interface SelectionPrismaClient (sans toucher à la méthod… — SelectionPrismaClient étendu (tour.findMany, selection.upsert, $transaction) et SelectionTx exportée conformément à la demande, test complété sans changer d'assertion, lint/typecheck/test OK. (0adfe46)
- 16/10/2026 — M5 F-51 (sélection 3a/8) Constantes d'erreur : dans apps/api/src/hotels/hotels.errors.ts, ajouter à la suite des constantes existantes (même style, deux lignes… — Les deux constantes SELECTION_TOUR_INVALID et son message sont ajoutées dans hotels.errors.ts, au bon style et sans autre modification ; lint et typecheck passent. (936ce75)
- 16/10/2026 — M5 F-51 (sélection 2/8, tests) Tests de lecture : créer apps/api/src/hotels/selection.service.test.ts avec Prisma simulé, dans le style de hotel-managers.servic… — Les tests de lecture de SelectionService couvrent tous les cas demandés (cloisonnement, ADMIN, hôtel supprimé, sélection absente, tri) et lint, typecheck et tests passent. (f1378a3)
- 16/10/2026 — M5 F-51 (sélection 2/8) Service, lecture : créer apps/api/src/hotels/selection.service.ts dans le style de hotel-managers.service.ts, et l'enregistrer en provid… — SelectionService.get conforme (404 identique à HotelsService.get, valeur par défaut sans écriture, items triés, updatedAt ISO validé par le schéma partagé), module enregistré, lint et typecheck OK. (83da9ff)
- 16/10/2026 — M5 F-51 (sélection 1/8) Schémas partagés : créer packages/shared/src/selection.ts et l'exporter depuis packages/shared/src/index.ts. SelectionUpdateSchema {tour… — Schémas Zod de sélection et tests conformes à la demande, exportés depuis index.ts, lint/typecheck/tests verts. (a235a1b)
- 16/10/2026 — M5 API-26 (rattachement 5/5) OpenAPI : dans apps/api/src/openapi/registry.ts, enregistrer GET et PUT /api/v1/admin/hotels/{id}/managers avec HotelManagersUpdate… — Routes GET/PUT des gestionnaires d'hôtel correctement enregistrées dans OpenAPI, tests ajoutés, openapi.json régénéré avec uniquement des ajouts, lint et typecheck OK. (3b35f2a)
- 16/10/2026 — M5 F-50 (rattachement 4/5) Tests d'intégration : créer apps/api/test/hotel-managers.int.test.ts dans le style de apps/api/test/hotels.int.test.ts (même mise en… — Les tests d'intégration hotel-managers couvrent tous les cas demandés (200/422/403/404/401/vidage) dans le style de hotels.int.test.ts, avec lint et typecheck verts. (ad74edd)
- 16/10/2026 — M5 F-50 (rattachement 3/5) Contrôleur : dans apps/api/src/hotels/hotels.controller.ts (ou un nouveau hotel-managers.controller.ts déclaré dans hotels.module.ts,… — Routes GET/PUT admin/hotels/:id/managers correctement gardées (PUT réservé ADMIN), validées via parseBody/parseResourceId, tests complets, D-116 consignée avec À valider : oui, contrôles verts. (bf04f39)
- 16/10/2026 — M5 F-50 (rattachement 2/5, b) Tests : créer apps/api/src/hotels/hotel-managers.service.test.ts avec Prisma simulé dans le style de hotels.service.test.ts (le se… — Le test du service de rattachement des gestionnaires couvre les 6 cas demandés (plus 2 cas bonus) avec un Prisma simulé typé, et lint, typecheck et tests passent. (c4ecc0b)
- 16/10/2026 — M5 F-50 (rattachement 2/5, a) Service : reprendre depuis la branche agent/20261016-104331-m5-f-50-rattachement-2-5-service-creer-a (lecture seule, via `git show… — Service HotelManagersService, constantes d'erreur et enregistrement dans HotelsModule conformes à la demande ; lint et typecheck passent. (9dc530f)
- 16/10/2026 — M5 F-50 (rattachement 1/5) Schémas partagés : dans packages/shared/src/hotel.ts, ajouter HotelManagerSchema {id (uuid), email (email), name (string)}, HotelMana… — Schémas HotelManager/HotelManagersResponse/HotelManagersUpdate ajoutés dans packages/shared avec exports, types inférés et tests couvrant valide, vide, doublon et uuid invalide; contrôles verts, API e… (170e46d)
- 16/10/2026 — M5 API-26 (5/5) OpenAPI des hôtels (2/2) — régénération de docs/openapi.json. Lance la commande existante `pnpm --filter @xplor/api openapi` (script `tsx --cond… — La régénération de docs/openapi.json ne produit aucun diff car les chemins des hôtels y figuraient déjà depuis le commit précédent, et lint, typecheck et test passent. (a0557b6)
- 16/10/2026 — M5 API-26 (5/5) OpenAPI des hôtels (2/2) — test du registre. Dans apps/api/src/openapi/registry.test.ts, ajoute dans le tableau ROUTES (ligne ~9, après les rout… — Les 5 routes hôtels sont ajoutées à ROUTES et le nouveau test couvre toutes les assertions demandées (hôtels et villes), sans toucher registry.ts ni openapi.json; lint, typecheck et tests passent. (30df3ba)
- 16/10/2026 — M5 API-26 (5/5) OpenAPI des hôtels (1/2b) enregistrement des hôtels et régénération. Dans apps/api/src/openapi/registry.ts, importe `HotelCreateSchema`, `HotelU… — Les hôtels sont enregistrés dans le registre OpenAPI avec les bons schémas et descriptions, et docs/openapi.json n'ajoute que les routes hôtels, sans suppression ; lint, typecheck et tests passent. (a841836)
- 16/10/2026 — M5 API-26 (5/5) OpenAPI des hôtels (1/2a) options de registerCatalogCrud. Dans apps/api/src/openapi/registry.ts, étends `registerCatalogCrud` (ligne ~422) avec… — Options facultatives ajoutées à registerCatalogCrud avec les défauts demandés ; le rendu existant des villes et catégories est inchangé, le 422 réutilise referenceError comme createTour, lint et typec… (d6a9252)
- 14/10/2026 — M5 F-50/API-26 (4/5) Tests d'intégration des hôtels : créer apps/api/test/hotels.int.test.ts en suivant le style de apps/api/test/catalog.int.test.ts (même mise… — Tests d'intégration des hôtels complets et conformes à la demande ; hotelIds chargés en session et 422 brandColor justifiés, lint/typecheck/test OK (test:int non prouvé par les contrôles fournis). (355eecf)
- 14/10/2026 — M5 F-50/API-26 (3/5) Contrôleur et module des hôtels : créer apps/api/src/hotels/hotels.controller.ts (route admin/hotels, @UseGuards(SessionGuard, CsrfGuard),… — Contrôleur et module des hôtels conformes (gardes session+CSRF, écriture ADMIN seul, lecture via service filtré), enregistrés dans AppModule, testés, D-115 consignée ; contrôles verts. (b16c304)
- 14/10/2026 — M5 F-50 (2/5) Service des hôtels : créer apps/api/src/hotels/hotels.service.ts (module à créer plus tard) en suivant le style de apps/api/src/catalog/cities.ser… — Service des hôtels conforme : périmètre par hôtel, 404 sans fuite, suppression logique, vérifications ville/logo en 422, réponse sans hash, tests présents et contrôles verts. (1791329)
- 14/10/2026 — M5 F-50 (1/5) Schémas partagés des hôtels : créer packages/shared/src/hotel.ts et l'exporter depuis packages/shared/src/index.ts. Zod : HotelStarsSchema (FOUR|F… — Schémas Zod des hôtels conformes à la demande (validation, refine des dates, hasMaintenancePin sans hash), exportés depuis index.ts, tests présents et contrôles verts. (8d39ed9)
- 14/10/2026 — M5 Bilan (ouverture du jalon) : tâche de bilan autorisée, seuls fichiers modifiables docs/PROGRESS.md et docs/archive/PROGRESS-M4.md (nouveau). Copier intégrale… — Archive PROGRESS-M4.md créée et en-tête M5 de PROGRESS.md réécrit conformément à la demande, seuls les deux fichiers autorisés modifiés, contrôles au vert. (b0ada82)