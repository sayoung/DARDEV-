# Suivi — Xplor

## Jalon en cours : M2 — Pipeline médias

Exigences : F-10, F-11, F-12, NF-03, API-24 (partiel, selon section 9 du cahier)

Livrable : Upload de 10 panoramas Insta360 → tous READY.

| # | Critère | État |
|---|---|---|
| 1 | Toutes les exigences implémentées et CA vérifiés | à faire |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | à faire |
| 3 | pnpm lint, pnpm typecheck sans erreur | à faire |
| 4 | Migrations appliquées, seed à jour | à faire |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | à faire |
| 7 | Démo avec données pertinentes | à faire |
| 8 | Démo au porteur et retours consignés | à faire |

Jalon précédent : M1. DoD M1 remplie : non (critère 2 : CI distante non confirmée, détail dans docs/archive/PROGRESS-M1.md)
- e2e local OK (03/10/2026)

## Session en cours

**Date :** 03/10/2026
**Objectif :** M2 API-24 : Ajouter la route DELETE `/api/v1/admin/assets/:id`

Plan :
- Ajouter le contrôleur `remove` dans `AssetsController` (appelle `AssetsService.remove`).
- Ajouter les tests HTTP (204 libre, 409 utilisé, 403 gestionnaire, 403 pas de CSRF).
- Mettre à jour OpenAPI.
- Lancer lint, typecheck, et test:int.

État :
Correction du problème de lint (unsafe assignment dans assets.int.test.ts). lint, typecheck et tests 100% OK.

## État des tâches

### En cours
- Aucun.

