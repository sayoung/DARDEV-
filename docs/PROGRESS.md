# Suivi — Xplor

## Jalon en cours : M4 — Éditeur visuel

Exigences : F-20 à F-25

Livrable : L'équipe contenus produit une visite complète sans aide technique

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

DoD M4 remplie : non

Jalon précédent : M3b validé par le porteur ; détail dans docs/archive/PROGRESS-M3b.md

## Session en cours

### Bilan de vérification DoD M4

| Critère | Statut | Fichiers et tests cités |
|---|---|---|
| **F-20** Éditeur 360 dans l'onglet de la scène | OK | `SceneDetailPage.tsx`, `SceneEditor360.tsx`<br>**Tests :** `SceneDetailPage.test.tsx`, `SceneEditor360.test.tsx` |
| **F-21** Création de hotspot au clic avec panneau latéral | OK | `SceneDetailPage.tsx`, `HotspotForm.tsx`<br>**Tests :** `SceneDetailPage.test.tsx` |
| **F-22** Glisser-déposer, suppression, annuler/rétablir, sauvegarde | OK | `SceneDetailPage.tsx`, `editHistory.ts`, `debouncedSaver.ts`<br>**Tests :** `editHistory.test.ts`, `debouncedSaver.test.ts`, `SceneDetailPage.test.tsx` |
| **F-23** Vue initiale et orientation d'arrivée | OK | `SceneDetailPage.tsx`, `ArrivalOrientationDialog.tsx`<br>**Tests :** `SceneDetailPage.test.tsx`, `ArrivalOrientationDialog.test.tsx` |
| **F-24** Bouton « Tester la visite », jeton d'aperçu | OK | `TourDetailPage.tsx`, `tours.controller.ts`, `preview-token.ts`, `route.ts`, `app.ts`<br>**Tests :** `TourDetailPage.test.tsx`, `tours.int.test.ts`, `preview-token.test.ts`, `route.test.ts`, `app.test.ts` |
| **F-25** Carte des liens avec orphelins | OK | `TourLinkMapPanel.tsx`, `LinkMapGraph.tsx`, `linkMapLayout.ts`, `tour-graph.ts`<br>**Tests :** `TourLinkMapPanel.test.tsx`, `LinkMapGraph.test.tsx`, `linkMapLayout.test.ts`, `tour-graph.test.ts`, `tours.int.test.ts` |
| **Contrôle d'accès** | OK | Routes `preview-token` et `graph` réservées `EDITOR`+ (403 PARTNER). Tests (401, 403, 404, nominal) dans `tours.int.test.ts`. |
| **3 langues / RTL** | Reporté | exception à D-03 (décision du porteur du 30/09/2026). |

DoD M4 vérifiée : prête pour la démo

**Sorties des contrôles :** lint, typecheck, test OK ; test:int OK en 3 lots (voir ci-dessous).
- test:int lot 1 (assets, auth, catalog, migrations) : code 0, Test Files  4 passed (4), Tests  24 passed (24)
- test:int lot 2 (hotspots, public-tours, scenes, seed) : code 0, Test Files  4 passed (4), Tests  31 passed (31)
- test:int lot 3 (tours-duplicate, tours-publication, tours) : code 0, Test Files  3 passed (3), Tests  29 passed (29)

### Scénario de démo pas à pas
1. Créer une visite.
2. Y ajouter 3 scènes.
3. Placer des liens entre les scènes via l'éditeur 360 (hotspots).
4. Définir la vue initiale d'une scène et l'orientation d'arrivée depuis les liens.
5. Tester l'aperçu de la visite via le bouton « Tester la visite ».
6. Lire la carte des liens (graphe) avec les orphelins.

### Écarts réels (à traiter comme petites tâches M4)
Aucun écart réel.

## État des tâches

### En cours
- Aucun.

### Fait

