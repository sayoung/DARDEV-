# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-08 — workflow GitHub Actions `.github/workflows/ci.yml`.

Plan, avant code :

1. Job unique `ubuntu-latest`, déclenché sur `push` et `pull_request` vers `main` et `develop`. Services `postgres:16` et `redis:7` avec healthchecks.
2. Étapes : `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` (Node 22, cache pnpm), puis `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --audit-level=high`.
3. Sur `pnpm test` : `DATABASE_URL`, `DATABASE_URL_TEST` et `REDIS_URL` vers ces services. Identifiants de développement de `.env.example` (D-31), écrits dans le fichier : aucun secret GitHub.
4. Vérifier le YAML (actionlint si disponible, sinon relecture) et enchaîner la même séquence de commandes en local. L'exécution distante attend le dépôt privé DARDEV. Le commit est laissé à l'orchestrateur.

Hors de cette session : NestJS, Prisma, squelettes d'applications, authentification.

Session précédente (NF-09) : `docker-compose.yml`, `docs/INSTALL.md`. Démarrage Docker bloqué (Docker Desktop / WSL2 absents).

Réalisé :

- `.github/workflows/ci.yml` : `push` et `pull_request` vers `main` et `develop` ; job unique `ubuntu-latest` ; services `postgres:16` et `redis:7` avec healthchecks ; `actions/checkout@v4`, `pnpm/action-setup@v4` (pnpm 9.15.9), `actions/setup-node@v4` (Node 22, cache pnpm). Étapes `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit --audit-level=high`. Choix de versions en D-32.
- `pnpm test` reçoit `DATABASE_URL`, `DATABASE_URL_TEST` et `REDIS_URL` vers `localhost` (ports publiés des services). Identifiants de développement de `.env.example`, aucun `secrets.*`.
- L'image `postgres:16` ne crée que la base `xplor`. `xplor_test` n'est pas créée en CI : `docker/postgres/init.sql` ne peut pas être monté (les services démarrent avant le checkout). Les tests actuels ne s'y connectent pas.
- Vérification : actionlint 1.7.12 (binaire de la release, pas installé sur le poste) ne signale aucune erreur. En local, sous Node 22.23.3 et pnpm 9.15.9 : `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (7 tests) et `pnpm audit --audit-level=high` passent. L'audit signale 2 avis moderate sur Vitest 3.2.7, sous le seuil `high`.
- Exécution distante : en attente de la création du dépôt privé DARDEV sur GitHub. Aucun push n'a été fait.
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-08: CI GitHub Actions lint/typecheck/test/audit`.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (fichiers) : squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md`. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-08 (CI, fichier) : `.github/workflows/ci.yml` (lint, typecheck, test, audit ; services postgres:16 et redis:7). NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. |
| En cours | M0 — Socle. Reste de NF-09 (`db:migrate`, `db:seed` — Prisma pas encore là), reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (architecture NestJS, configuration Zod au démarrage, couverture ≥ 70 % sur les modules métier — pas encore de code applicatif), F-90 (sans 2FA). |
| Bloqué | Démarrage Docker de NF-09 : Docker Desktop et WSL2 absents du poste. `docker compose config` et `docker compose up -d` non exécutés ; les quatre services ne sont pas passés à l'état healthy. Exécution distante de la CI : en attente de la création du dépôt privé DARDEV sur GitHub. |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. `pnpm audit` signale 2 avis moderate sur Vitest 3.2.7 (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11) : le seuil CI est `high`, et D-29 maintient Vitest 3 pour `vitest.workspace.ts`. Sans Docker, les healthchecks MinIO (`mc ready local`) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés sur les images tirées. En CI, la base `xplor_test` n'existe pas tant que les tests d'intégration n'auront pas un moyen de la créer. Prisma et les applications ne sont pas encore là. |
