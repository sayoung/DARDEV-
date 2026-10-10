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

- 10/10/2026 — M4 DoD (1/4) Constats code F-20 à F-25 + F-01 AssetPicker + F-12 dossiers, sans modifier de fichier. Lire apps/admin/src/catalog/AssetPicker.tsx et AssetPicker.… — Tâche de constat en lecture seule : diff vide conforme, PROGRESS.md non modifié, lint/typecheck/tests verts. (9047a67)
- 10/10/2026 — M4 F-01 (4/4, b) AssetPicker : tests complémentaires dans apps/admin/src/catalog/AssetPicker.test.tsx (mocks existants de `uploadAsset` et `waitUntilAssetReady`… — Tests (11) et (12) ajoutés conformément à la demande, tous les contrôles passent, aucune modification de AssetPicker.tsx nécessaire ni de PROGRESS.md. (31d972a)
- 10/10/2026 — M4 F-01 (4/4, a) AssetPicker : reprendre l'onglet « Envoyer depuis mon ordinateur » depuis la branche partielle. Lire (lecture seule) `git show agent/20261010-1… — Onglet d'envoi de l'AssetPicker repris conformément à la demande (stage, AbortController, accept, clés fr/ar/en, tests 9 et 10 verts, lint/typecheck/test OK). (da3c56c)
- 10/10/2026 — M4 F-01 (3/4, c-3) Contrôle final : lancer `pnpm lint`, `pnpm typecheck` et `pnpm test` à la racine et obtenir code 0 pour les trois. Corriger toute erreur rest… — Contrôle final sans changement nécessaire : lint, typecheck et test retournent tous le code 0 et PROGRESS.md n'a pas été modifié. (84d4630)
- 10/10/2026 — M4 F-01 (3/4, c-2) Corriger apps/admin/src/pages/TourForm.test.tsx, qui échoue avec le nouvel AssetPicker (TourForm.tsx l.207 rend un AssetPicker pour la vignet… — Diff vide, mais tous les contrôles passent (lint, typecheck, pnpm test code 0) : TourForm.test.tsx n'a pas besoin de correction. (408fe6b)
- 10/10/2026 — M4 F-01 (3/4, c-1) Reprendre dans develop le travail partiel de la branche agent/20261010-133107-m4-f-01-3-4-c-reecrire-apps-admin-src-ca (lecture seule, sans o… — AssetPicker et ses 8 tests sont réécrits, la clé common.change existe en fr/ar/en, lint/typecheck/test passent et PROGRESS.md est intact (seul défaut : un BOM parasite en tête de deux fichiers, à reti… (d2c7699)
- 10/10/2026 — M4 F-01 (3/4, b) Adapter les tests existants à l'AssetPicker en fenêtre (le composant est déjà réécrit : bouton « Sélectionner » / « Modifier » qui ouvre un Dia… — Les tests adaptés à l'AssetPicker en fenêtre passent : le mock getAsset est ajouté dans TourForm.test.tsx, et les autres fichiers n'ont besoin d'aucun clic car ils ne ciblent pas le radio. (3218a9c)
- 10/10/2026 — M4 F-01 (3/4, a-3) Remettre la suite de tests au vert après le nouvel AssetPicker en fenêtre. Lancer `pnpm --filter @xplor/admin test` et corriger uniquement le… — Les tests HotspotDetailPage et SceneDetailPage sont adaptés à l'AssetPicker en fenêtre (mocks retirés, listAssets mocké, ouverture de la Dialog et choix du radio) ; lint, typecheck et tests passent, s… (c17a39e)
- 10/10/2026 — M4 F-01 (3/4, a-2-ii) AssetPicker en fenêtre : tests et contrôle global vert. Réécrire apps/admin/src/catalog/AssetPicker.test.tsx pour le nouveau comportement… — AssetPicker.test.tsx réécrit pour la fenêtre (ouverture, debounce 300 ms avec q, filtre de type, Charger plus, sélection/fermeture, requête obsolète) et lint, typecheck et test passent au code 0. (9b4a4f9)
- 10/10/2026 — M4 F-01 (3/4, a-2-i-2) AssetPicker en fenêtre : recherche avec debounce et filtre de type. Modifier UNIQUEMENT apps/admin/src/catalog/AssetPicker.tsx (ne pas to… — Recherche débouncée et filtre de type ajoutés dans AssetPicker avec un seul effet de chargement, protection contre les réponses obsolètes, réinitialisation à la fermeture et clés i18n fr ajoutées ; le… (77cc6be)
- 10/10/2026 — M4 F-01 (3/4, a-2-i-1, 3/3) Contrôle final du nouvel AssetPicker : lancer `pnpm lint`, `pnpm --filter @xplor/admin typecheck` et `pnpm --filter @xplor/admin tes… — Ajout minimal des attributs ARIA sur le bouton de AssetPicker ; lint, typecheck et tests passent, et les clés i18n fr requises existent. (f43074c)
- 10/10/2026 — M4 F-01 (3/4, a-2-i-1, 2/2) Couverture de test de la nouvelle AssetPicker. Dans apps/admin/src/catalog/AssetPicker.test.tsx (composant déjà réécrit en fenêtre à… — Les sept cas de couverture demandés sont présents dans AssetPicker.test.tsx, sans any ni eslint-disable, le composant n'est pas modifié et lint, typecheck et test passent. (c735900)
- 10/10/2026 — M4 F-01 (3/4, a-2-i-1, 1/2) AssetPicker en fenêtre, composant + tests existants remis au vert. Réécrire apps/admin/src/catalog/AssetPicker.tsx en repartant de d… — AssetPicker réécrit en fenêtre conformément à la consigne (chargement READY paginé, compteur anti-réponse obsolète, sans any/console/cast), tests existants adaptés et contrôles lint/typecheck/test ver… (ca0d85b)
- 10/10/2026 — M4 F-01 (3/4, a-1) Socle Dialog + i18n pour AssetPicker. Dans apps/admin/src/components/ui/Dialog.tsx, ajouter une prop optionnelle `className` fusionnée sur le… — Prop className ajoutée à Dialog et 5 clés fr ajoutées sans régression ; lint, typecheck et tests verts, aucun fichier parasite. (e1da657)
- 10/10/2026 — M4 F-01 (2/4) Fonction d'envoi générique côté admin. Dans apps/admin/src/api/client.ts, extraire de `uploadPanorama` une fonction `uploadAsset(file: File, kind:… — uploadAsset extrait proprement, uploadPanorama inchangé, waitUntilAssetReady (READY/ERROR/timeout/abandon) implémentée et testée ; lint, typecheck et tests passent. (70127a5)
- 10/10/2026 — M4 F-01 (1/4) b-2 — Mise à jour de docs/openapi.json pour la liste des médias. Prérequis : b-1 fusionnée. Les paramètres de requête q, status et kinds de GET /a… — Le registre OpenAPI documente q, status et kinds via le schéma partagé et docs/openapi.json ne change que par ces descriptions, avec lint, typecheck et test au vert. (a57b2ad)
- 10/10/2026 — M4 F-01 (1/4) b-1b-ii — Vérifier la base avec PowerShell `Test-NetConnection localhost -Port 5432 -InformationLevel Quiet` (timeout 15000 ms) ; si False, écrire… — Correction minimale du test d'intégration (ajout de la clé 'filename' attendue dans le détail d'un média), conforme au comportement réel du service, sans toucher aux assertions de sécurité ni aux fich… (0a32d1f)
- 10/10/2026 — M4 F-01 (1/4) b-1b-i — Exécuter UNIQUEMENT `CI=1 pnpm test` (tests unitaires, au premier plan, une seule commande, avec timeout explicite de 300000 ms, sans run… — Tâche d'exécution seule : aucun fichier modifié (diff vide) et les contrôles lint, typecheck et test sont au vert (code 0). (0c215a8)
- 10/10/2026 — M4 F-01 (1/4) b-1a — Ajouter le test d'intégration de la liste des médias (écriture + typecheck + lint). Modifier UNIQUEMENT apps/api/test/assets.int.test.ts (p… — Le test d'intégration de la liste des médias (q, status, kinds, pagination, 403, 422) est correctement ajouté, uniquement dans assets.int.test.ts, et lint/typecheck passent. (7894a42)
- 10/10/2026 — M4 F-01 (1/4) a — API liste des médias : q, status, kinds (schéma, parseur, service, client). Reprendre le travail partiel de la branche agent/20261010-015822-m… — q/status/kinds ajoutés (schéma, parseur avec 422 limité aux nouveaux champs, service, client) avec tests unitaires ; parseBody et les cas 400 existants sont préservés, contrôles verts. (a89b830)
- 10/10/2026 — M4 F-20 (éditeur : clic sur un hotspot sans mouvement parasite) : dans l'éditeur visuel, cliquer sur un hotspot provoque encore un « mouvement bizarre » (la vue… — Clic sur marqueur = sélection seule, déplacement uniquement via le mode « Déplacer » (bouton + Échap), glisser conservé, tests Vitest ajoutés et contrôles verts. (7dc2f85)
- 10/10/2026 — M4 F-24 (4/4) : fil d'Ariane et retour dans `apps/admin/src/pages/HotspotDetailPage.tsx` (et si simple `HotspotsPage.tsx`). Prérequis : `sceneNavLinks.ts` et le… — Fil d'Ariane et bouton de retour ajoutés dans HotspotDetailPage (et HotspotsPage) avec chargement tolérant aux erreurs, tests des hrefs et contrôles verts. (75291bb)
- 10/10/2026 — M4 F-24 (3/4) : liens « Scène précédente / suivante » dans `SceneDetailPage.tsx` et lien direct par scène dans `TourScenesSection.tsx`. Prérequis : sous-tâches… — Liens scène précédente/suivante dans SceneDetailPage et titre de scène en lien dans TourScenesSection, avec tests et contrôles verts. (be8d238)
- 10/10/2026 — M4 F-24 (2/4) — fil d'Ariane et lien retour dans apps/admin/src/pages/SceneDetailPage.tsx. Reprendre le travail partiel de la branche agent/20261009-235421-m4-f… — Fil d'Ariane et lien retour appliqués avec les 4 corrections demandées (clé common.breadcrumb, aria-hidden, tour.newScene, useEffect propre), tests adaptés, lint/typecheck/tests verts. (e933e70)
- 10/10/2026 — M4 F-24 (2/4) — clés i18n du fil d'Ariane. Dans packages/i18n/src/locales/fr.json, ajouter dans la section `common` la clé `breadcrumb` = « Fil d'Ariane », et u… — Clés common.breadcrumb et tour.newScene ajoutées dans fr/en/ar (ar en repli français autorisé), rien supprimé, aucun autre fichier touché, lint/typecheck/test OK. (26e7ec4)
- 09/10/2026 — M4 F-24 (1/4) : fonction pure de liens + clés i18n. Repartir de la branche partielle (lecture seule : `git show agent/20261009-232919-m4-f-24-back-office-naviga… — getSceneNavLinks pur et testé, clés i18n fr/en/ar ajoutées (ar en repli fr accepté), nav.tours existe, lint/typecheck/tests OK. (1dfe26b)
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