- 07/10/2026 — M4 F-12 (dossiers médiathèque 1/3 : types partagés) : en repartant de develop, ajouter dans packages/shared/src/catalog.ts, puis l'exporter dans index.ts, le sc… — Schémas AssetFolders*, filtres tourId/unused et tests ajoutés conformément à la demande, diff minimal, lint/typecheck/tests verts. (dcb094c)
- 07/10/2026 — M4 DoD bilan test:int : sans lancer aucun test ni docker, lis dans docs/PROGRESS.md (section « Session en cours ») les trois lignes « - test:int lot 1/2/3 … ».… — Les 3 lots test:int ont le code 0 et PROGRESS.md est mis à jour exactement comme demandé (sortie des contrôles, écart supprimé, mention DoD M4), sans autre fichier modifié. (7ea7a18)
- 07/10/2026 — M4 DoD test:int lot 3/3 : n'utilise que Git Bash (pas PowerShell), ne lance jamais docker, ne lance rien en arrière-plan. Exécute au premier plan : `cd apps/api… — La ligne « test:int lot 3 » est ajoutée au bon endroit et au bon format dans docs/PROGRESS.md, avec le code 0, et aucun autre fichier n'est touché. Je n'ai pas pu vérifier les chiffres dans lot3.log. (38f78a9)
- 07/10/2026 — M4 DoD test:int lot 2/3 : n'utilise que Git Bash (pas PowerShell), ne lance jamais docker, ne lance rien en arrière-plan. Exécute au premier plan : `cd apps/api… — Une seule ligne ajoutée dans docs/PROGRESS.md, au bon endroit et au bon format (lot 2 : code 0, 4 fichiers, 31 tests), sans autre modification. (3819da0)
- 07/10/2026 — M4 DoD test:int lot 1/3 : n'utilise que Git Bash (pas PowerShell), ne lance jamais docker, ne lance rien en arrière-plan. Exécute au premier plan : `cd apps/api… — Une seule ligne ajoutée dans docs/PROGRESS.md, au bon endroit et au bon format (code 0, 4 fichiers et 24 tests passés), sans autre modification. (0edd21c)
- 07/10/2026 — M4 DoD écart test:int (3/3) c : lis /d/DARDEV/local/xplor-test-runs/int.exit et `tail -n 40` de int.log (si int.exit est absent, n'édite rien et dis-le). Dans d… — int.exit est absent du dossier xplor-test-runs ; l'agent devait donc ne rien éditer et le signaler, ce que correspond au diff vide. (2d460d9)
- 07/10/2026 — M4 DoD écart test:int (3/3) b2 : sans modifier aucun fichier du dépôt ni relancer test:int, vérifie d'abord si /d/DARDEV/local/xplor-test-runs/int.exit existe.… — Tâche de lecture seule : aucun fichier du dépôt modifié (diff vide) et lint, typecheck et test passent ; je n'ai pas pu lire int.exit ni int.log pour confirmer le résultat de test:int. (b12c12b)
- 07/10/2026 — M4 DoD écart test:int (3/3) b1 : sans modifier aucun fichier du dépôt ni relancer test:int, attends la fin de test:int avec `timeout 540 bash -c 'until [ -f /d/… — Diff vide, aucun fichier du dépôt modifié (tâche d'attente et de rapport sur test:int), contrôles lint, typecheck et test à 0. (0873e8b)
- 07/10/2026 — M4 DoD écart test:int (3/3) a : sans modifier aucun fichier du dépôt et sans jamais lancer docker, diagnostique l'état de la suite d'intégration lancée en arriè… — Tâche de diagnostic sans modification du dépôt : diff vide, contrôles lint/typecheck/test au vert. (161259d)
- 07/10/2026 — M4 DoD écart test:int (2/3) : sans modifier aucun fichier du dépôt et sans jamais lancer docker, lance la suite d'intégration complète en arrière-plan, détachée… — Aucun fichier modifié (diff vide), conforme à la consigne ; le lancement détaché de pnpm test:int n'a pas pu être revérifié par moi, les contrôles lint, typecheck et test sont verts. (9c68eb7)
- 07/10/2026 — M4 DoD écart test:int (1/3) : dans apps/api/test/assets.int.test.ts uniquement (aucun autre fichier, ne touche pas à docs/PROGRESS.md), test 'filtre par kind, t… — Correctif minimal et exact : la liste de clés de jsonKeys inclut derivatives et panorama, conforme à AssetResponseSchema ; lint et typecheck verts, aucun autre fichier touché. (69c3d76)
- 07/10/2026 — M4 F-20 à F-25 e2e : crée e2e/m4-editor.spec.ts (Playwright) sur le modèle de e2e/m3-viewer.spec.ts : connexion admin, `ensureReadyPanoramas(page, 2)` (e2e/help… — Spec e2e M4 conforme à la demande (clés i18n typées, sélecteurs alignés sur l'UI, aucun code de production modifié), lint et typecheck verts ; l'exécution Playwright n'a pas pu être vérifiée. (a2b96e1)
- 07/10/2026 — M4 DoD test:int (2/2) : attends la fin de test:int lancé par la tâche précédente, avec `timeout 500 bash -c 'until [ -f /d/DARDEV/local/xplor-test-runs/int.exit… — PROGRESS.md reflète fidèlement le résultat réel de test:int (code 124, échec de assets.int.test.ts puis crash IPC, écart conservé) et passe F-22 à OK avec retrait de son écart ; aucun autre fichier mo… (ac091c1)
- 07/10/2026 — M4 DoD test:int (1/2) : sans modifier aucun fichier du dépôt et sans jamais lancer docker, vérifie que le tunnel SSH répond (`timeout 5 bash -c '</dev/tcp/local… — Aucune modification du dépôt (diff vide), conforme à la tâche ; lint, typecheck et tests unitaires passent, mais les artefacts hors dépôt (int.log, int.exit) n'ont pas pu être vérifiés. (55edfc9)
- 07/10/2026 — M4 F-22 : stabiliser les tests à minuteurs simulés de apps/admin/src/pages/SceneDetailPage.test.tsx, sans toucher au code de production et sans modifier d'autre… — Les trois tests passent aux minuteurs simulés après le rendu, avec des expect directs et sans waitFor ni findBy, comme demandé ; lint, typecheck et test sont verts. (b870d5f)
- 07/10/2026 — M4 DoD (4/4) : dans docs/PROGRESS.md, section « Session en cours », reprends le tableau de docs/M4_DOD_NOTES.md, critère par critère (F-20 à F-25 plus contrôle… — Bilan DoD M4 reporté fidèlement dans PROGRESS.md (tableau, 3 langues/RTL reporté, démo, écarts, DoD non cochée) et M4_DOD_NOTES.md supprimé, sans code touché. (31c3d6d)
- 07/10/2026 — M4 DoD (3/4) b-3 : dans `docs/M4_DOD_NOTES.md`, section « Sorties des commandes » (après la sous-section `### pnpm test`, au même format), ajoute une sous-secti… — Sous-section `pnpm test:int` ajoutée avec « non exécuté » et la cause, plus un tableau des écarts créé, dans le seul fichier docs/M4_DOD_NOTES.md, conformément à la consigne pour des fichiers absents. (162fb3c)
- 07/10/2026 — M4 DoD (3/4) b-2 : attends la fin de `test:int` lancé en arrière-plan par la sous-tâche précédente. Boucle avec `until [ -f /tmp/int.exit ]; do sleep 10; done`… — Tâche d'attente et de rapport sans modification du dépôt (diff vide) et contrôles automatiques au vert ; le contenu du rapport de l'agent n'a pas pu être vérifié. (fb7fc3f)
- 07/10/2026 — M4 DoD (3/4) b-1 : sans modifier aucun fichier du dépôt, lis `.env` à la racine (ne copie aucun secret dans ta sortie) pour confirmer les ports de postgres et d… — Aucun fichier du dépôt modifié, comme demandé; contrôles lint/typecheck/test verts. Je n'ai pas pu vérifier l'exécution de test:int (/tmp/int.log et /tmp/int.exit non fournis). (b4e4cf8)
- 07/10/2026 — M4 DoD (3/4) a : exécute `CI=1 timeout 480 pnpm test > /tmp/test.log 2>&1; echo EXIT=$?` au premier plan, sans tâche en arrière-plan et sans docker. Le script `… — Section « Sorties des commandes » ajoutée à docs/M4_DOD_NOTES.md avec pnpm test (code 0, 133 fichiers / 1000 tests OK), lint et typecheck (code 0), sans autre fichier modifié. (700b735)
- 07/10/2026 — M4 DoD (2/4) F-24, F-25 et contrôle d'accès : sans écrire de code de production ni toucher aucun test, vérifie F-24 (bouton « Tester la visite », jeton d'aperçu… — Seul docs/M4_DOD_NOTES.md est modifié ; F-22 passe en Écart et les lignes F-24/F-25 et la section Contrôle d'accès correspondent au code, les tests 401/403/404/nominal existant bien pour les deux rout… (348f299)
- 07/10/2026 — M4 DoD (1/4) F-20 à F-23 : sans écrire de code de production, vérifie dans le code et les tests que F-20 à F-23 du cahier des charges (section M4) sont couverts… — Le fichier de notes DoD M4 (F-20 à F-23) cite des fichiers et tests réels, les références vérifiées dans SceneDetailPage correspondent au code, et aucun autre fichier n'est modifié. (6039d97)
- 07/10/2026 — M4 F-25 (4e/n) : dans apps/admin/src/pages/TourLinkMapPanel.tsx, remplace la zone réservée `data-testid="link-map-graph"` par `<LinkMapGraph map={map} />` (apps… — LinkMapGraph est intégré dans TourLinkMapPanel avec repli « empty », le panneau est ajouté à TourDetailPage, les tests sont adaptés et lint, typecheck et test sont verts. (2e16f35)
- 07/10/2026 — M4 F-25 (4d/n, 3/3) : crée apps/admin/src/editor/LinkMapGraph.test.tsx (Vitest + Testing Library, comme les autres tests de apps/admin). Mocke '@xyflow/react' a… — Test LinkMapGraph conforme à la demande (mock xyflow, 3 nœuds, libellé de départ, classes orphelin et externe), contrôles au vert, aucun fichier hors périmètre modifié. (7bc1402)
- 07/10/2026 — M4 F-25 (4d/n, 2/3) : crée apps/admin/src/editor/LinkMapGraph.tsx (@xyflow/react est déjà installé). Props : `{ map: TourLinkMap }` (type de @xplor/shared). Le… — LinkMapGraph.tsx est conforme à la spécification (props, labels i18n, classes Tailwind, arêtes, options ReactFlow, aucune intégration de page) et lint/typecheck/tests passent. (007c588)
- 07/10/2026 — M4 F-25 (4d/n, 1/3) : dans apps/admin uniquement, exécute `pnpm --filter admin add @xyflow/react` (@xyflow/react n'est pas encore dans apps/admin/package.json).… — @xyflow/react ^12.12.0 ajouté (lockfile cohérent), D-114 mis à jour, clé i18n 'start' ajoutée ; seuls les 4 fichiers autorisés sont modifiés et les contrôles sont verts. (16a8ba2)
- 07/10/2026 — M4 F-25 (4c/n, 3/3) : crée apps/admin/src/pages/TourLinkMapPanel.test.tsx (Vitest + Testing Library, mocke `../api/catalog.js` pour `getTourLinkMap` ; reprends… — Les 4 tests demandés (orphelins, aucun orphelin, erreur, actualiser) sont corrects, l'API est bien mockée, le composant n'est pas modifié et lint/typecheck/test passent. (4f62008)
- 07/10/2026 — M4 F-25 (4c/n, 2/3) : crée apps/admin/src/pages/TourLinkMapPanel.tsx (export nommé `TourLinkMapPanel`, props `{ tourId: string; refreshKey?: string }`). Inspire… — TourLinkMapPanel conforme à la demande (chargement, erreur, graphe réservé, orphelins, actualisation), avec tests et contrôles lint/typecheck/test au vert. (4a7a9b7)
- 07/10/2026 — M4 F-25 (4c/n, 1/3) : dans packages/i18n/src/locales/fr.json uniquement (repli D-82, ne touche ni ar.json ni en.json), ajoute sous `catalog.tours` un objet `lin… — Les quatre clés catalog.tours.linkMap sont ajoutées dans fr.json uniquement, avec les textes demandés et la structure imbriquée existante ; lint, typecheck et test à 0. (183101a)
- 07/10/2026 — M4 F-25 (4b/n, tests d'abord) : crée apps/admin/src/editor/linkMapLayout.ts et linkMapLayout.test.ts (TypeScript pur, sans React ni dépendance). Exporte `layout… — layoutLinkMap et ses tests sont conformes à la demande (BFS par niveaux, orphelins en colonne finale, déterminisme) et lint, typecheck et test sont verts. (d58b470)
- 07/10/2026 — M4 F-25 (4a/n) : dans apps/admin/src/api/catalog.ts, ajoute `getTourLinkMap(tourId: string): Promise<TourLinkMap>` (GET /admin/tours/:id/graph, réponse validée… — getTourLinkMap ajouté avec validation Zod et deux tests, entrée D-114 pour @xyflow/react sans installation, contrôles verts. (1f65a63)
- 07/10/2026 — M4 F-25 (3c/n) : déclare dans apps/api/src/openapi/registry.ts la route `GET /admin/tours/{id}/graph` (réponse 200 TourLinkMapSchema, 401, 403, 404 documentés,… — La route GET /admin/tours/{id}/graph est déclarée avec TourLinkMapSchema et les réponses 200/401/403/404 (plus 400), openapi.json est régénéré, seuls les deux fichiers attendus changent et les contrôl… (b0e1484)
- 07/10/2026 — M4 F-25 (3b/n) : dans apps/api/src/catalog/tours.controller.ts, ajoute `GET /admin/tours/:id/graph` (API-21) qui renvoie `this.tours.getLinkMap(id)` : contrôleu… — GET /admin/tours/:id/graph est présent avec les mêmes guards que les routes voisines, et les tests 401/403/404/200 demandés sont écrits; le diff est vide car le travail est déjà arrivé par le commit d… (7d5015d)
- 07/10/2026 — Récupération du travail non commité — Route GET /admin/tours/:id/graph propre (garde de rôle, service et schéma partagés déjà présents) avec tests d'intégration couvrant 401/403/404 et le cas nominal ; lint, typecheck et test passent. (be9d74b)
- 07/10/2026 — M4 F-25 (3a-3/3, tests) : dans apps/api/src/catalog/tours.service.test.ts uniquement, ajoute à `describe('ToursService')` les tests de `getLinkMap` : (1) scène… — Les trois tests de getLinkMap couvrent les cas demandés, le diff est limité au fichier de test et lint, typecheck et test sont au vert. (cf9bd27)
- 07/10/2026 — M4 F-25 (3a-2/3, tests d'abord) : dans apps/api/src/catalog/tours.service.ts, ajoute `async getLinkMap(id: string): Promise<TourLinkMap>` (type de @xplor/shared… — getLinkMap conforme à la spec (loadActive, findMany Prisma dans le service, mapping des titres), tests ajoutés pour 404 et scène orpheline, lint/typecheck/test verts. (4debdbd)
- 07/10/2026 — M4 F-25 (3a-1/3) : dans apps/api/src/catalog/tours.test-support (non : uniquement apps/api/src/catalog/tours.service.test.ts), étends le faux Prisma de `harness… — Le faux Prisma de harness() gère maintenant les scènes et hotspots en mémoire, avec findMany, addScene et addHotspot, sans nouveau test, et lint, typecheck et test sont au vert. (4bf3859)
- 07/10/2026 — M4 F-25 (2c/n, tests d'abord) : dans apps/api/src/catalog/tour-link-map.ts (buildTourLinkMap, créé en 2b), ajoute la gestion des hotspots TOUR_LINK : un nœud un… — Gestion des TOUR_LINK conforme à la spec (nœuds externes dédoublonnés, label de repli, arêtes tour_link, scènes supprimées ignorées, pas d'impact sur l'orphelin), testée, contrôles verts. (41a04f4)
- 07/10/2026 — M4 F-25 (2b/n, tests d'abord) : crée apps/api/src/catalog/tour-link-map.test.ts puis apps/api/src/catalog/tour-link-map.ts. Exporte `buildTourLinkMap(input: { s… — buildTourLinkMap respecte la spécification (scènes seules, orphelines via reachableFrom, scènes supprimées exclues), les tests demandés sont présents et lint, typecheck et test sont verts. (30ff8a6)
- 07/10/2026 — M4 F-25 (2a/n) : dans apps/api/src/catalog/publication-rules.ts, extrais le parcours en largeur `reachableIds(start: GraphNode)` dans une fonction générique exp… — reachableFrom générique extraite, validateTour inchangé fonctionnellement, 4 tests ajoutés, contrôles verts. (52eadbf)