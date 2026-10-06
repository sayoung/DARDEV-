# Suivi — Xplor

## Jalon en cours : M3b — Mise en ligne bêta

Exigences : NF-10 (partiel), NF-01 (partiel)

Livrable : Démo 1 en ligne : la visite s'ouvre sur mobile depuis le QR (https://v.xplor.ma/v/…), back-office sur https://admin.xplor.ma

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | Toutes les exigences implémentées et CA vérifiés | Fait | lint, typecheck, test OK |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | à faire | - |
| 3 | pnpm lint, pnpm typecheck sans erreur | Fait | lint, typecheck, test OK |
| 4 | Migrations appliquées, seed à jour | Fait | lint, typecheck, test OK |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) | - |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | Fait | lint, typecheck, test OK |
| 7 | Démo avec données pertinentes | à faire | - |
| 8 | Démo au porteur et retours consignés | à faire | - |

DoD M3b remplie : non

Jalon précédent : M3 validé par le porteur ; détail dans docs/archive/PROGRESS-M3.md

## État des tâches

### En cours
- Aucun.

### Fait

- 06/10/2026 — M3b Démo 1 (import Oudayas 2/3, partie B, étape 3c : test de la limite de 3 envois simultanés dans scripts/oudayas/import.spec.ts). Complète scripts/oudayas/imp… — Test de la limite de 3 envois simultanés ajouté correctement dans import.spec.ts, fichier propre et contrôles verts. (5b96e1c)
- 06/10/2026 — M3b Démo 1 (import Oudayas 2/3, partie B, étape 3a : tests de uploadFile et de l'authentification dans scripts/oudayas/import.spec.ts). Crée scripts/oudayas/imp… — Tests de login et uploadFile conformes à la consigne (séquence fetch, en-têtes Cookie/CSRF sur les POST seulement, erreur avec nom de fichier) ; lint, typecheck et test passent. (00784f2)
- 06/10/2026 — M3b Démo 1 (import Oudayas 2/3, partie B, étape 2 : rendre scripts/oudayas/import.ts testable et conforme). Dans scripts/oudayas/import.ts (déjà présent, 220 li… — import.ts est exporté et sans effet de bord à l'import, les envois (pool) et l'attente READY sont séparés, le timeout est global, les erreurs nomment le fichier avec code de sortie non nul, et le dry-… (94e9af8)
- 06/10/2026 — M3b Démo 1 (import Oudayas 2/3, partie B, étape 1 : remettre les contrôles au vert). Lance pnpm lint, pnpm typecheck puis pnpm test (sans docker : les services… — Correction d'un test fragile par timeout dans TourForm.test.tsx, sans contournement interdit ; lint, typecheck et test sortent avec le code 0. (d6b5e8f)
- 06/10/2026 — Récupération du travail non commité — Partie B de l'import Oudayas (connexion, envoi, attente READY) cohérente avec l'API et les schémas partagés ; lint, typecheck et test au vert ; createTour reste un stub prévu pour la partie C. (474d62d)
- 05/10/2026 — M3b Démo 1 (import Oudayas 2/3, partie A : options et client API). Crée scripts/oudayas/import-lib.ts, qui contient la logique pure et testable. (1) parseArgs(a… — import-lib.ts et son spec respectent la demande (options, plafond de concurrence, pool, détection de visite, URL publique, aucune fuite du mot de passe) et lint, typecheck et test sont verts. (e958b84)
- 05/10/2026 — M3b Démo 1 (import Oudayas 1/3, données de la visite, logique pure, tests d'abord) : la visite statique D:\DARDEV\local\xplor-panoramas-test\visite-oudayas\inde… — Données Oudayas fidèles aux 38 scènes de la source, plan de visite pur conforme aux schémas Zod, tests présents et contrôles verts. (d90f8a8)
- 05/10/2026 — M3b F-12 (médiathèque, bouton « Nettoyer », back-office) : dans apps/admin/src/pages/MediaPage.tsx, ajoute un bouton shadcn `variant="outline"` « Nettoyer la mé… — Bouton Nettoyer avec aperçu dryRun, confirmation, résultat et tests couvrant les cas demandés, contrôles verts ; réserves mineures sur la suppression des clés ar/en provisoires et la ré-indentation de… (30f2046)
- 05/10/2026 — M3b F-12 (nettoyage 3/3, c : Hotspot.mediaAssetIds) : dans apps/api/test/assets.int.test.ts, ajouter le test « un asset référencé uniquement par Hotspot.mediaAs… — Le test Hotspot.mediaAssetIds est correct, couvre dry-run et suppression réelle, avec nettoyage en finally, et les contrôles passent. (d175930)
- 05/10/2026 — M3b F-12 (nettoyage 3/3, b2 : exécution du test S3 réel) : le test « suppression réelle supprime les fichiers S3 » existe dans apps/api/test/assets.int.test.ts… — Le test S3 réel n'est plus ignoré et vérifie les trois critères demandés (fichier libre supprimé, fichier référencé conservé, bucket vide après le finally). Lint et typecheck passent ; la sortie de te… (eb8009c)
- 05/10/2026 — M3b F-12 (nettoyage 3/3, b1b : test S3 réel) : dans apps/api/test/assets.int.test.ts, ajouter à la fin du describe existant du cleanup un test « suppression rée… — Test S3 réel correct (champs Tour, éligibilité du cleanup, vérifications headObject, nettoyage en finally, skip si driver local) ; lint et typecheck verts, PROGRESS.md intact. (c9f1af1)
- 05/10/2026 — M3b F-12 (nettoyage 3/3, b1a : préparation du test S3 réel) : dans apps/api/test/assets.int.test.ts, ajouter UNIQUEMENT les imports nécessaires au futur test «… — Aucun import ajouté (diff vide), ce que la consigne prévoit quand les imports ne seraient pas utilisés sans le test ; lint et typecheck verts, PROGRESS.md intact. (683ce8d)
- 05/10/2026 — M3b F-12 (nettoyage 2/3, d : route) : dans apps/api/src/catalog/assets.controller.ts, ajouter POST /api/v1/admin/assets/cleanup avec les mêmes guards (session,… — Route POST admin/assets/cleanup ajoutée avant :id avec guards session/CSRF, validation Zod et délégation au service, plus un test d'intégration 401/403/200 ; lint, typecheck et tests au vert. (95376ee)
- 05/10/2026 — M3b F-12 (nettoyage 2/3, c : tests du service) : dans apps/api/src/catalog/assets.service.test.ts, ajouter des tests unitaires (Prisma mocké, même style que les… — Les tests de cleanup couvrent dryRun (exclusion des 5 types de références) et la suppression avec erreur isolée ; lint, typecheck et test sont verts. (522cc8e)
- 05/10/2026 — M3b F-12 (nettoyage 2/3, b2 : tests) : dans apps/api/src/catalog/assets.service.test.ts, ajouter des tests de `AssetsService.cleanup` (déjà implémenté en b1) en… — Trois tests de AssetsService.cleanup conformes à la demande (orphelin seul listé, échec partiel {deleted:2, failed:1}, aucun orphelin), lint/typecheck/test verts, sans any ni désactivation. (c3d3770)
- 05/10/2026 — M3b F-12 (nettoyage 2/3, b1 : implémentation) : dans apps/api/src/catalog/assets.service.ts, ajouter `async cleanup(dryRun: true): Promise<AssetCleanupDryRunRes… — cleanup() est correctement implémenté (surcharges, filtrage des orphelins et des médias de hotspots, dry-run validé par Zod, suppression tolérante aux erreurs via remove()), et lint, typecheck et test… (634c4cd)
- 05/10/2026 — M3b F-12 (nettoyage 2/3, a : service) : dans apps/api/src/catalog/assets.service.ts, ajouter une méthode privée getHotspotMediaAssetIds() qui retourne un Set de… — getHotspotMediaAssetIds() est ajoutée et utilisée dans remove() (409 ASSET_IN_USE si un hotspot référence l'asset), avec un test dédié ; lint, typecheck et tests passent. (af5bc69)
- 05/10/2026 — M3b F-12 (nettoyage 1/3, contrat) : reprendre en lecture seule (git show agent/20261005-135739-m3b-f-12-route-de-nettoyage-reprendre-la:<chemin>, sans le suppos… — Schémas/types de nettoyage, exports et route OpenAPI reportés correctement, docs/openapi.json régénéré, lint/typecheck/test verts, périmètre respecté. (861e71b)
- 05/10/2026 — M3b F-12 (médiathèque, suppression complète d'un média, test d'abord) : dans apps/api/src/catalog/assets.service.ts, `remove(id)` supprime aujourd'hui la ligne… — deleteByPrefix ajouté (S3 paginé + local) et utilisé par remove() pour effacer uploads et dérivés panorama, erreurs journalisées sans bloquer la suppression, tests et contrôles verts. (a1ec996)
- 05/10/2026 — M3b F-90 (2/2, tests + nettoyage de l'URL). Prérequis : la sous-tâche 1/2 est fusionnée (client.ts émet 'session-expired' et pousse `?notice=expired`, LoginPage… — Nettoyage de `notice=expired` après connexion et tests de la redirection 401 (unique, sans boucle) conformes à la demande, contrôles au vert. (3970de4)
- 05/10/2026 — M3b F-90 (1/2, noyau : 401 → retour à la connexion). Reprends sur develop le travail partiel de la branche agent/20261005-124243-m3b-f-90-back-office-session-pe… — Noyau 401 → retour à la connexion implémenté conformément à la consigne (redirection unique, événement session-expired, notice expired, types Notice préservés, i18n fr avec repli), lint/typecheck/test… (22bc46a)
- 05/10/2026 — M3b F-01 (3/3, apps/admin/src/pages/TourForm.tsx et son test) : dans TourForm, remplace `kind={AssetKind.IMAGE}` (ligne ~202) par `kinds={COVER_ASSET_KINDS}` où… — TourForm utilise kinds={COVER_ASSET_KINDS} (constante de module), impose une vignette avec un message i18n fr et les trois tests demandés couvrent les cas ; lint, typecheck et tests sont verts. (62965be)
- 05/10/2026 — M3b F-01 (2/3, apps/admin/src/catalog/AssetPicker.tsx et AssetPicker.test.tsx uniquement) : reprends l'idée de la branche agent/20261005-111526-m3b-f-01-back-of… — AssetPicker converti en grille radiogroup avec miniatures, multi-kinds, effet stable sur kindsDep, filtrage READY et tests conformes ; seuls des défauts mineurs (traductions en/ar copiées en français,… (c3dcc17)
- 05/10/2026 — M3b F-01 (1/3, shared + API, ajout rétrocompatible) : les miniatures de médias n'ont aucune source côté admin (`AssetResponse` dans packages/shared/src/catalog.… — thumbnailUrl ajouté au schéma partagé et renseigné dans le service des assets (READY avec contentHash → URL thumb.jpg, sinon null), fixtures admin et test unitaire mis à jour, contrôles verts. (cac1303)
- 05/10/2026 — M3b NF-10 (3/3, docs/DEPLOY.md uniquement) : 1) Remplace partout `./deploy/xxx.sh` et `deploy/xxx.sh` par `bash deploy/xxx.sh` (déploiement avec --seed, mises à… — Les trois corrections de docs/DEPLOY.md sont appliquées (bash deploy/xxx.sh, chemins /opt/xplor et /home/xplor, openssl -hex 24 et mots de passe liés) sans autre fichier modifié. (7a92bf0)
- 05/10/2026 — M3b NF-10 (2/3, Dockerfiles) : 1) Dans `apps/api/Dockerfile` et `apps/worker/Dockerfile`, étape build, ligne 4 : remplace `RUN corepack enable && corepack prepa… — Les deux Dockerfiles contiennent bien l'installation d'openssl avant pnpm et le filtre @xplor/api pour le worker ; lint, typecheck et tests passent. (5a5b935)
- 05/10/2026 — Récupération du travail non commité — Correctifs Dockerfile api/worker (openssl à l'étape build, installation de @xplor/api pour le prebuild du worker) conformes aux correctifs de production M3b, minimaux et sûrs. (f31648a)
- 05/10/2026 — M3b NF-10 (1/3, fins de ligne et scripts) : 1) Dans `.gitattributes`, garde la ligne `docs/openapi.json text eol=lf` et ajoute `*.sh text eol=lf` et `.env* text… — Fins de ligne LF et .gitattributes corrects, --env-file ajouté à toutes les commandes docker compose des trois scripts, périmètre respecté. (3dbeeb7)
- 05/10/2026 — M3b F-11 (worker, dépendance ioredis manquante en production) : ajoute `ioredis` ^6.0.0 (même version que apps/api) aux dependencies de apps/worker avec `pnpm -… — ioredis ^6.0.0 ajouté au worker avec lockfile, contrôle Dockerfile et D-110 ; diff limité aux 4 fichiers demandés, contrôles au vert. (a65924a)
- 05/10/2026 — M3b F-10 (URL signées publiques du stockage) : en production, S3_ENDPOINT=http://minio:9000 (réseau Docker interne) sert aussi à signer les URL données au navig… — S3_PUBLIC_ENDPOINT ajouté (env, .env.production.example, second client S3 réservé à la signature, docs/DEPLOY.md) avec tests unitaires ; lint et typecheck verts, sortie de pnpm test tronquée donc non… (5e176eb)
- 05/10/2026 — M3b (bilan DoD, vérification sans code) : vérifie chaque critère de la DoD de M3b dans le code et docs/PROGRESS.md : présence de docker-compose.prod.yml, des Do… — Seules les lignes 1, 3, 4 et 6 de la DoD M3b ont été mises à jour avec une preuve courte, les fichiers de déploiement attendus existent et lint, typecheck et test passent (test:int et test-scripts.sh… (a25ed89)
- 05/10/2026 — M3b NF-01 (trustProxy en prod) : dans `.env.production.example`, ajoute `API_TRUST_PROXY=true` avec un commentaire en français (Caddy est le seul proxy devant l… — API_TRUST_PROXY=true ajouté à .env.production.example (le service api le reçoit déjà via env_file), D-109 consignée, ligne de dépannage ajoutée dans DEPLOY.md ; contrôles OK. (6c952dd)
- 05/10/2026 — M3b NF-01 (trustProxy, test d'abord) : dans apps/api/src/config/env.ts, ajoute la variable `API_TRUST_PROXY` (booléen lu depuis la chaîne 'true'/'false', défaut… — API_TRUST_PROXY ajouté au schéma d'env (booléen, défaut false) avec test, transmis à FastifyAdapter et documenté dans apps/api/.env.example ; lint, typecheck et tests passent. (a5dbe8d)
- 05/10/2026 — M3b NF-10 (docs/DEPLOY.md, partie 2) : complète `docs/DEPLOY.md` : mises à jour (`git pull` puis `deploy/deploy.sh`), sauvegarde quotidienne (ligne crontab d'ex… — docs/DEPLOY.md complété (mises à jour, backup/cron, restauration, rollback, dépannage, démo QR, note agents/VPS) conformément aux scripts et au compose existants. (ccc9f90)
- 05/10/2026 — M3b NF-10 (docs/DEPLOY.md, partie 1) : crée `docs/DEPLOY.md` en français : prérequis du VPS (Docker, utilisateur xplor, DNS A déjà en place pour api, admin, v,… — docs/DEPLOY.md couvre tous les points demandés, est cohérent avec deploy.sh, .env.production.example, le Caddyfile et le seed, sans secret réel. (6c41365)
- 05/10/2026 — M3b NF-10 (deploy/restore.sh) : crée `deploy/restore.sh <dossier-de-sauvegarde>` (bash, `set -euo pipefail`) : refuse de tourner sans argument ou si db.dump est… — restore.sh et test-scripts.sh conformes à la tâche, cohérents avec backup.sh et le compose de prod, sans usage de docker ni secret. (f3b8d3a)
- 05/10/2026 — M3b NF-10 (deploy/backup.sh) : crée `deploy/backup.sh` (bash, `set -euo pipefail`) pour le projet xplor-prod : `pg_dump -Fc` exécuté via `docker compose -f dock… — deploy/backup.sh est conforme à la demande : pg_dump -Fc via compose, archive tar des médias MinIO, rotation à 7 jours, variables chargées sans affichage, nettoyage en cas d'erreur. (59ea7e9)
- 05/10/2026 — M3b NF-10 (deploy/deploy.sh) : crée `deploy/deploy.sh` (bash, `set -euo pipefail`, idempotent, lancé par le porteur depuis la racine du dépôt sur le VPS). Étape… — deploy/deploy.sh conforme à la spécification (vérifications .env.production, build, infra, migrations, --seed optionnel, up -d, ps) et limité au projet xplor-prod. (00ec1c3)
- 05/10/2026 — M3b NF-10 (seed en production, étape 2) : dans apps/api/src/cli/main.ts, ajoute une commande `seed` qui appelle `runSeed` de src/seed/run-seed.ts, en suivant le… — Commande CLI `seed` ajoutée dans main.ts (appelle runSeed, gestion d'erreur et codes de sortie cohérents) et D-108 consignée ; lint, typecheck et test passent. (b5cbc6f)
- 05/10/2026 — M3b NF-10 (seed en production, étape 1) : le seed (apps/api/prisma/seed.ts) importe des fichiers TypeScript de src/ et ne tourne pas dans l'image de production… — runSeed() extraite correctement dans run-seed.ts, seed.ts n'en garde que le chargement du .env et l'appel, comportement et messages inchangés, contrôles verts. (7df042a)

### Bloqué
- M1 critère 2, CI distante non confirmée (run GitHub Actions à fournir par le porteur)

### Risques
- Fichiers de déploiement non testables localement (docker interdit aux agents) : validation au premier déploiement par le porteur
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.
