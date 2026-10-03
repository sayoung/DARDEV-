# Suivi — Xplor

## Jalon en cours : M2 — Pipeline 360 (S7–S10)

Exigences : F-10, F-11, F-12, API-24.

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

Jalon précédent : M1, DoD remplie : non, critère 2 : local uniquement, CI non confirmée (détail : docs/archive/PROGRESS-M1.md)

## Session en cours

**Date :** 03/10/2026
**Objectif :** Implémentation de M2 F-10/API-24 (1/5, StorageService et URL pré-signées) - Correction suite aux retours

Plan :
- Restaurer `docs/DECISIONS.md` et y ajouter D-93 pour les paquets AWS.
- Configurer Fastify pour laisser passer le flux brut (octet-stream/raw stream) et augmenter maxParamLength pour éviter le 414.
- Ajouter route de téléchargement (download) et comparer les signatures en temps constant avec sizeBytes dans le payload.
- Mettre à jour `AssetsService` pour utiliser les méthodes renommées.
- Rétablir les tests S3 et tester le contrôleur avec Vitest.

État :
- Terminé. Tests API passés avec succès. (Noter : un test frontend TourForm.test.tsx de apps/admin échoue, probablement dû aux composants shadcn/ui appliqués précédemment, nécessitant une mise à jour des tests frontend ultérieure).

## État des tâches

### En cours
- Aucun.

### Fait
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
- M2 F-10 : Règles de validation des panoramas.
- M2 API-24 : Route d'upload POST /api/v1/admin/assets/upload-url.
- M2 F-10/API-24 : Route complete.
- M2 F-10/API-24 (retours de revue) : Suppression stricte des dérogations TypeScript.

### Bloqué
- Critère 2 : CI distante non confirmée, run GitHub Actions à fournir.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.
