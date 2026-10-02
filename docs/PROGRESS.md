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
**Objectif :** API-24 (StorageService S3)

Plan :
- Ajouter StorageService avec méthodes S3 (presignPut, head, getRange, delete).
- Ajouter StorageModule global.
- Tests unitaires simulant le S3Client.
- Vérifier lint, typecheck, test.

## État des tâches

### Fait
- M1 validé par le porteur le 01/10/2026, détail dans docs/archive/PROGRESS-M1.md.
- M2 F-11 (1/n) : Initialisation du worker, module des dérivés (sharp), retrait du code en avance.
- M2 API-24 (1/2) : Schémas partagés d'upload de médias (`AssetUploadRequestSchema`, `AssetUploadResponseSchema`) et tests (lint, typecheck, test OK).
- M2 API-24 (2/2) : `StorageService` S3 et `StorageModule` global avec tests unitaires mockés via S3Client simulé (lint, typecheck, test OK).
- M2 F-10 : Règles de validation des panoramas (`validatePanoramaUpload`) avec tests unitaires (lint, typecheck, test OK).
- M2 API-24 : Route d'upload `POST /api/v1/admin/assets/upload-url` et logique S3 via `AssetsService`. Lint, typecheck et tests unitaires OK. `test:int` échoue car le service PostgreSQL n'est pas joignable (hors de mon périmètre).

### En cours
- M2 F-11 : configuration BullMQ et workers.

### Bloqué
- Aucun.

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
