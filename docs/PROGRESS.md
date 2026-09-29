# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-09 — Docker Compose (postgres, redis, minio, mailpit) et `docs/INSTALL.md`.

Plan, avant code :

1. `docker-compose.yml` à la racine : postgres:16-alpine (bases `xplor` et `xplor_test` via `docker/postgres/init.sql`), redis:7-alpine, minio + `minio-init` (image `minio/mc`, bucket `xplor`), mailpit (SMTP 1025, web 8025). Healthcheck et volume nommé pour postgres, redis, minio et mailpit. Identifiants par variables d'environnement, valeurs de dev dans `.env.example`.
2. `docs/INSTALL.md` : prérequis Docker Desktop (WSL2), Node 22, pnpm, puis les quatre commandes de NF-09.
3. Vérifier `docker compose config`. Si Docker Desktop est disponible, `docker compose up -d` et contrôler l'état healthy. Sinon, le noter comme bloqué.
4. Consigner les choix locaux (identifiants de dev, image `minio/minio`) dans `docs/DECISIONS.md`. Le commit demandé est laissé à l'orchestrateur.

Hors de cette session : NestJS, Prisma (`pnpm db:migrate` et `pnpm db:seed` existent à la racine, aucun paquet ne les implémente encore), squelettes d'applications, CI, authentification.

Session précédente (NF-06) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés.

Réalisé :

- `docker-compose.yml` : postgres:16-alpine, redis:7-alpine, minio (`minio/minio`) + `minio-init` (`minio/mc`, bucket `xplor`), mailpit (SMTP 1025, web 8025). Healthcheck et volume nommé pour les quatre services persistants. Identifiants via variables d'environnement (défauts de dev).
- `docker/postgres/init.sql` crée la base `xplor_test` ; la base `xplor` vient de `POSTGRES_DB`.
- `.env.example` documente `DATABASE_URL`, `DATABASE_URL_TEST`, `REDIS_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `SMTP_HOST`, `SMTP_PORT`, `SESSION_SECRET`, plus `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- `docs/INSTALL.md` : prérequis Docker Desktop (WSL2), Node 22, pnpm, puis les quatre commandes de NF-09. Choix locaux en D-31.
- Vérification bloquée sur ce poste : la commande `docker` est absente, WSL n'est pas installé, Docker Desktop n'est pas présent dans `Program Files`. `docker compose config` et `docker compose up -d` n'ont pas tourné ; l'état healthy des quatre services n'est pas constaté.
- Commit non créé : l'orchestrateur gère git. Message prévu : `M0 NF-09: docker compose postgres/redis/minio/mailpit`.

## Tableau

| État | Détail |
|---|---|
| Fait | NF-09 (fichiers) : squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md`. NF-08 (qualité) : ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests. NF-06 (paquet) : `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés. |
| En cours | M0 — Socle. Reste de NF-09 (`db:migrate`, `db:seed` — Prisma pas encore là), reste de NF-06 (RTL des écrans et aucune chaîne en dur — pas encore d'interface), reste de NF-08 (architecture NestJS, configuration Zod au démarrage, couverture ≥ 70 % sur les modules métier — pas encore de code applicatif), F-90 (sans 2FA). |
| Bloqué | Démarrage Docker de NF-09 : Docker Desktop et WSL2 absents du poste. `docker compose config` et `docker compose up -d` non exécutés ; les quatre services ne sont pas passés à l'état healthy. |
| Risques | Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm). ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, mais exigés par NF-08. Sans Docker, les healthchecks MinIO (`mc ready local`) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés sur les images tirées. Prisma et les applications ne sont pas encore là. |