### Fait
- 03/10/2026 — M2 F-10 (e2e) : ajouter e2e/m2-medias.spec.ts (Playwright, même connexion admin du seed que e2e/m1-livrable.spec.ts). Il génère dans le test un petit JPEG inval… — Le test e2e M2 génère un JPEG 200×100 en mémoire et vérifie le message F-10 « attendu : >= 4096 ; reçu : 200 » (refus 422 à la complétion) ; il correspond au code réel et lint, typecheck et test sont… (8686886)
- 03/10/2026 — M2 Stockage (bug bloquant de la démo) : la démo pnpm demo:m2 donne 10 panoramas en ERROR « The specified key does not exist ». Cause : .env.example met STORAGE_… — Le worker refuse STORAGE_PROVIDER=local, .env.example passe à s3, la colonne « raison » du script de démo est en place, avec les tests demandés ; lint, typecheck et test sont verts. (5dccb1e)
- 03/10/2026 — M2 F-11 (admin 6/n, rafraîchissement) : dans MediaPage, tant qu'au moins un asset affiché est PENDING ou PROCESSING, recharger la page courante toutes les 3 s (… — Polling 3 s de MediaPage et fonction pure needsPolling livrés avec leurs tests, contrôles verts ; réserves mineures : spinner absent lors d'un changement de page après un rafraîchissement, polling arr… (00e214e)
- 03/10/2026 — M2 API-24 (admin 5/n, actions) : dans le tableau de MediaPage, ajouter une colonne Actions avec deux boutons : « Retraiter » (`media.actions.reprocess`), qui ap… — Colonne Actions (Retraiter/Supprimer) conforme à la demande, 409 gérée, 4 tests ajoutés, lint/typecheck/test verts. (026246a)
- 03/10/2026 — M2 F-10/API-24 (admin 4/n, envoi) : créer apps/admin/src/catalog/PanoramaUploader.tsx : un champ fichier (Label + Input type=file, accept="image/jpeg", multiple… — PanoramaUploader envoie en série avec progression et erreurs par fichier, il est intégré dans MediaPage, le test demandé est présent, les chaînes fr existent et les contrôles sont verts. (b79702a)
- 03/10/2026 — M2 F-10/API-24 (admin 3/n, liste) : dans MediaPage.tsx, charger les panoramas avec `listAssets({ kind: 'PANORAMA', page, pageSize: 20 })` (apps/admin/src/api/ca… — Liste des panoramas implémentée conformément à la demande (tableau, badge de statut, journal ERROR, états vide/chargement/erreur, pagination), tests présents et contrôles verts. (f760293)
- 03/10/2026 — M2 F-10/API-24 (admin 2/n, route et navigation) : dans apps/admin/src/router.ts, ajouter la route `{ name: 'media' }` pour le chemin `/media` (parsePathname et… — Route /media, lien de navigation « Médias », MediaPage avec PageHeader (titre + sous-titre), clés i18n et tests mis à jour ; lint, typecheck et test verts, charte respectée, pas de changement d'API. (6739cb3)
- 03/10/2026 — M2 Démo (3/3, documentation) : écrire docs/DEMO_M2.md, sans modifier aucun code, en repartant de la version de la branche agent/20261003-144021-m2-demo-3-3-docu… — docs/DEMO_M2.md est conforme : tous les blocs ont un tag de langage, aucun espace en fin de ligne, contenu complet et cohérent avec le script demo:m2, aucun code ni PROGRESS.md modifié, contrôles vert… (9f89c88)
- 03/10/2026 — M2 Démo (2/3, script réseau) : créer scripts/demo-m2-upload.ts, exécuté par `pnpm demo:m2` (tsx, déjà configuré). Il s'appuie sur les fonctions de scripts/demo-… — Le script scripts/demo-m2-upload.ts respecte le cahier des charges de la tâche (flux login/CSRF/upload/poll, réutilisation de demo-m2-lib, aucun secret en dur) et les contrôles sont verts. (0651848)
- 03/10/2026 — M2 Démo (1/3, socle et logique pure) : reprendre le travail de la branche agent/20261003-141215-m2-demo-1-3-socle-et-logique-pure-1-dans (lecture seule via `git… — Socle demo:m2 (tsx, lib pure + tests, projet vitest scripts) conforme, D-94 ajoutée après la ligne CI, pas de temp_dec.md, PROGRESS.md intact, contrôles verts. (0414b5c)
- M2 F-10/API-24 (admin, 1/n) : Ajout des fonctions client.ts (uploadPanorama, etc.) avec typage complet partagé, et tests HTTP ok.
- M2 API-24 : exposer DELETE /api/v1/admin/assets/:id.
- M2 API-24 : Méthode remove dans AssetsService (vérification de l'utilisation et suppression du stockage).
- M2 F-12 : Implémentation du CLI API (main.ts) et méthode reprocessAllPanoramas dans AssetsService.
- M2 F-12 : Création du parseur CLI (reprocess-args.ts) et ses tests.
- M2 API-24 : Route de retraitement POST /api/v1/admin/assets/:id/reprocess (contrôleur et tests d'intégration, mise à jour OpenAPI).
- M1 CI : Correction de la décision D-94 (formatage) et vérification des versions Node 24 (runs.using=node24).
- M1 CI : Mise à jour des actions GitHub vers leurs versions Node 24 (checkout@v7, pnpm/action-setup@v6, setup-node@v7, upload-artifact@v7).
- M1 CI : Déplacement de l'arrêt de l'API et MinIO après Playwright, ajout de l'attente de l'API et du proxy 127.0.0.1.
- M2 API-24 : Méthode reprocess dans AssetsService avec gestion des erreurs 404, 422, 409 et appel à la file BullMQ.
- M2 F-10/API-24 (1/5, StorageService et URL pré-signées) : Implémentation terminée avec S3StorageService et LocalStorageService.
- Design 6/6 : Charte Xplor appliquée à tout le back-office, nettoyage des classes CSS personnalisées.
- M2 F-11/F-12 : Mise en file rejouable (signature de enqueue modifiée).
- M2 F-11 : Démarrage du worker (fonction boot asynchrone).
- M2 F-11 : Worker BullMQ (panorama.worker.ts).
- M2 F-11 : Stockage S3 du worker (@aws-sdk/client-s3).
- M2 F-11 : Processeur de job, logique pure (panorama.processor.ts).
- M2 F-11 : Accès base depuis le worker (PrismaAssetRepository).
- M2 F-11 : Empreinte du fichier (content-hash.ts).
- M2 F-11 : Configuration du worker (validation Zod).
- M2 F-10 : Lecture des dimensions JPEG (image-size et sharp).
- M2 F-11 : Producteur BullMQ côté API (PanoramaQueueService).
- M2 F-11 : Dérivé tiles (panorama.tiles.ts).
- M2 F-11 : Dérivés preview, web, thumb (panorama.derivatives.ts).
- M2 F-11 : Grille des tuiles (tileGrid).
- M2 F-11 : File panorama, contrat partagé (panorama-queue.ts).
- M2 F-11 (1/n) : Initialisation du worker et module des dérivés.
- M2 F-11 (2/n) : Ajout du journal d'erreur.
- M2 API-24 (1/2) : Schémas partagés d'upload de médias.
- M2 API-24 (2/2) : StorageService S3 et StorageModule global.

### Bloqué
- M1 critère 2, CI distante non confirmée (run GitHub Actions à fournir par le porteur)

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.


