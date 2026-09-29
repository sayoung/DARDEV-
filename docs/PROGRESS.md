# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** F-90 — logique `AccessPolicy` (fonctions pures, sans Prisma) et `PasswordSchema`.

Plan, avant code :

1. Définir `Principal` dans `@xplor/shared` (`userId`, `role`, `hotelIds`).
2. Tests Vitest d'abord pour `canManageContent`, `canManageUsers`, `canAccessHotel`, `scopeHotelIds`, `canViewRawStats` : chaque rôle, plus « gestionnaire de l'hôtel A ≠ hôtel B » et « partenaire de l'hôtel A ≠ hôtel B ». `canViewRawStats` est faux pour `PARTNER` (D-04).
3. Implémenter ces fonctions dans `apps/api/src/auth/access-policy.ts`, sans Prisma.
4. `PasswordSchema` Zod (minimum 12 caractères) dans `@xplor/shared`, avec un test.
5. Ajouter `@vitest/coverage-v8` (décision), vérifier `pnpm test` et la couverture à 100 % de `access-policy.ts`.

Hors de cette session : login, sessions, guards NestJS, 2FA, liste de mots de passe courants, invitation par courriel.

Réalisé :

- `Principal` dans `@xplor/shared` (`userId`, `role`, `hotelIds`). `PasswordSchema` : chaîne d'au moins 12 caractères, avec test.
- `apps/api/src/auth/access-policy.ts` : fonctions pures, sans Prisma. `canManageContent` (ADMIN, EDITOR), `canManageUsers` (ADMIN), `canAccessHotel` (ADMIN toujours ; HOTEL_MANAGER et PARTNER si l'hôtel est rattaché ; EDITOR jamais), `scopeHotelIds` (`ALL` pour ADMIN, liste vide pour EDITOR, liste rattachée sinon), `canViewRawStats` faux pour PARTNER (D-04).
- Tests Vitest des quatre rôles, dont « un gestionnaire de l'hôtel A ne voit pas l'hôtel B » et « un partenaire de l'hôtel A ne voit pas l'hôtel B ».
- `@vitest/coverage-v8` 3.2.7 (D-35). `vitest.config.ts` exige 100 % sur `access-policy.ts` et est inclus dans le `tsconfig.json` racine.
- Vérification sous Node 22.23.3 : `pnpm test` (24 tests), `pnpm exec vitest run --coverage` (`access-policy.ts` à 100 % lignes, branches, fonctions, instructions), `pnpm lint`, `pnpm typecheck`.
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 F-90: logique AccessPolicy et PasswordSchema`.

Session précédente (NF-09) : Prisma `User`, migration `20260929022909_init_users` générée sans base (D-34).

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (fichiers) : squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md`. NF-09 (Prisma) : schéma `User` et enum `Role`, migration `20260929022909_init_users` (générée sans base, D-34), scripts `db:migrate` / `db:deploy` / `db:generate`, `PrismaModule` global. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-08 (CI, fichier) : `.github/workflows/ci.yml` (lint, typecheck, test, audit ; services postgres:16 et redis:7). NF-08 (API) : `@xplor/api`, NestJS 11 sur Fastify, préfixe `/api/v1`, `loadEnv` (Zod) avant le démarrage, `ConfigModule` global. NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. F-90 (logique) : `AccessPolicy` pur dans `apps/api/src/auth/access-policy.ts` (couvert à 100 %), `Principal` et `PasswordSchema` (≥ 12 caractères) dans `@xplor/shared` (D-35). |
| En cours | M0 — Socle. Reste de NF-09 (`pnpm db:seed`, et appliquer la migration sur PostgreSQL dès que Docker sera là). Reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (modules métier, couverture ≥ 70 % sur `catalog`, `kiosks`, `stats`, `auth` et `viewer-core`). Reste de F-90 sans 2FA : login, sessions, guards, invitation, réinitialisation, verrouillage, liste de mots de passe courants. |
| Bloqué | Démarrage Docker de NF-09 : Docker Desktop et WSL2 absents du poste. `docker compose config`, `docker compose up -d` et `prisma migrate dev` non exécutés ; les quatre services ne sont pas passés à l'état healthy. Exécution distante de la CI : en attente de la création du dépôt privé DARDEV sur GitHub. |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. `pnpm audit` signale 2 avis moderate sur Vitest 3.2.7 (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11) : le seuil CI est `high`, et D-29 maintient Vitest 3 pour `vitest.workspace.ts`. Sans Docker, les healthchecks MinIO (`mc ready local`) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés sur les images tirées, et la migration `init_users` n'a pas été rejouée sur PostgreSQL 16. En CI, la base `xplor_test` n'existe pas tant que les tests d'intégration n'auront pas un moyen de la créer. Le back-office et l'authentification ne sont pas encore là. |
