# Décisions — Xplor

Décisions reprises du cahier des charges v2.0 (section 11.1), plus D-28 à D-30 propres à ce dépôt. « À valider : non » signifie que le porteur a déjà tranché, ou que la consigne de lancement du dépôt l'impose.

## D-03 — Langues

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** français (langue par défaut), arabe (RTL), anglais.
- **Alternatives :** français seul ; ajout d'autres langues dès la phase 1.
- **À valider :** non

## D-04 — Partenaires

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** les partenaires (SMIT, ministères) ne voient que des statistiques agrégées, jamais par hôtel.
- **Alternatives :** statistiques détaillées par hôtel pour les partenaires.
- **À valider :** non

## D-05 — Partage public

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** `publicShare` à `false` par défaut : une visite n'est accessible sur le web que si le partage est activé.
- **Alternatives :** partage public dès la création.
- **À valider :** non

## D-26 — Création en brouillon

- **Date :** validée en v1.0, consignée ici le 29/09/2026
- **Décision :** les visites, scènes et hôtels sont créés en brouillon.
- **Alternatives :** création directement publiée.
- **À valider :** non

## D-27 — Pile Node.js / TypeScript

- **Date :** 29/09/2026
- **Décision :** abandon de Drupal 11 au profit de Node.js / TypeScript (NestJS + PostgreSQL + Prisma + React pour le back-office). Le code Drupal de M0 et M1 est archivé (branche ou dossier `legacy-drupal/`, non maintenu) ; M0 et M1 sont refaits sur la nouvelle pile. Les scénarios déjà validés (« Visite manuelle » Porte / Jardin / Remparts, démo Kasbah des Oudayas / Jardin de Salé / Plage de Mehdia) sont repris comme critères d'acceptation et données de seed.
- **Alternatives :** poursuivre Drupal 11.
- **À valider :** non

## D-28 — Démarrage du dépôt xplor_smit

- **Date :** 29/09/2026
- **Décision :** dépôt xplor_smit démarré directement sur la pile Node.js v2.0 ; code Drupal conservé hors dépôt dans `D:\DARDEV\local\xplor`, non maintenu.
- **Alternatives :** archiver le code Drupal dans ce dépôt (`legacy-drupal/` ou branche `legacy-drupal`).
- **À valider :** non

## D-29 — Dépendances de validation et de qualité (NF-08)

