# Installation — Xplor

## Prérequis

- Docker Desktop, backend WSL2. Si le moteur ne démarre pas, suivre « Dépannage : moteur Docker injoignable » ci-dessous.
- Node.js 22. `package.json` exige `>=22 <23` et `.nvmrc` contient `22`. Si le Node du terminal est une autre version : `nvm use 22` (ou `nvm use`, qui lit `.nvmrc`) avant `pnpm install`, `pnpm dev` et les tests.
- pnpm 9 (le champ `packageManager` fixe pnpm 9.15.9)

Deux copies identiques de `.env.example`. Les valeurs sont celles du développement local.

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

`loadEnv` (Zod, `apps/api/src/config/env.ts`) ne lit aucun fichier : il valide les variables déjà présentes. Le fichier qui les charge dépend de l'outil.

| Fichier            | Qui le lit                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env` à la racine | `process.loadEnvFile` (Node 22), sans écraser une variable déjà définie : API (`apps/api/src/main.ts`, le même `../../../.env` depuis `dist/main.js`), worker, `apps/api/prisma/seed.ts` (`SEED_DEFAULT_PASSWORD`), `globalSetup` de `pnpm test:int` (`DATABASE_URL_TEST`). Docker Compose interpole aussi ce fichier ; le Compose a déjà les mêmes valeurs par défaut. |
| `apps/api/.env`    | Prisma CLI (`pnpm db:migrate`, `pnpm db:deploy`, `pnpm db:generate`). Il s'arrête au `package.json` de `@xplor/api` et ne lit pas le `.env` de la racine. Il charge aussi `apps/api/prisma/.env` s'il existe : ne pas en créer un deuxième avec d'autres valeurs.                                                                                                       |

Sans `apps/api/.env`, `prisma migrate dev` et `prisma db seed` n'ont pas `DATABASE_URL` : le CLI charge le schéma avant de lancer `prisma/seed.ts`. Sans le `.env` racine, l'API, le worker et `pnpm test:int` n'ont pas leurs variables. `prisma/seed.ts` relit aussi ce fichier pour `SEED_DEFAULT_PASSWORD` ; une variable déjà posée par `apps/api/.env` n'est pas écrasée.

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

`pnpm test:int` (identique à `pnpm --filter @xplor/api test:int`) lance le projet Vitest `api-int` contre PostgreSQL. Le `globalSetup` lit `DATABASE_URL_TEST` dans le `.env` à la racine, ou une variable déjà exportée. Si la variable est absente, ou si la base est injoignable, la commande s'arrête avec un message explicite et n'exécute pas les tests. Sinon elle applique `prisma migrate deploy` sur cette base. `resetDb()` vide ensuite les tables, sauf `_prisma_migrations`.

La base `xplor_test` est créée par `docker/postgres/init.sql` au premier démarrage d'un volume Postgres vide. Le test de seed a besoin de `SEED_DEFAULT_PASSWORD` (valeur de développement de `.env.example`, pas un secret).

```bash
docker compose up -d
pnpm test:int
```

## Tests de bout en bout

`pnpm test:e2e` lance Playwright (`@playwright/test`, Chromium seulement) contre le back-office. Le premier parcours est un test de fumée : `http://localhost:5173/` s'affiche et `html` a `lang="fr"`. Playwright démarre `pnpm --filter @xplor/admin dev` si le port 5173 est libre. Hors CI, un serveur déjà lancé sur ce port est réutilisé.

Installer le navigateur une fois, puis lancer les tests :

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Contrôle

```bash
docker compose config
docker compose ps
```

`postgres`, `redis`, `minio` et `mailpit` doivent être `healthy`. `minio-init` doit s'être terminé avec le code 0.

## Dépannage : moteur Docker injoignable

Docker Desktop (backend WSL2) a besoin de la virtualisation matérielle et des fonctionnalités Windows « Plateforme d'ordinateur virtuel » et « Sous-système Windows pour Linux ». Sans elles, le client `docker` peut répondre alors que le moteur reste injoignable.

### Symptômes

- Journal du moteur : `Virtual Machine Platform not enabled`.
- Journal du moteur : `No virtualization available`.
- `docker version` sans section Server (le client seul répond ; souvent `500 Internal Server Error` sur le pipe `dockerDesktopLinuxEngine`).
- `wsl --status` indique que la virtualisation est désactivée. Message observé sur ce poste : « WSL2 ne peut pas démarrer, car la virtualisation n'est pas activée sur cet ordinateur. »

### Contrôle

Gestionnaire des tâches > Performances > Processeur. La ligne doit indiquer « Virtualisation : Activé ».

### Actions

1. Activer Intel VT-x ou AMD-V (SVM) dans le BIOS/UEFI.
2. Dans PowerShell lancé en administrateur :

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

3. Redémarrer l'ordinateur.
4. Puis :

```powershell
wsl --update
wsl --status
```

`wsl --status` ne doit plus indiquer que la virtualisation est désactivée.

5. Relancer Docker Desktop, puis vérifier que `docker version` affiche une section Server.

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
