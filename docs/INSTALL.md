# Installation — Xplor

## Prérequis

- Docker Desktop, backend WSL2
- Node.js 22 (le dépôt exige `>=22 <23`)
- pnpm 9 (le champ `packageManager` fixe pnpm 9.15.9)

Copier `.env.example` vers `.env` à la racine. Les valeurs fournies sont celles du développement local. Docker Compose les lit pour PostgreSQL, MinIO et le port SMTP ; les URL (`DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, etc.) serviront à l'API.

## Environnement complet (NF-09)

À la racine du dépôt, quatre commandes :

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
```

`docker compose up -d` démarre quatre services, chacun avec un healthcheck et un volume nommé :

| Service  | Image                | Ports hôte                 | Données                                                                                             |
| -------- | -------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| postgres | `postgres:16-alpine` | 5432                       | volume `postgres_data` ; bases `xplor` (`POSTGRES_DB`) et `xplor_test` (`docker/postgres/init.sql`) |
| redis    | `redis:7-alpine`     | 6379                       | volume `redis_data`                                                                                 |
| minio    | `minio/minio`        | 9000 (API), 9001 (console) | volume `minio_data` ; le service `minio-init` (`minio/mc`) crée le bucket `xplor` puis s'arrête     |
| mailpit  | `axllent/mailpit`    | 1025 (SMTP), 8025 (web)    | volume `mailpit_data`                                                                               |

`pnpm db:migrate` lance `prisma migrate dev` dans `@xplor/api`. `pnpm db:deploy` applique les migrations versionnées (`prisma migrate deploy`). `pnpm db:generate` régénère le client. La migration `init_users` est déjà dans le dépôt ; elle a été produite sans base locale (D-34) et doit être revalidée par `pnpm db:migrate` dès que Docker sera disponible. `pnpm db:seed` crée ou met à jour quatre utilisateurs actifs (un par rôle) avec le mot de passe `SEED_DEFAULT_PASSWORD`. L'hôtel, le kiosque et les visites de démonstration sont prévus au jalon M1.

## Tests d'intégration API (NF-08)

`pnpm test` lance les tests unitaires et ignore les fichiers `*.int.test.ts`.

`pnpm test:int` (identique à `pnpm --filter @xplor/api test:int`) lance le projet Vitest `api-int` contre PostgreSQL. Le `globalSetup` lit `DATABASE_URL_TEST` (fichier `.env` à la racine, ou variable déjà exportée). Si la variable est absente, ou si la base est injoignable, la commande s'arrête avec un message explicite et n'exécute pas les tests. Sinon elle applique `prisma migrate deploy` sur cette base. `resetDb()` vide ensuite les tables, sauf `_prisma_migrations`.

La base `xplor_test` est créée par `docker/postgres/init.sql` au premier démarrage d'un volume Postgres vide. Le test de seed a besoin de `SEED_DEFAULT_PASSWORD` (valeur de développement de `.env.example`, pas un secret).

```bash
docker compose up -d
pnpm test:int
```

## Contrôle

```bash
docker compose config
docker compose ps
```

`postgres`, `redis`, `minio` et `mailpit` doivent être `healthy`. `minio-init` doit s'être terminé avec le code 0.

## Applications (NF-08)

| Application     | Paquet          | Commande                          | Port                                                                                        |
| --------------- | --------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| Back-office     | `@xplor/admin`  | `pnpm --filter @xplor/admin dev`  | **5173** (Vite, `strictPort` ; le proxy de dev renvoie `/api` vers `http://localhost:3000`) |
| Visionneuse web | `@xplor/web`    | `pnpm --filter @xplor/web dev`    | **5174** (Vite, `strictPort`)                                                               |
| Kiosque         | `@xplor/kiosk`  | `pnpm --filter @xplor/kiosk dev`  | **5175** (Vite, `strictPort`)                                                               |
| Worker          | `@xplor/worker` | `pnpm --filter @xplor/worker dev` | aucun (processus Node, pas encore de BullMQ)                                                |

`pnpm dev` à la racine lance l'API, le back-office, le web, le kiosque et le worker (`--parallel`, D-42). La langue d'affichage du web et du kiosque vient de `?lang=` (`fr` par défaut, `ar`, `en`). Exemple : `http://localhost:5174/?lang=ar` pose `lang="ar"` et `dir="rtl"`.

Le back-office lit d'abord `?lang=`, puis la clé `localStorage` `xplor.lang`, sinon le français. Le sélecteur fr/ar/en change la langue sans recharger la page et enregistre ce choix. Exemple : `http://localhost:5173/?lang=ar` pose `lang="ar"` et `dir="rtl"`.

Le worker lit `REDIS_URL` (fichier `.env` à la racine, sinon la variable d'environnement). Au démarrage il écrit `worker prêt` sur la sortie standard.
