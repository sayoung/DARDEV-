# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-08 — application NestJS `@xplor/api` et configuration d'environnement validée par Zod.

Plan, avant code :

1. Créer `apps/api` (`@xplor/api`) : NestJS 11, adaptateur Fastify, préfixe global `/api/v1`, dépendance `workspace:*` vers `@xplor/shared`.
2. `src/config/env.ts` : schéma Zod (`NODE_ENV`, `PORT` défaut 3000, `DATABASE_URL`, `REDIS_URL`, `S3_*`, `SMTP_HOST`, `SMTP_PORT`, `SESSION_SECRET` ≥ 32) et `loadEnv(source)` qui lève une erreur nommant les variables invalides. Appel dans `main.ts` avant `NestFactory.create`. `ConfigModule` global expose le résultat.
3. Scripts `dev` (`nest start --watch`), `build`, `typecheck` (`tsc --noEmit`), `test`. Tests Vitest : env valide, secret trop court, variable manquante nommée.
4. Ajouter `PORT` à `.env.example`. Inscrire les paquets npm nouveaux dans `docs/DECISIONS.md`.
5. Vérifier `pnpm lint`, `pnpm typecheck`, `pnpm test`, puis démarrage et arrêt de `pnpm --filter @xplor/api dev` avec les valeurs de `.env.example`. Commit laissé à l'orchestrateur.

Hors de cette session : Prisma, squelettes admin/web/kiosk/worker, authentification.

Réalisé :

- `apps/api` (`@xplor/api`) : NestJS 11.2.6, adaptateur Fastify, préfixe `/api/v1`. `loadEnv` est appelé dans `main.ts` avant la création de l'application. `ConfigModule.forRoot` est global et expose l'environnement validé (jeton `ENV`). Dépendance `@xplor/shared` en `workspace:*`. Détail des paquets en D-33.
- `src/config/env.test.ts` : environnement valide accepté (`NODE_ENV` par défaut `development`, `PORT` par défaut 3000), `SESSION_SECRET` de 31 caractères refusé, `DATABASE_URL` absente nommée dans l'erreur.
- `.env.example` : `PORT=3000`.
- Vérification sous Node 22.23.3 et pnpm 9.15.9 : `pnpm lint`, `pnpm typecheck`, `pnpm test` (10 tests) et `pnpm --filter @xplor/api test` passent. `pnpm --filter @xplor/api build` passe. `pnpm --filter @xplor/api dev`, avec les valeurs de `.env.example`, écoute le port 3000 (`/api/v1/` répond 404 : aucun contrôleur pour l'instant) et l'arbre de processus s'arrête sans laisser de processus ni le port.
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-08: API NestJS Fastify et configuration Zod`.

Session précédente (NF-08 CI) : `.github/workflows/ci.yml`. Exécution distante en attente du dépôt privé DARDEV.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (fichiers) : squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md`. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-08 (CI, fichier) : `.github/workflows/ci.yml` (lint, typecheck, test, audit ; services postgres:16 et redis:7). NF-08 (API) : `@xplor/api`, NestJS 11 sur Fastify, préfixe `/api/v1`, `loadEnv` (Zod) avant le démarrage, `ConfigModule` global. NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. |
| En cours | M0 — Socle. Reste de NF-09 (`db:migrate`, `db:seed` — Prisma pas encore là), reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (modules métier, couverture ≥ 70 % sur `catalog`, `kiosks`, `stats`, `auth` et `viewer-core`), F-90 (sans 2FA). |
| Bloqué | Démarrage Docker de NF-09 : Docker Desktop et WSL2 absents du poste. `docker compose config` et `docker compose up -d` non exécutés ; les quatre services ne sont pas passés à l'état healthy. Exécution distante de la CI : en attente de la création du dépôt privé DARDEV sur GitHub. |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. `pnpm audit` signale 2 avis moderate sur Vitest 3.2.7 (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11) : le seuil CI est `high`, et D-29 maintient Vitest 3 pour `vitest.workspace.ts`. Sans Docker, les healthchecks MinIO (`mc ready local`) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés sur les images tirées. En CI, la base `xplor_test` n'existe pas tant que les tests d'intégration n'auront pas un moyen de la créer. Prisma, le back-office et l'authentification ne sont pas encore là. |
