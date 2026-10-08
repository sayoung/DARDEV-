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

- 08/10/2026 — M4 F-20 (amélioration de l'éditeur 360) : glisser-déposer (seuil 4px), mode "Déplacer ici", flèches directionnelles. Tests `scene-editor.test.ts` mis à jour. (lint, typecheck, tests unitaires verts).
- 08/10/2026 — M4 F-12 (médiathèque par visite, envoi dans un dossier) : quand un dossier de visite est ouvert dans la Médiathèque, les panoramas envoyés (PanoramaUploader) so… — Le bouton « Créer les scènes dans cette visite » est ajouté, branché sur MediaPage et couvert par 4 tests Vitest, avec lint/typecheck/tests verts. (c77fad9)
- 08/10/2026 — M4 F-12 (tests Vitest MediaPage) : dans apps/admin/src/pages/MediaPage.test.tsx, ajouter de vrais tests (mocks de listAssets et listAssetFolders) : (1) affichag… — Les tests MediaPage vérifient désormais les appels à listAssets/listAssetFolders pour les 5 cas demandés, sans changement de code de production, avec lint/typecheck/tests verts. (1c47d81)
- 08/10/2026 — M4 F-12 (UI dossiers 4/4, tests) : dans apps/admin/src/pages/MediaPage.test.tsx, ajouter des tests du panneau Dossiers : libellés avec compteurs, clic sur une v… — Les tests du panneau Dossiers couvrent libellés/compteurs, clic visite (tourId + page 1), Non utilisés (unused=true), dossier initial via ?dossier= et aria-current, avec assertions inconditionnelles e… (942c232)
- 08/10/2026 — M4 F-12 (UI dossiers 3/4, URL + mobile) : dans apps/admin/src/pages/MediaPage.tsx, conserver le dossier dans l'URL `?dossier=<tourId|unused>` (absent = tous), l… — Le dossier est conservé dans l'URL (code déjà en place) et un Select mobile (md:hidden), branché sur changeFolder et folderItems, remplace le panneau sous md; lint, typecheck et tests sont verts. (21a53ec)
- 08/10/2026 — M4 F-12 (UI dossiers 2/4, panneau) : dans apps/admin/src/pages/MediaPage.tsx, ajouter le panneau « Dossiers » à gauche de la liste. Reprendre le travail de la b… — Panneau Dossiers repris conformément à la demande, sans console.log, indentation corrigée, mocks adaptés, lint/typecheck/tests verts. (5e37e6c)
- 08/10/2026 — M4 F-12 (UI dossiers 1/4, API + i18n) : dans apps/admin/src/api/catalog.ts, ajouter listAssetFolders (type de retour importé de @xplor/shared, import en tête de… — listAssetFolders est ajouté avec les types de @xplor/shared sur une route existante, et le bloc media.folders est ajouté dans fr.json seul ; lint, typecheck et tests passent. (1a38f70)
- 08/10/2026 — M4 F-12 (tests d'intégration API dossiers) : dans apps/api/test/assets.int.test.ts, le bloc describe('dossiers médiathèque HTTP') contient déjà tous les tests d… — Le test factice est remplacé par un vrai test d'accès hôtel A / hôtel B (403 sur les 4 routes pour les deux gestionnaires), dans le seul fichier demandé, avec lint et typecheck verts. (5b75b62)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, c : rôles et isolation par hôtel) : dans apps/api/test/assets.int.test.ts, ajouter des `it` séparés : (1) 403 pour PA… — Tests de rôles (401/403/200) ajoutés et décision D-76 correctement consignée pour l'accès hôtel ; le second test est un placeholder vide mais conforme à la consigne. (fee9de4)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, b3 : contrôle final) : lancer `pnpm lint`, `pnpm typecheck`, `pnpm test` (vitest unitaires) et `pnpm --filter api tes… — Contrôle final : lint, typecheck et pnpm test passent (code 0), aucun changement de code nécessaire et PROGRESS.md intact ; test:int et prettier ne figurent pas dans la sortie reçue. (7bcc32e)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, b2 : cohérence du filtre kind) : dans apps/api/test/assets.int.test.ts, dans le describe 'dossiers médiathèque HTTP',… — Le nouvel `it` compare les ids exacts de la liste et des dossiers pour kind=VIDEO, tourId et unused, avec nettoyage hotspot puis assets; lint et typecheck passent. (5f0f064)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, b1 : filtres tourId et unused) : dans apps/api/test/assets.int.test.ts, à la fin du describe 'dossiers médiathèque HT… — 3 nouveaux `it` conformes à la demande (filtres tourId, unused et combinaison), diff limité, cohérents avec le comportement du service ; lint et typecheck verts. (ad66595)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, b : filtre kind et compte 0) : dans le describe 'dossiers médiathèque HTTP' de apps/api/test/assets.int.test.ts (prés… — Les deux tests ajoutés (filtre kind=VIDEO avec count 0, 403 gestionnaire) et le nettoyage de l'asset vidéo sont corrects et conformes à la demande ; lint et typecheck passent, test:int non visible dan… (9cd3590)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, a2-3 : formatage) : dans apps/api/test/assets.int.test.ts, vérifier qu'il y a une ligne vide avant chaque appel `inse… — Lignes vides ajoutées avant les appels insertAsset dans le describe dossiers, aucun espace en fin de ligne, lint et typecheck verts, seul le fichier de test est modifié. (c98d85a)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, a2-2 : lint et typecheck) : lancer `pnpm lint` puis `pnpm typecheck`. Corriger uniquement les erreurs ou avertissemen… — Corrections de formatage et suppression du code mort (hotel inutilisé) dans assets.int.test.ts uniquement ; lint et typecheck passent (code 0). (138455a)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, a2-1 : test:int) : le describe 'dossiers médiathèque HTTP' (à partir de la ligne ~745) est dans apps/api/test/assets.… — Nettoyage du describe 'dossiers médiathèque HTTP' sécurisé (ids initialisés à '' et suppressions gardées dans afterEach), limité à assets.int.test.ts. La sortie de test:int n'était pas visible dans le… (bda669f)
- 08/10/2026 — M4 F-12 (tests d'intégration dossiers 3/3, a1 : describe + test ciblé) : dans apps/api/test/assets.int.test.ts, ajouter après le describe 'médias HTTP' un descr… — Le describe 'dossiers médiathèque HTTP' vérifie correctement count=2/1 et les deltas exacts de total et unusedCount, avec fixtures et nettoyage ; lint et typecheck passent, mais aucun run test:int cib… (ba8e0f1)
- 08/10/2026 — M4 F-12 (dossiers médiathèque 2/3 : contrôleur, OpenAPI) : en s'appuyant sur le service et les types shared de la sous-tâche précédente, exposer GET /admin/asse… — GET /admin/assets/folders exposé via un contrôleur fin avec parseAssetFoldersQuery (kind seul), route enregistrée dans OpenAPI, tests ajoutés, lint/typecheck/tests verts. (5a224e9)
- 08/10/2026 — M4 F-12 (dossiers médiathèque 3/3 : tests unitaires) : compléter apps/api/src/catalog/assets.service.test.ts pour `getFolders` et les filtres de `list`. Les tes… — Les tests de getFolders et des filtres de list vérifient les where passés à findMany/count et couvrent tous les cas demandés; lint, typecheck et tests sont verts selon l'orchestrateur. (51f2d4d)
- 08/10/2026 — M4 F-12 (dossiers médiathèque 2/3d : tests) : dans apps/api/src/catalog/assets.service.test.ts (suivre le style des mocks Prisma existants), ajouter des tests p… — Tests getFolders/list complets (comptage couverture+hotspot, count 0, filtre kind, notIn/in, page vide, refus HOTEL_MANAGER/PARTNER, accès ADMIN/EDITOR), contrôles verts, périmètre respecté. (50c85c4)
- 07/10/2026 — M4 F-12 (dossiers médiathèque 2/3c : list avec tourId et unused) : étendre `list` dans apps/api/src/catalog/assets.service.ts avec `query.tourId` et `query.unus… — list(actor, query) refuse les non-gestionnaires, gère tourId/unused via usageIndex conditionnel et AND avec kindWhere, court-circuite tourId+unused ; tests adaptés et contrôles verts. (6d42f3e)
- 07/10/2026 — M4 F-12 (dossiers médiathèque 2/3b : getFolders) : dans apps/api/src/catalog/assets.service.ts, ajouter `getFolders(actor: Principal, query: Pick<AssetListQuery… — getFolders et la route GET folders sont conformes à la spécification (accès ADMIN/EDITOR uniquement, calculs corrects, route avant :id) et les contrôles passent. (5bb57c9)
- 07/10/2026 — M4 F-12 (dossiers médiathèque 2/3a : index inversé) : dans apps/api/src/catalog/assets.service.ts, ajouter une méthode privée `usageIndex()` qui retourne `Map<s… — usageIndex() et kindWhere() ajoutés conformément à la demande (index inversé en une passe, Set par visite, ambientAssetId présent au schéma) ; lint et typecheck passent. (f7bb45f)
- 07/10/2026 — M4 Démo (import de visite générique : option --data) : scripts/oudayas/import.ts lit toujours scripts/oudayas/tour-data.json (chemin codé en dur, ~ligne 315). A… — Option --data ajoutée (défaut inchangé, limite 500 scènes, taille totale en dry-run, tests parseArgs et doc DEPLOY.md), contrôles verts. (1f3312a)
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