- **Date :** 29/09/2026
- **Décision :** outillage de qualité à la racine et schémas partagés dans `@xplor/shared`. Versions majeures tenues à ce que demandent NF-08 et la section 4.1 du cahier : ESLint 9 (le registre npm propose déjà la 10), TypeScript 5 (la 7 est publiée, et `typescript-eslint` 8 n'accepte pas TypeScript ≥ 6.1), Vitest 3 (dernière majeure qui charge encore `vitest.workspace.ts`).
- **Alternatives :** prendre les dernières majeures du registre (ESLint 10, TypeScript 7, Vitest 5) et remplacer `vitest.workspace.ts` par `test.projects`.
- **À valider :** non

| Paquet            | Raison                                                                                                | Licence    |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| zod               | Schémas de validation partagés entre l'API et les fronts (`LocalizedTextSchema`, langues).            | MIT        |
| eslint            | Analyse statique ESLint 9, configuration plate `eslint.config.mjs`.                                   | MIT        |
| @eslint/js        | Règles recommandées ESLint, socle de la config plate.                                                 | MIT        |
| typescript-eslint | Règles TypeScript en mode `strict-type-checked`, dont `@typescript-eslint/no-explicit-any` en erreur. | MIT        |
| prettier          | Formatage commun (`.prettierrc`, `.prettierignore`).                                                  | MIT        |
| vitest            | Tests unitaires, fichier de workspace `vitest.workspace.ts`.                                          | MIT        |
| typescript        | `tsc --noEmit`, TypeScript 5 imposé par la pile.                                                      | Apache-2.0 |

## D-30 — Ressources `@xplor/i18n`

- **Date :** 29/09/2026
- **Décision :** `packages/i18n` exporte `resources` comme `{ fr, ar, en }` (arbres de clés imbriquées), plus `isRtl` et `dir`. Le type `Lang` vient de `@xplor/shared`. i18next n'est pas ajouté tant que le back-office React n'existe pas.
- **Alternatives :** envelopper dès maintenant au format i18next `{ translation: { ... } }` et dépendre du paquet `i18next`.
- **À valider :** oui

## D-31 — Services locaux Docker Compose (NF-09)

- **Date :** 29/09/2026
- **Décision :** identifiants de développement documentés dans `.env.example` et repris par défaut dans `docker-compose.yml` : utilisateur Postgres `xplor` / mot de passe `xplor`, clé MinIO `xplor` / secret `xplor-dev-secret` (MinIO refuse un secret de moins de 8 caractères), bucket `xplor`. L'image du serveur objet est `minio/minio` ; `minio/mc` sert uniquement à créer le bucket. `POSTGRES_USER`, `POSTGRES_PASSWORD` et `POSTGRES_DB` complètent la liste imposée pour que Compose et `DATABASE_URL` restent alignés. Healthcheck et volume nommé sur postgres, redis, minio et mailpit ; `minio-init` est un conteneur éphémère sans volume.
- **Alternatives :** secret MinIO identique au mot de passe Postgres (refusé par MinIO) ; image `quay.io/minio/minio` ; volume et healthcheck aussi sur `minio-init`.
- **À valider :** oui

## D-32 — Workflow CI GitHub Actions (NF-08)

- **Date :** 29/09/2026
- **Décision :** `.github/workflows/ci.yml` utilise `actions/checkout@v4`, `pnpm/action-setup@v4` (pnpm 9.15.9, champ `packageManager`) et `actions/setup-node@v4` (Node 22, `cache: pnpm`). Le dépôt est en pnpm 9 : `pnpm/setup` ne s'applique qu'à pnpm 11 et remplacerait `actions/setup-node`, ce que la consigne n'autorise pas. Les services CI sont `postgres:16` et `redis:7` (tags demandés ; le Compose local reste en variantes `-alpine`). Depuis le runner, les ports publiés sont joints via `localhost`. `DATABASE_URL`, `DATABASE_URL_TEST` et `REDIS_URL` reprennent les identifiants de développement de `.env.example` (D-31), en clair dans le workflow : ce ne sont pas des secrets de production, et le fichier ne référence aucun `secrets.*`. L'image Postgres officielle ne crée que la base `xplor` ; `xplor_test` n'est pas initialisée en CI (le script `docker/postgres/init.sql` ne peut pas être monté : les services démarrent avant `actions/checkout`). Les tests actuels ne s'y connectent pas.
- **Alternatives :** `pnpm/setup` (pnpm 11+) ; images `-alpine` comme en local ; monter `init.sql` ou créer `xplor_test` par `docker exec` ; passer les URL par secrets GitHub.
- **À valider :** oui

## D-33 — Application `@xplor/api` (NF-08)

- **Date :** 29/09/2026
- **Décision :** `apps/api` est l'application NestJS 11 sur adaptateur Fastify, préfixe global `/api/v1`. `loadEnv(source)` valide l'environnement avec Zod avant `NestFactory.create`. `NODE_ENV` absent ou vide vaut `development` (valeurs acceptées : `development`, `test`, `production`) : `.env.example` ne le fixe pas. `PORT` absent ou vide vaut 3000, et le fichier d'exemple le déclare aussi. Le fichier `.env` à la racine du dépôt, s'il existe, est chargé par `process.loadEnvFile` (Node 22) sans écraser les variables déjà présentes ; pas de paquet `dotenv`. Le jeton d'injection `ENV` est fourni par un `ConfigModule` global. Les modules Nest sont des classes décorées : `@typescript-eslint/no-extraneous-class` autorise ce cas (`allowWithDecorator`). `zod`, `typescript` et `vitest` sont déjà inscrits en D-29 ; l'API les redéclare comme dépendances directes.
- **Alternatives :** `tsx watch` à la place de `nest start --watch` ; paquet `dotenv` ; `NODE_ENV` obligatoire dans `.env.example`.
- **À valider :** non

| Paquet                   | Raison                                                                                                 | Licence    |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------- |
| @nestjs/common           | Socle des modules, contrôleurs et injection NestJS 11.                                                 | MIT        |
| @nestjs/core             | Démarrage de l'application (`NestFactory`).                                                            | MIT        |
| @nestjs/platform-fastify | Adaptateur HTTP Fastify imposé par le cahier des charges.                                              | MIT        |
| @nestjs/cli              | Scripts `dev` (`nest start --watch`) et `build` (`nest build`), métadonnées des décorateurs via `tsc`. | MIT        |
| @nestjs/schematics       | Collection déclarée par `nest-cli.json`.                                                               | MIT        |
| fastify                  | Serveur HTTP, dépendance de pair de `@nestjs/platform-fastify`.                                        | MIT        |
| reflect-metadata         | Réflexion exigée par les décorateurs NestJS.                                                           | Apache-2.0 |
| rxjs                     | Dépendance de pair de `@nestjs/common`.                                                                | Apache-2.0 |
| @types/node              | Types Node 22 (`process.env`, `process.loadEnvFile`).                                                  | MIT        |

## D-34 — Prisma 6 et migration initiale sans base (NF-09)

- **Date :** 29/09/2026
- **Décision :** `apps/api` utilise Prisma 6.19.3 (`prisma` en devDependency, `@prisma/client` en dépendance). Le bloc `datasource` reste dans `schema.prisma` avec `url = env("DATABASE_URL")`, comme l'exige NF-09. Prisma 7 et 8 (8.0.0-rc au registre) déplacent cette URL hors du schéma : ils ne sont pas retenus. L'enum `Role` du schéma reprend les quatre valeurs de `@xplor/shared` ; un test Vitest vérifie qu'elles restent identiques. Le modèle `User` couvre la section 5.10 plus `failedLoginCount` et `lockedUntil`. `Hotel` et `UserHotel` attendent M1. L'identifiant est un UUID v7 produit par le client Prisma (`@default(uuid(7))`) et stocké en `UUID` : PostgreSQL 16 n'a pas `uuidv7()`. `postinstall` et `prebuild` lancent `prisma generate`, pour que le client existe après l'installation et avant `nest build`.
- **Génération hors Docker :** la migration `prisma/migrations/20260929022909_init_users/migration.sql` a été produite par `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, sans base. Docker Desktop est absent, donc `prisma migrate dev` n'a pas été exécuté. Cette migration doit être revalidée par `prisma migrate dev` dès que Docker sera installé, avant de la considérer comme fusionnée. Ne pas l'éditer à la main une fois revalidée.
- **Alternatives :** Prisma 7+ avec `prisma.config.ts` ; rédiger le SQL à la main ; attendre Docker pour `prisma migrate dev --name init_users`.
- **À valider :** oui

| Paquet         | Raison                                                                                        | Licence    |
| -------------- | --------------------------------------------------------------------------------------------- | ---------- |
| prisma         | CLI : `migrate`, `generate`, `validate`. Version 6 pour garder `DATABASE_URL` dans le schéma. | Apache-2.0 |
| @prisma/client | Client Prisma utilisé par `PrismaService` au démarrage NestJS.                                | Apache-2.0 |

## D-35 — Couverture de `AccessPolicy` (F-90)

- **Date :** 29/09/2026
- **Décision :** `@vitest/coverage-v8` 3.2.7 (même majeure que Vitest, D-29) est le fournisseur de `vitest --coverage`. La configuration racine `vitest.config.ts` mesure `apps/api/src/auth/access-policy.ts` et exige 100 % (lignes, branches, fonctions, instructions). Ce fichier est inclus dans le `tsconfig.json` racine, comme `vitest.workspace.ts`, pour le typecheck et ESLint. Le fichier de workspace reste en place (D-29).
- **Alternatives :** `@vitest/coverage-istanbul` ; pas de seuil tant que la couverture globale des modules métier (NF-08, ≥ 70 %) n'est pas en place.
- **À valider :** oui

| Paquet              | Raison                                                                           | Licence |
| ------------------- | -------------------------------------------------------------------------------- | ------- |
| @vitest/coverage-v8 | Fournisseur V8 de `vitest --coverage`, pour vérifier `access-policy.ts` à 100 %. | MIT     |

## D-36 — Squelettes web, kiosque et worker (NF-08)

- **Date :** 29/09/2026
- **Décision :** `apps/web` et `apps/kiosk` sont des applications Vite + TypeScript sans framework (cahier, section 4.1). Les ports de dev sont fixes : 5174 (web) et 5175 (kiosk), `strictPort`. Les tests de `lang` / `dir` tournent dans Vitest avec **happy-dom** (environnement du `vitest.workspace.ts`), dépendance de développement à la racine pour que le lanceur unique la résolve. `apps/worker` est un processus Node : `src/main.ts` charge le `.env` racine s'il existe (même règle que l'API, D-33), valide `REDIS_URL` avec Zod, puis écrit `worker prêt`. BullMQ n'est pas encore une dépendance. Le script `dev` du worker utilise `tsx watch`, car les imports du dépôt sont en spécificateurs `.js` (NodeNext) et le type stripping de Node 22 ne les réécrit pas. Le `build` du worker est `tsc`.
- **Alternatives :** jsdom à la place de happy-dom ; lancer le worker avec `node --experimental-strip-types` et des imports `.ts` ; brancher BullMQ dès le squelette.
- **À valider :** oui

| Paquet    | Raison                                                                              | Licence |
| --------- | ----------------------------------------------------------------------------------- | ------- |
| vite      | Serveur de dev et build de production de `apps/web` et `apps/kiosk`.                | MIT     |
| happy-dom | Environnement DOM de Vitest pour vérifier `lang` et `dir` sur le web et le kiosque. | MIT     |
| tsx       | Exécution et rechargement de `apps/worker/src/main.ts` en développement.            | MIT     |

`zod`, `typescript`, `vitest` (D-29) et `@types/node` (D-33) sont redéclarés comme dépendances directes du worker, comme pour l'API.

## Encore à valider (cahier des charges, section 11.2)

Pas de numéro de décision tant que le porteur n'a pas tranché :

1. Matériel des kiosques : mini-PC + écran tactile 32" et/ou casque autonome (Meta Quest 3 / Pico 4).
2. Hébergement : VPS au Maroc ou cloud international ; stockage S3 (MinIO auto-hébergé ou service géré). Impact loi 09-08 et coût.
3. Nombre de visites prévues au lancement et liste des sites de la région Rabat-Salé-Kénitra.
4. Nom de domaine et charte graphique Xplor.
