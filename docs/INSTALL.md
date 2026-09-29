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

| Service | Image | Ports hôte | Données |
|---|---|---|---|
| postgres | `postgres:16-alpine` | 5432 | volume `postgres_data` ; bases `xplor` (`POSTGRES_DB`) et `xplor_test` (`docker/postgres/init.sql`) |
| redis | `redis:7-alpine` | 6379 | volume `redis_data` |
| minio | `minio/minio` | 9000 (API), 9001 (console) | volume `minio_data` ; le service `minio-init` (`minio/mc`) crée le bucket `xplor` puis s'arrête |
| mailpit | `axllent/mailpit` | 1025 (SMTP), 8025 (web) | volume `mailpit_data` |

`pnpm db:migrate` et `pnpm db:seed` sont les scripts racine du monorepo. Ils appliqueront les migrations Prisma et le jeu de démonstration lorsque cette partie de NF-09 sera en place.

## Contrôle

```bash
docker compose config
docker compose ps
```

`postgres`, `redis`, `minio` et `mailpit` doivent être `healthy`. `minio-init` doit s'être terminé avec le code 0.
