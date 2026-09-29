# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-09 — Prisma dans `apps/api` (schéma `User`, migration initiale sans base, `PrismaModule`).

Plan, avant code :

1. Ajouter `prisma` et `@prisma/client` à `@xplor/api`. Schéma PostgreSQL (`DATABASE_URL`) : enum `Role` aligné sur `@xplor/shared`, modèle `User` (UUID v7, champs de la section 5.10 plus `failedLoginCount` et `lockedUntil`). Pas de `Hotel` ni de `UserHotel`.
2. Migration initiale par `prisma migrate diff` (Docker absent), dossier `prisma/migrations/<horodatage>_init_users/` et `migration_lock.toml`.
3. Scripts `db:migrate`, `db:deploy`, `db:generate`, et `postinstall` qui lance `prisma generate`. `PrismaModule` global et `PrismaService` (`onModuleInit` : `$connect`).
4. Test Vitest : les valeurs de `Role` Prisma et `@xplor/shared` sont identiques. Décision D-34 (génération hors Docker, paquets). Vérifier `prisma validate`, `pnpm typecheck`, `pnpm test`.

Hors de cette session : `db:seed`, Docker, authentification, modèles M1.

Réalisé :

- Prisma 6.19.3 dans `@xplor/api` (D-34). `schema.prisma` : PostgreSQL, `url = env("DATABASE_URL")`, enum `Role` (`ADMIN`, `EDITOR`, `HOTEL_MANAGER`, `PARTNER`), modèle `User` (UUID v7, champs section 5.10, `failedLoginCount`, `lockedUntil`). Pas de `Hotel` ni de `UserHotel`.
- Migration `prisma/migrations/20260929022909_init_users/migration.sql` produite par `prisma migrate diff --from-empty --to-schema-datamodel` (Docker absent), plus `migration_lock.toml`. À revalider par `prisma migrate dev` dès que Docker sera là.
- Scripts `db:migrate`, `db:deploy`, `db:generate` ; `postinstall` et `prebuild` lancent `prisma generate`. `PrismaModule` global, `PrismaService` connecté dans `onModuleInit` (déconnexion dans `onModuleDestroy`).
- `src/prisma/role.test.ts` : les valeurs de `Role` Prisma et `@xplor/shared` sont identiques.
- Vérification sous Node 22.23.3 : `prisma validate`, `pnpm typecheck`, `pnpm test` (11 tests) et `pnpm lint` passent. `prisma generate` réussit aussi sans `DATABASE_URL` (le postinstall de la CI n'a pas cette variable).
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-09: Prisma User et migration initiale`.

Session précédente (NF-08 API) : `@xplor/api` NestJS 11 sur Fastify, `loadEnv` Zod, `ConfigModule` global.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (fichiers) : squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md`. NF-09 (Prisma) : schéma `User` et enum `Role`, migration `20260929022909_init_users` (générée sans base, D-34), scripts `db:migrate` / `db:deploy` / `db:generate`, `PrismaModule` global. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-08 (CI, fichier) : `.github/workflows/ci.yml` (lint, typecheck, test, audit ; services postgres:16 et redis:7). NF-08 (API) : `@xplor/api`, NestJS 11 sur Fastify, préfixe `/api/v1`, `loadEnv` (Zod) avant le démarrage, `ConfigModule` global. NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. |
| En cours | M0 — Socle. Reste de NF-09 (`pnpm db:seed`, et appliquer la migration sur PostgreSQL dès que Docker sera là). Reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (modules métier, couverture ≥ 70 % sur `catalog`, `kiosks`, `stats`, `auth` et `viewer-core`), F-90 (sans 2FA). |
| Bloqué | Démarrage Docker de NF-09 : Docker Desktop et WSL2 absents du poste. `docker compose config`, `docker compose up -d` et `prisma migrate dev` non exécutés ; les quatre services ne sont pas passés à l'état healthy. Exécution distante de la CI : en attente de la création du dépôt privé DARDEV sur GitHub. |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. `pnpm audit` signale 2 avis moderate sur Vitest 3.2.7 (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11) : le seuil CI est `high`, et D-29 maintient Vitest 3 pour `vitest.workspace.ts`. Sans Docker, les healthchecks MinIO (`mc ready local`) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés sur les images tirées, et la migration `init_users` n'a pas été rejouée sur PostgreSQL 16. En CI, la base `xplor_test` n'existe pas tant que les tests d'intégration n'auront pas un moyen de la créer. Le back-office et l'authentification ne sont pas encore là. |
