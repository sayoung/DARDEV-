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

## Session en cours

**Date :** 02/10/2026
**Objectif :** Design 2/6 (mise en page commune)

Plan :
- Créer apps/admin/src/components/AppLayout.tsx avec la barre latérale, l'en-tête, le sélecteur de langue et la session.
- Supprimer les styles inutiles de style.css (.nav-list, .language-list).
- Adapter App.tsx pour utiliser AppLayout.
- Adapter les tests existants et s'assurer que lint, typecheck, et test sont au vert.

## État des tâches

### En cours
- Aucune tâche en cours pour le moment.

### Fait
- Design 2/6 (mise en page commune) : Création de `AppLayout.tsx` (barre latérale violette avec logo blanc, navigation avec mise en évidence, en-tête avec langue et bouton de déconnexion shadcn). Suppression des règles obsolètes de `style.css`. Adaptation des sélecteurs de `session.test.tsx` pour l'existence de plusieurs instances de noms ou de boutons de déconnexion. lint, typecheck, test OK.
- Design 1/6 (thème Xplor) : application des variables de thème shadcn (primary, background, etc.), ajout des polices auto-hébergées Montserrat et Comfortaa, copie des logos SVG de la charte. lint, typecheck, test OK.
- M2 F-11 (empreinte du fichier) : création de `apps/worker/src/derivatives/content-hash.ts` et `content-hash.test.ts` (sha256 hex 64 chars). lint, typecheck, test OK.
- M2 F-11 (configuration du worker) : extension du schéma Zod avec les variables S3 et DATABASE_URL. Validation complète avec retour des noms de variables manquantes. Tests de loadEnv et du boot mis à jour. lint, typecheck, test OK.
- M2 F-10 (lecture des dimensions JPEG) : ajout de image-size et sharp, création de readImageDimensions et de ses tests. Lint, typecheck et test OK.
- M2 F-11 (producteur BullMQ côté API) : ajout de `bullmq` à `apps/api`, création de `PanoramaQueueService` (jeton PANORAMA_QUEUE) et `QueueModule`. Import dans `AppModule`. Tests unitaires écrits. Lint, typecheck et test OK.
- M2 F-11 (dérivé tiles) : Création de `panorama.tiles.ts` pour extraire les 128 tuiles d'un panorama redimensionné (8192x4096), traité par lots de 8 pour limiter la mémoire. Test `panorama.tiles.test.ts` écrit et fonctionnel (timeout 30s). pnpm lint, typecheck, test OK.
- M2 F-11 (dérivés preview, web, thumb) : réécriture de `panorama.derivatives.ts` pour exporter `generateFlatDerivatives` (preview 512x256, web 4096x2048, thumb 400x225 centré sur vue initiale). Test vérifiant les dimensions sur un buffer généré en mémoire. pnpm lint, typecheck, test OK.
- M2 F-11 (grille des tuiles, fonction pure) : Création de `tileGrid()` et des constantes associées dans `apps/worker/src/derivatives/tile-grid.ts`. Tests unitaires complets écrits en premier dans `tile-grid.test.ts` (128 tuiles, bornes, unicité). pnpm lint, typecheck, test OK.
- M2 F-11 (file panorama, contrat partagé) : Création de `packages/shared/src/panorama-queue.ts` avec les types, constantes (file BullMQ) et fonctions utilitaires (`panoramaDerivativeKeys`, `panoramaTileKey`). Ajout de tests unitaires (lint, typecheck, test OK).
- M1 validé par le porteur le 01/10/2026, détail dans docs/archive/PROGRESS-M1.md.
- M2 F-11 (1/n) : Initialisation du worker, module des dérivés (sharp), retrait du code en avance.
- M2 F-11 (2/n) : Ajout du journal d'erreur (migration `asset_processing_log`, champ `processingLog` sur le modèle `Asset` et `AssetResponse`).
- M2 API-24 (1/2) : Schémas partagés d'upload de médias (`AssetUploadRequestSchema`, `AssetUploadResponseSchema`) et tests (lint, typecheck, test OK).
- M2 API-24 (2/2) : `StorageService` S3 et `StorageModule` global avec tests unitaires mockés via S3Client simulé (lint, typecheck, test OK).
- M2 F-10 : Règles de validation des panoramas (`validatePanoramaUpload`) avec tests unitaires (lint, typecheck, test OK).
- M2 API-24 : Route d'upload `POST /api/v1/admin/assets/upload-url` et logique S3 via `AssetsService`. Lint, typecheck et tests unitaires OK. `test:int` échoue car le service PostgreSQL n'est pas joignable (hors de mon périmètre).
- M2 F-10/API-24 : Route `complete` (`POST /api/v1/admin/assets/:id/complete`). Lecture de `StorageService.head`, extraction des dimensions des JPEG via `sharp` et `validatePanoramaUpload`. Mise en file `panoramaQueue`. Route ajoutée dans OpenAPI. Tests unitaires et intégration (HTTP 401/403) ajoutés. Lint, typecheck, test OK.
- M2 F-10/API-24 (retours de revue) : Suppression stricte des dérogations TypeScript (`any` et `eslint-disable`) dans `storage.service.test.ts` et `catalog.ts`. Mise à niveau de `z.nativeEnum` vers `z.enum` pour Zod 4. pnpm lint, typecheck et test passent sans erreur (code 0).

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
