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
- **Complément (29/09/2026, D-61) :** les images Docker Hub `minio/minio` et `minio/mc` ne se tirent plus. Compose construit `xplor-minio:2025-09-07`.
- **Alternatives :** secret MinIO identique au mot de passe Postgres (refusé par MinIO) ; image `quay.io/minio/minio` ; volume et healthcheck aussi sur `minio-init`.
- **À valider :** oui

## D-32 — Workflow CI GitHub Actions (NF-08)

- **Date :** 29/09/2026
- **Décision :** `.github/workflows/ci.yml` utilise `actions/checkout@v4`, `pnpm/action-setup@v4` (pnpm 9.15.9, champ `packageManager`) et `actions/setup-node@v4` (Node 22, `cache: pnpm`). Le dépôt est en pnpm 9 : `pnpm/setup` ne s'applique qu'à pnpm 11 et remplacerait `actions/setup-node`, ce que la consigne n'autorise pas. Les services CI sont `postgres:16` et `redis:7` (tags demandés ; le Compose local reste en variantes `-alpine`). Depuis le runner, les ports publiés sont joints via `localhost`. `DATABASE_URL`, `DATABASE_URL_TEST` et `REDIS_URL` reprennent les identifiants de développement de `.env.example` (D-31), en clair dans le workflow : ce ne sont pas des secrets de production, et le fichier ne référence aucun `secrets.*`. L'image Postgres officielle ne crée que la base `xplor` ; `xplor_test` n'est pas initialisée en CI (le script `docker/postgres/init.sql` ne peut pas être monté : les services démarrent avant `actions/checkout`). Les tests actuels ne s'y connectent pas.
- **Alternatives :** `pnpm/setup` (pnpm 11+) ; images `-alpine` comme en local ; monter `init.sql` ou créer `xplor_test` par `docker exec` ; passer les URL par secrets GitHub.
- **À valider :** oui
- **Complément (29/09/2026, D-59) :** après les tests d'intégration, le job démarre MinIO et l'API réelle sur la base `xplor`.

## D-33 — Application `@xplor/api` (NF-08)

- **Date :** 29/09/2026
- **Décision :** `apps/api` est l'application NestJS 11 sur adaptateur Fastify, préfixe global `/api/v1`. `loadEnv(source)` valide l'environnement avec Zod avant `NestFactory.create`. `NODE_ENV` absent ou vide vaut `development` (valeurs acceptées : `development`, `test`, `production`) : `.env.example` ne le fixe pas. `PORT` absent ou vide vaut 3000, et le fichier d'exemple le déclare aussi. Le fichier `.env` à la racine du dépôt, s'il existe, est chargé par `process.loadEnvFile` (Node 22) sans écraser les variables déjà présentes ; pas de paquet `dotenv`. Le jeton d'injection `ENV` est fourni par un `ConfigModule` global. Les modules Nest sont des classes décorées : `@typescript-eslint/no-extraneous-class` autorise ce cas (`allowWithDecorator`). `zod`, `typescript` et `vitest` sont déjà inscrits en D-29 ; l'API les redéclare comme dépendances directes.
- **Alternatives :** `tsx watch` à la place de `nest start --watch` ; paquet `dotenv` ; `NODE_ENV` obligatoire dans `.env.example`.
- **Complément (29/09/2026, D-64) :** le script `dev` est `tsx watch src/main.ts`. `nest build` reste le build de production.
- **À valider :** non

| Paquet                   | Raison                                                                                                        | Licence    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------- |
| @nestjs/common           | Socle des modules, contrôleurs et injection NestJS 11.                                                        | MIT        |
| @nestjs/core             | Démarrage de l'application (`NestFactory`).                                                                   | MIT        |
| @nestjs/platform-fastify | Adaptateur HTTP Fastify imposé par le cahier des charges.                                                     | MIT        |
| @nestjs/cli              | Script `build` (`nest build`), métadonnées des décorateurs via `tsc`. Le script `dev` est `tsx watch` (D-64). | MIT        |
| @nestjs/schematics       | Collection déclarée par `nest-cli.json`.                                                                      | MIT        |
| fastify                  | Serveur HTTP, dépendance de pair de `@nestjs/platform-fastify`.                                               | MIT        |
| reflect-metadata         | Réflexion exigée par les décorateurs NestJS.                                                                  | Apache-2.0 |
| rxjs                     | Dépendance de pair de `@nestjs/common`.                                                                       | Apache-2.0 |
| @types/node              | Types Node 22 (`process.env`, `process.loadEnvFile`).                                                         | MIT        |

## D-34 — Prisma 6 et migration initiale sans base (NF-09)

- **Date :** 29/09/2026
- **Décision :** `apps/api` utilise Prisma 6.19.3 (`prisma` en devDependency, `@prisma/client` en dépendance). Le bloc `datasource` reste dans `schema.prisma` avec `url = env("DATABASE_URL")`, comme l'exige NF-09. Prisma 7 et 8 (8.0.0-rc au registre) déplacent cette URL hors du schéma : ils ne sont pas retenus. L'enum `Role` du schéma reprend les quatre valeurs de `@xplor/shared` ; un test Vitest vérifie qu'elles restent identiques. Le modèle `User` couvre la section 5.10 plus `failedLoginCount` et `lockedUntil`. `Hotel` et `UserHotel` attendent M1. L'identifiant est un UUID v7 produit par le client Prisma (`@default(uuid(7))`) et stocké en `UUID` : PostgreSQL 16 n'a pas `uuidv7()`. `postinstall` et `prebuild` lancent `prisma generate`, pour que le client existe après l'installation et avant `nest build`.
- **Génération hors Docker :** la migration `prisma/migrations/20260929022909_init_users/migration.sql` a été produite par `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, sans base. Elle est revalidée sur PostgreSQL 16 (puce suivante). Ne pas l'éditer à la main.
- **Revalidée sur PostgreSQL 16 :** oui (29/09/2026, NF-09). `pnpm db:migrate` (`prisma migrate dev`, Node 22.23.3) sur la base `xplor` à `localhost:5432` : « Already in sync, no schema change or pending migration was found. » Aucune migration `fix_drift`. `20260929022909_init_users` et `20260929043449_user_tokens` ne sont pas modifiées. Une tentative antérieure le même jour avait échoué (moteur injoignable, `Virtual Machine Platform not enabled`) ; elle est caduque.
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

## D-37 — Argon2id et liste de mots de passe courants (F-90)

- **Date :** 29/09/2026
- **Décision :** `PasswordService` hache avec `@node-rs/argon2` 2.2, algorithme Argon2id explicite. Les coûts sont ceux du paquet, déjà alignés sur l'OWASP : mémoire 19 456 Kio, 2 passes, parallélisme 1. La liste embarquée est `apps/api/src/auth/common-passwords.txt`, copie de SecLists `Passwords/Common-Credentials/Pwdb_top-10000.txt` (exactement 10 000 entrées, dont `password1234`). Elle est lue une fois au chargement du module, comparaison insensible à la casse. `10k-most-common.txt` (10 001 lignes) et `xato-net-10-million-passwords-10000.txt` (9 999 mots uniques) ne contiennent pas `password1234` : ils ne peuvent pas servir le critère de F-90. Le verrouillage (10 échecs, 15 min, échéance incluse) est dans `lockout.ts`, sans dépendance. `nest-cli.json` copie le fichier texte vers `dist` pour le démarrage compilé.
- **Alternatives :** `10k-most-common.txt` ou la tranche xato des 10 000 ; paquet `argon2` (node-gyp) ; coûts laissés implicites.
- **À valider :** oui

| Paquet ou ressource                         | Raison                                                                                                             | Licence      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------ |
| @node-rs/argon2                             | Hachage et vérification argon2id, bindings Rust (sans node-gyp).                                                   | MIT          |
| SecLists `Pwdb_top-10000.txt`               | Liste embarquée des 10 000 mots de passe les plus courants. Le dépôt danielmiessler/SecLists est sous licence MIT. | MIT (dépôt)  |
| Probable-Wordlists (berzerk0), source amont | Même liste, publiée dans SecLists sous le nom `Pwdb_top-10000.txt`. Attribution conservée ici.                     | CC BY-SA 4.0 |

## D-38 — Santé `GET /api/health` (NF-04, NF-08)

- **Date :** 29/09/2026
- **Décision :** `GET /api/health` est exclu du préfixe global `/api/v1` via `setGlobalPrefix` (`exclude` sur `api/health`). `HealthService` agrège trois sondes injectées par jetons Nest (`DB_HEALTH_PROBE`, `REDIS_HEALTH_PROBE`, `STORAGE_HEALTH_PROBE`). Chaque sonde est plafonnée à 2 s. Le corps est `{ status: 'ok'|'error', checks: { db, redis, storage } }` ; HTTP 200 si les trois valent `ok`, 503 sinon. `RedisModule` (global) crée un seul client ioredis depuis `REDIS_URL` (`lazyConnect`) et le ferme dans `onModuleDestroy` par `disconnect()` : un `QUIT` attendrait une réponse et bloquerait l'arrêt si Redis est absent. L'événement `error` du client est absorbé pour que l'absence de Redis ne tue pas le processus. Le stockage appelle `HeadBucket` avec `endpoint` = `S3_ENDPOINT`, `forcePathStyle: true`, les identifiants `S3_ACCESS_KEY` / `S3_SECRET_KEY`, et la région `us-east-1` (exigée par le SDK ; MinIO l'ignore en path-style). `PrismaService.onModuleInit` attrape l'échec de `$connect` : l'API reste en écoute et `/api/health` répond 503.
- **Alternatives :** arrêter le processus si PostgreSQL est absent ; `redis.quit()` ; variable `S3_REGION` ; ioredis 5.
- **À valider :** oui (région fixe `us-east-1` ; ioredis 6.0.0, majeure récente, plutôt qu'ioredis 5)

| Paquet             | Raison                                                                                      | Licence    |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| ioredis            | Client Redis unique pour le `PING` du healthcheck, fermé à l'arrêt de `RedisModule`. 6.0.0. | MIT        |
| @aws-sdk/client-s3 | `HeadBucket` du healthcheck vers MinIO (`S3_ENDPOINT`, `forcePathStyle`). 3.1142.0.         | Apache-2.0 |

## D-39 — Sessions, cookie `xplor_sid` et CSRF (F-90)

- **Date :** 29/09/2026
- **Décision :** `@fastify/cookie` 11.1.2 (majeure compatible avec Fastify 5) est enregistré dans `main.ts`. Le cookie `xplor_sid` est `httpOnly`, `SameSite=Lax`, `path: '/'`, et `Secure` seulement si `NODE_ENV=production`. Sa valeur est l'identifiant opaque (32 octets en base64url), non signée : l'état reste dans Redis (`sess:<id>`, TTL d'inactivité 8 h renouvelé par `touch`, set `user-sess:<userId>`). `SESSION_SECRET` reste exigé par l'environnement et n'est pas encore consommé. `fastify` est épinglé à 5.11.3, la version déjà exigée par `@nestjs/platform-fastify` : deux copies (5.11.3 et 5.12.5) empêchaient l'augmentation de types du plugin cookie de s'appliquer à l'instance Nest. `InMemorySessionStore` n'est pas branché dans Nest : il sert aux tests. `SessionGuard` et `CsrfGuard` ne sont pas des guards globaux, pour que `GET /api/health` reste public. `Principal.hotelIds` est vide tant que `UserHotel` n'existe pas (M1). La comparaison CSRF utilise `crypto.timingSafeEqual` ; deux jetons de longueurs différentes sont refusés (403), car `timingSafeEqual` lèverait.
- **Alternatives :** signer le cookie avec `SESSION_SECRET` ; guard global et liste d'exclusion pour `/api/health` ; `ioredis-mock` pour exercer `RedisSessionStore`.
- **À valider :** oui (cookie non signé ; guards non globaux)

| Paquet          | Raison                                                                                      | Licence |
| --------------- | ------------------------------------------------------------------------------------------- | ------- |
| @fastify/cookie | Lire et poser le cookie de session `xplor_sid` (httpOnly, SameSite=Lax). 11.1.2, Fastify 5. | MIT     |

## D-40 — Login, logout, me et limite de débit (F-90, NF-01)

- **Date :** 29/09/2026
- **Décision :** `POST /api/v1/auth/login`, `POST /auth/logout` et `GET /auth/me` vivent dans `AuthModule`. Les schémas `LoginRequestSchema` et `MeResponseSchema` sont dans `@xplor/shared`. `AuthService` lit et met à jour les comptes via `UserRepository` (wrapper Prisma, remplacé par un faux dans les tests). L'email est comparé sans tenir compte de la casse (`mode: 'insensitive'`), après trim et mise en minuscules. Un email inconnu, un mauvais mot de passe et un compte inactif répondent 401 avec le code `INVALID_CREDENTIALS`. Pour un email inconnu, `PasswordService.verify` est appelé sur un hash argon2id précalculé (mêmes coûts que D-37) afin que le temps de réponse ne révèle pas l'existence du compte. Un compte déjà verrouillé (`isLocked`) répond 423 `ACCOUNT_LOCKED` sans nouvelle vérification du mot de passe. Chaque mot de passe faux appelle `registerFailure` et persiste `failedLoginCount` et `lockedUntil` : le 10e échec pose le verrou et répond encore 401 ; la tentative suivante répond 423, sans rallonger la fenêtre. Un succès remet le compteur à zéro, écrit `lastLoginAt`, détruit toutes les sessions du compte puis en crée une nouvelle (pas de fixation de session), pose le cookie `xplor_sid` et renvoie `MeResponse`. `POST` login et logout répondent 200 : le défaut Nest d'un `POST` est 201. Une langue `uiLang` hors fr/ar/en est lue comme `fr`. `@nestjs/throttler` 6.7.1 limite seulement `POST /auth/login` à 5 requêtes par 60 secondes et par IP (`req.ip`, stockage mémoire du paquet). Le guard n'est pas global, pour laisser `GET /api/health` public. La couverture Vitest mesure tout `apps/api/src/auth` avec un seuil de 70 % ; le seuil 100 % de `access-policy.ts` (D-35) reste un seuil par fichier.
- **Alternatives :** stockage Redis du compteur de débit ; répondre 423 dès le 10e échec ; guard de débit global avec `@SkipThrottle` sur le reste ; signer le cookie (déjà écarté en D-39).
- **À valider :** oui (compteur en mémoire ; 401 au 10e échec puis 423 à l'essai suivant ; destruction de toutes les sessions du compte à chaque login ; repli `uiLang` sur `fr`)

| Paquet            | Raison                                                                                 | Licence |
| ----------------- | -------------------------------------------------------------------------------------- | ------- |
| @nestjs/throttler | Limite `POST /auth/login` à 5 requêtes par minute et par IP (NF-01). 6.7.1, NestJS 11. | MIT     |

## D-41 — Seed des utilisateurs de démonstration (NF-09)

- **Date :** 29/09/2026
- **Décision :** `pnpm db:seed` exécute `prisma db seed` dans `@xplor/api`. Le champ `prisma.seed` lance `tsx prisma/seed.ts` (tsx déjà retenu en D-36 ; devDependency directe de l'API pour que le binaire soit résolu). Prisma 6.19 avertit que la clé `package.json#prisma` sera retirée en Prisma 7 au profit de `prisma.config.ts` : on la conserve, D-34 restant sur Prisma 6 et la consigne demandant `prisma.seed`. Le script charge le `.env` à la racine du dépôt, sans écraser les variables déjà présentes (même règle que l'API, D-33) : Prisma ne lit de lui-même que `apps/api/.env`. `SEED_DEFAULT_PASSWORD` (exemple `xplor-seed-dev-2026`) est validé par `validateNewPassword` avant l'upsert ; un refus produit un message qui cite la variable. Le hash est argon2id via `PasswordService` (D-37). L'upsert se fait sur `email` et réécrit `name`, `passwordHash`, `role`, `active` et `uiLang`. `failedLoginCount`, `lockedUntil`, `lastLoginAt` et le TOTP ne sont pas remis à zéro. Les noms affichés sont Administrateur, Éditeur, Gestionnaire, Partenaire. Hôtel, kiosque et visites restent hors de ce seed (M1, déjà acté pour `Hotel` en D-34).
- **Alternatives :** `prisma.config.ts` (Prisma 7, écarté par D-34) ; `node --experimental-strip-types` (les imports `.js` ne sont pas réécrits, D-36) ; tout remettre à zéro à chaque seed, y compris le verrouillage ; placer `SEED_DEFAULT_PASSWORD` seulement dans `apps/api/.env`.
- **À valider :** oui (valeur de développement du mot de passe ; colonnes laissées intactes lors d'un re-seed)

| Paquet | Raison                                                                                                   | Licence |
| ------ | -------------------------------------------------------------------------------------------------------- | ------- |
| tsx    | Exécute `prisma/seed.ts` (déjà la dépendance de `@xplor/worker`, D-36). 4.23.15, devDependency de l'API. | MIT     |

## D-42 — Application `@xplor/admin` (NF-08, NF-06)

- **Date :** 29/09/2026
- **Décision :** `apps/admin` est le back-office React 19 + Vite, paquet `@xplor/admin`, port de dev **5173** (`strictPort`). Le proxy Vite renvoie `/api` vers `http://localhost:3000` (l'API et `GET /api/health` restent sur ce préfixe). i18next et react-i18next consomment `resources` exporté par `@xplor/i18n` (D-30) : les JSON ne sont pas copiés dans l'application. La langue au démarrage est `?lang=` (fr, ar ou en), sinon la clé `localStorage` `xplor.lang`, sinon `fr`. Le paramètre d'URL ne réécrit pas le stockage. Le sélecteur enregistre `xplor.lang` et met à jour `lang` et `dir` sans rechargement. Les libellés du sélecteur sont les clés `common.language.*`. Les tests du back-office tournent sous **jsdom** (consigne NF-08 de ce squelette) ; le web et le kiosque restent sous happy-dom (D-36). `jsdom` est une devDependency racine pour que le lanceur Vitest unique le résolve, et une devDependency de `@xplor/admin` pour son script `test`. Le script racine `dev` nomme `@xplor/admin` avec l'API, le web, le kiosque et le worker, et passe `--parallel` : la concurrence par défaut de `pnpm -r` est 4, un cinquième processus resterait en attente. Le projet Vitest de l'admin ne charge pas `vite.config.ts` : Vitest 3 transforme avec Vite 7, tandis que `@vitejs/plugin-react` 6 cible Vite 8. Les tests JSX passent par esbuild. `react` 19.3.0 ne publie plus ses types : `@types/react` et `@types/react-dom` sont des devDependencies.
- **Alternatives :** happy-dom pour les tests admin ; copier les JSON dans `apps/admin` ; laisser `pnpm -r dev` sans `--parallel`.
- **À valider :** oui (clé `xplor.lang` ; jsdom pour l'admin ; `--parallel` sur le script `dev`)

| Paquet                 | Raison                                                                                                 | Licence |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| react                  | UI du back-office, React 19. 19.3.0.                                                                   | MIT     |
| react-dom              | Rendu dans le DOM. 19.3.0.                                                                             | MIT     |
| @vitejs/plugin-react   | Transformation JSX et Fast Refresh pour Vite 8. 6.1.1.                                                 | MIT     |
| i18next                | Internationalisation du back-office, alimentée par `@xplor/i18n` (levée de l'attente de D-30). 26.4.2. | MIT     |
| react-i18next          | Liaison de i18next avec React. 17.0.15.                                                                | MIT     |
| @testing-library/react | Rendu des composants dans les tests Vitest. 16.3.3.                                                    | MIT     |
| @types/react           | Types TypeScript de React 19. Le paquet `react` 19.3.0 ne les embarque plus.                           | MIT     |
| @types/react-dom       | Types TypeScript de `react-dom`. 19.3.0.                                                               | MIT     |
| jsdom                  | Environnement DOM des tests `@xplor/admin`. 30.1.1.                                                    | MIT     |

`vite`, `typescript` et `vitest` (D-29, D-36) sont redéclarés comme dépendances directes de `@xplor/admin`, comme pour le web et le kiosque.

## D-43 — Session du back-office (F-90)

- **Date :** 29/09/2026
- **Décision :** Le client `apps/admin` appelle `/api/v1/auth/login`, `/api/v1/auth/logout` et `/api/v1/auth/me` (préfixe global de l'API) en `credentials: 'include'`, pour que le cookie `xplor_sid` reste sur la même origine que le proxy Vite. Le jeton CSRF est gardé en mémoire de module, uniquement après un `MeResponseSchema` réussi (`login` ou `me`). Il est envoyé dans `X-CSRF-Token` pour toute méthode autre que GET, HEAD ou OPTIONS, et retiré après un logout réussi. Il n'est pas écrit dans `localStorage`. Au chargement, un échec de `GET /auth/me` affiche le formulaire sans alerte. Le code d'erreur est lu sur `code` (corps actuel de `HttpException`), sinon sur `error.code` (enveloppe du cahier). 401 `INVALID_CREDENTIALS` affiche `auth.login.error` ; 423 `ACCOUNT_LOCKED` affiche `auth.login.locked` ; tout autre échec de connexion (autre statut, corps illisible, réseau, validation Zod du corps) affiche `auth.login.failed`. Le rôle sur l'accueil passe par `auth.role.ADMIN`, `auth.role.EDITOR`, `auth.role.HOTEL_MANAGER` et `auth.role.PARTNER` (fr/ar/en), jamais par la valeur d'énumération. Aucun paquet ajouté.
- **Alternatives :** stocker le jeton dans `sessionStorage` ; ne l'envoyer que sur logout ; basculer la langue de l'interface sur `uiLang` du profil ; n'accepter que l'enveloppe `error.code` ; afficher le code `Role` tel quel ; n'afficher un message que pour 401 et 423.
- **À valider :** oui (jeton CSRF en mémoire de module ; lecture des deux formes de corps d'erreur ; libellés des quatre rôles)

## D-44 — Jetons d'invitation et de réinitialisation (F-90)

- **Date :** 29/09/2026
- **Décision :** `UserToken` persiste l'empreinte SHA-256 hexadécimale d'un jeton de 32 octets encodé en base64url. Le jeton en clair n'est jamais stocké. `expiryFor` vaut 48 h pour `INVITE` (F-90) et 1 h pour `PASSWORD_RESET`. `checkToken` renvoie `NOT_FOUND` si l'enregistrement est absent, `USED` dès que `usedAt` est renseigné (y compris si l'échéance est aussi dépassée), `EXPIRED` lorsque `now` est strictement après `expiresAt`, et `OK` à l'instant exact de `expiresAt`.
- **Migration hors Docker :** `prisma migrate diff --from-migrations` exige `--shadow-database-url`. Le port 5432 est fermé et Docker est absent, donc la migration `20260929043449_user_tokens` a été produite par `prisma migrate diff --from-schema-datamodel` (schéma équivalent à `20260929022909_init_users`) `--to-schema-datamodel prisma/schema.prisma --script`. `init_users` n'est pas modifié. Cette migration doit être revalidée par `prisma migrate dev` dès que Docker sera installé, avant de la considérer comme fusionnée (D-34).
- **Revalidée sur PostgreSQL 16 :** non (29/09/2026). Même prérequis que D-34 : moteur linux/wsl arrêté (`Virtual Machine Platform not enabled`). `20260929043449_user_tokens` n'a pas été appliquée. Aucune migration `fix_drift`. Le fichier existant n'est pas édité.
- **Alternatives :** empreinte argon2id ; réinitialisation valable 24 h ; traiter l'instant `expiresAt` comme déjà expiré ; attendre une base fantôme pour `--from-migrations`.
- **À valider :** oui (durée 1 h du jeton `PASSWORD_RESET` ; échéance encore valide à l'instant exact ; `USED` prioritaire sur `EXPIRED`)

## D-45 — Courriels d'invitation et de réinitialisation (F-90)

- **Date :** 29/09/2026
- **Décision :** `MailModule` est global. Le jeton `MAILER` expose `SmtpMailer` (nodemailer vers `SMTP_HOST` / `SMTP_PORT`, `secure: false`, sans propriété `auth` : Mailpit local n'en demande pas). `FakeMailer` n'est pas branché dans Nest : il garde les messages en mémoire pour les tests. L'expéditeur SMTP est fixe, `Xplor <noreply@xplor.local>`, car `Mailer.send` ne porte pas de champ `from`. `ADMIN_BASE_URL` est une URL ; absente ou vide, elle vaut `http://localhost:5173` (port du back-office, D-42). `mailActionLink` retire les barres finales puis ajoute `/invite/<token>` ou `/reset/<token>`. `renderMail(kind, lang, link)` lit `mail.invite.*` ou `mail.reset.*` dans `@xplor/i18n` (sujet, texte, HTML) pour la langue `uiLang` du destinataire et remplace `{link}`. Le HTML échappe `&`, `<`, `>` et `"`. `apps/api` dépend de `@xplor/i18n` et active `resolveJsonModule` pour suivre cet import.
- **Alternatives :** variable `MAIL_FROM` ; authentification SMTP dès le développement ; corps HTML généré hors des clés i18n.
- **À valider :** oui (expéditeur fixe ; emplacement `{link}`)

| Paquet            | Raison                                                                                                  | Licence |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------- |
| nodemailer        | Envoi SMTP vers Mailpit (`SMTP_HOST`, `SMTP_PORT`, sans authentification). 10.0.12.                     | MIT-0   |
| @types/nodemailer | Déclarations TypeScript de nodemailer (`createTransport`, options SMTP). 8.0.2, devDependency de l'API. | MIT     |

## D-46 — Réinitialisation du mot de passe (F-90)

- **Date :** 29/09/2026
- **Décision :** `POST /api/v1/auth/password/forgot` répond toujours **202**, que l'adresse soit inconnue, le compte inactif, ou le courriel envoyé. Le corps est vide. Cela évite d'énumérer les comptes. Seul un compte actif déclenche l'envoi. L'email est normalisé (trim, minuscules), comme au login (D-40). Les jetons `PASSWORD_RESET` encore inutilisés de ce compte sont invalidés **avant** d'en créer un nouveau : `invalidateUnused` pose `usedAt` sur la ligne existante. Une nouvelle demande refuse donc l'ancien jeton. Le jeton en clair voyage seulement dans le lien `ADMIN_BASE_URL/reset/<token>` ; la base ne reçoit que l'empreinte SHA-256 (D-44). `POST /api/v1/auth/password/reset` répond **204**. Les deux routes sont publiques : pas de `SessionGuard`, pas de `CsrfGuard`. Seul `forgot` est limité à 5 requêtes par minute et par IP, avec le même `@nestjs/throttler` en mémoire que le login (D-40). `checkToken` qui renvoie `NOT_FOUND`, `EXPIRED` ou `USED` produit le même 400 `TOKEN_INVALID`, y compris pour un jeton d'invitation présenté ici. `validateNewPassword` produit 400 `PASSWORD_TOO_COMMON` ou `PASSWORD_INVALID` (échec de `PasswordSchema`) ; le jeton n'est pas consommé. Le schéma `ResetPasswordRequestSchema` réutilise `PasswordSchema` : un mot de passe trop court est refusé par le contrôleur avec `PASSWORD_INVALID` avant le service. Ensuite, une transaction Prisma interactive hache en argon2id puis écrit `passwordHash`, `usedAt = now`, `failedLoginCount = 0` et `lockedUntil = null`. `SessionStore.destroyAllForUser` n'est appelé qu'après le commit. Aucun paquet ajouté.
- **Complément (relecture) :** Un échec après la décision d'envoyer (persistance du jeton ou SMTP) est avalé par `forgotPassword` et par le contrôleur. La réponse reste 202, corps vide. Le journal ne reçoit qu'une mention fixe, sans adresse, sans message d'exception et sans jeton : le texte SMTP pourrait contenir le lien. Le temps de réponse peut encore différer lorsqu'un courriel part, parce qu'un compte inconnu ou inactif ne déclenche aucun envoi. `markUsed` ne met à jour que la ligne dont `usedAt` est encore null (`updateMany`). Si aucune ligne n'est prise, la transaction est annulée et la réponse reste 400 `TOKEN_INVALID` : deux demandes parallèles ne changent pas toutes les deux le mot de passe. Un compte absent ou inactif reçoit le même `TOKEN_INVALID` **avant** le contrôle du nouveau mot de passe ; le jeton est consommé, le mot de passe et les sessions ne changent pas. Si le compte est désactivé entre cette lecture et l'écriture, la transaction n'écrit pas le mot de passe non plus.
- **Alternatives :** répondre 200 avec un message identique ; supprimer les anciens jetons au lieu de poser `usedAt` ; hacher hors de la transaction puis n'y mettre que les deux écritures ; limiter aussi `password/reset` ; distinguer 400 selon que le jeton est expiré ou inconnu ; propager l'erreur SMTP (500 qui révèle le compte) ; `update` inconditionnel de `usedAt` (deux resets parallèles réussissent).
- **À valider :** oui (réponse 202 uniforme, y compris si l'envoi échoue ; invalidation par `usedAt` ; hachage argon2id tenu dans la transaction interactive ; jeton à usage unique même en parallèle ; compte inactif traité comme un jeton invalide)

## D-47 — Invitation par l'ADMIN (F-90, API-28 partiel)

- **Date :** 29/09/2026
- **Décision :** `POST /api/v1/admin/users/invitations` est réservé à `ADMIN` (`SessionGuard`, `CsrfGuard`, `canManageUsers`). EDITOR, HOTEL_MANAGER et PARTNER reçoivent 403, même avec des hôtels rattachés. La route n'est pas limitée en débit : l'appelant est déjà authentifié. Le corps est `InviteUserRequestSchema` (email, nom non vide, `Role`, `uiLang`). La réponse 201 est `InviteUserResponseSchema` (id, email, nom, rôle). L'email est normalisé (trim, minuscules), comme au login (D-40). S'il existe déjà et que le compte est actif ou s'est déjà connecté, le service répond 409 `EMAIL_TAKEN`, sans courriel et sans nouveau jeton (le cas inactif jamais connecté est traité en D-63). Le compte est créé avec `active=false`. `passwordHash` est l'argon2id d'un secret de 32 octets (base64url) qui n'est ni stocké, ni envoyé, ni renvoyé. Les jetons `INVITE` encore inutilisés de ce compte sont marqués `usedAt` avant d'en créer un nouveau, valable 48 h (D-44). Le courriel est `renderMail('invite', uiLang, lien)` avec `ADMIN_BASE_URL/invite/<token>` (D-45). `POST /api/v1/auth/invite/accept` est public, limité à 5 requêtes par minute et par IP (même compteur mémoire que le login, D-40), et répond 204 sans poser de cookie de session. `checkToken` qui n'est pas `OK`, un jeton d'un autre type, ou un compte absent produisent le même 400 `TOKEN_INVALID`. Le jeton d'un compte absent est consommé avant le contrôle du mot de passe. `validateNewPassword` produit 400 `PASSWORD_TOO_COMMON` ou `PASSWORD_INVALID` sans consommer le jeton. La transaction pose `usedAt` seulement si le jeton est encore libre, puis hache le mot de passe choisi et passe `active` à true. Elle ne remet pas `failedLoginCount` ni `lockedUntil` à zéro (contrairement à D-46) et ne détruit pas de session. Le reste de l'API-28 (CRUD complet, rattachement aux hôtels) reste pour M1/M8. Aucun paquet ajouté.
- **Alternatives :** créer le compte déjà actif ; renvoyer une invitation pour un email inactif au lieu de 409 ; ouvrir une session à l'acceptation ; répondre 200 avec un corps ; remettre le verrouillage à zéro comme pour la réinitialisation ; distinguer un jeton expiré d'un jeton inconnu ; hacher le mot de passe avant de poser `usedAt` (deux acceptations parallèles pourraient alors écrire le mot de passe si la transaction simulée des tests n'annule pas).
- **Complément (29/09/2026, D-63) :** le 409 systématique pour un compte encore inactif est remplacé lorsque `active` est false et `lastLoginAt` est null. Le reste de D-47 ne change pas.
- **À valider :** oui (compte inactif jusqu'à l'acceptation ; pas de session à l'acceptation ; pas de remise à zéro du verrouillage ; `usedAt` avant le hachage dans la transaction)

## D-48 — Écrans de réinitialisation et d'invitation (F-90)

- **Date :** 29/09/2026
- **Décision :** Le back-office route `/forgot`, `/reset/<token>` et `/invite/<token>` avec `history.pushState` et l'événement `popstate`, sans paquet de routage. Toute autre adresse affiche la session (connexion ou accueil). Les liens interceptent le clic simple et laissent le navigateur ouvrir un nouvel onglet si un modificateur est enfoncé. `?lang=` est conservé lors d'un changement d'écran. Après un mot de passe enregistré, l'adresse redevient `/` avec `notice=reset` ou `notice=invite`, et le message `auth.setPassword.successReset` ou `auth.setPassword.successInvite` s'affiche. `POST /api/v1/auth/password/forgot` (202), `POST /api/v1/auth/password/reset` (204) et `POST /api/v1/auth/invite/accept` (204) passent par `client.ts`, qui parse les schémas de `@xplor/shared` avant l'envoi. L'écran d'oubli affiche toujours `auth.forgot.sent` quand la réponse est acceptée, sans dire si le compte existe. Une confirmation différente ou un mot de passe refusé par `PasswordSchema` n'appelle pas le réseau. `TOKEN_INVALID`, `PASSWORD_TOO_COMMON` et `PASSWORD_INVALID` (400) utilisent `auth.errors.*`. Tout autre échec utilise `auth.errors.request`. Aucun paquet ajouté.
- **Alternatives :** `react-router-dom` ; afficher la confirmation d'oubli même si le réseau échoue ; message de succès seulement dans l'état React, perdu au rafraîchissement.
- **À valider :** oui (routeur maison ; paramètre `notice` ; confirmation uniquement sur réponse acceptée)

## D-49 — Documentation OpenAPI depuis les schémas Zod (NF-08)

- **Date :** 29/09/2026
- **Décision :** Le document OpenAPI 3.1 est produit par `@asteasolutions/zod-to-openapi` 9.1.0 (`OpenApiGeneratorV31`) dans `apps/api/src/openapi/registry.ts`. Les corps de `login`, `me`, mot de passe oublié, réinitialisation, invitation et acceptation sont les schémas Zod de `@xplor/shared`, pas des DTO recopiés. Le script `pnpm --filter @xplor/api openapi` écrit `docs/openapi.json`. Un test compare ce fichier au document régénéré. `GET /api/v1/openapi.json` renvoie le document lorsque `NODE_ENV` vaut `development` ou `test`, et répond 404 en `production`. Le cookie `xplor_sid` et l'en-tête `X-CSRF-Token` sont des schémas de sécurité `apiKey`. `@nestjs/swagger`, cité en section 4.1 du cahier, n'est pas ajouté : il décrirait les mêmes corps une seconde fois, en classes. L'interface `/api/docs` de la section 6 n'est pas servie dans ce jalon.
- **Complément (relecture) :** `.gitattributes` force `docs/openapi.json` en `text eol=lf`. Avec `core.autocrlf=true`, Git réécrit sinon le fichier en CRLF au checkout et le test d'identité échoue. Le test remplace aussi les `\r\n` par `\n` avant la comparaison. `git add --renormalize` n'a pas été lancé : l'orchestrateur gère git.
- **Alternatives :** `@nestjs/swagger` ; paquet `zod-openapi` (samchungy) ; ne pas répondre 404 en production et ne pas enregistrer la route.
- **À valider :** oui (pas d'interface Swagger ; JSON public hors production ; 404 plutôt qu'une route absente)

| Paquet                         | Raison                                                                                     | Licence |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------- |
| @asteasolutions/zod-to-openapi | OpenAPI 3.1 depuis les schémas Zod 4 de `@xplor/shared`, sans redéclarer les corps. 9.1.0. | MIT     |

## D-50 — Tests d'intégration API sur PostgreSQL (NF-08)

- **Date :** 29/09/2026
- **Décision :** Le projet Vitest `api-int` vit dans `apps/api/vitest.int.config.ts` (`pnpm --filter @xplor/api test:int`, et `pnpm test:int` à la racine). Il n'est pas ajouté à `vitest.workspace.ts`. `pnpm test` exclut `**/*.int.test.ts` (racine et projet `@xplor/api`). `globalSetup` charge le `.env` racine sans écraser les variables déjà présentes (même règle que D-33), lit `DATABASE_URL_TEST`, sonde la base avec Prisma, puis lance `prisma migrate deploy` dans un processus enfant dont `DATABASE_URL` vaut `DATABASE_URL_TEST`. `resetDb()` vide toutes les tables du schéma `public` sauf `_prisma_migrations` (`TRUNCATE ... CASCADE`). Le seed d'intégration exécute `prisma/seed.ts` deux fois avec cette même URL. En CI, le runner installe `postgresql-client` s'il n'a pas `psql`, puis `PGPASSWORD=xplor psql ... -c "CREATE DATABASE xplor_test;"` (l'erreur est ignorée si la base existe déjà). `SEED_DEFAULT_PASSWORD` dans le workflow est `xplor-seed-dev-2026`, la valeur de développement déjà publiée dans `.env.example` (D-41), pas un secret. Aucun paquet npm ajouté.
- **Alternatives :** ajouter `api-int` au workspace et l'exclure par un filtre CLI ; créer `xplor_test` avec un client Node plutôt que `psql` ; ne pas charger le `.env` racine dans `globalSetup`.
- **À valider :** oui (projet Vitest séparé ; chargement du `.env` ; `postgresql-client` en CI ; `|| true` sur `CREATE DATABASE`)

## D-51 — Tests HTTP du flux d'authentification (F-90)

- **Date :** 29/09/2026
- **Décision :** `apps/api/test/auth.int.test.ts` démarre le vrai `AppModule` sur Fastify (`NestFastifyApplication`), avec le préfixe `/api/v1`, `@fastify/cookie` et `app.inject`. `Test.createTestingModule` puis `overrideProvider(MAILER)` branche `FakeMailer` : `NestFactory.create` ne permet pas ce remplacement. `process.env.DATABASE_URL` est forcé sur `DATABASE_URL_TEST` le temps du fichier, car le schéma Prisma lit `DATABASE_URL`. Redis est le serveur de `REDIS_URL`. Entre les tests : `resetDb()` et suppression des clés `sess:*` ainsi que de l'index `user-sess:*`. `ThrottlerGuard` est remplacé par un guard qui laisse passer, dans ce module de test seulement : le verrouillage enchaîne plus de cinq `POST /auth/login`, et la limite de production reste 5/min (D-40). En CI, `loadEnv` ne reçoit que `DATABASE_URL_TEST`, `REDIS_URL` et `SEED_DEFAULT_PASSWORD` ; les clés S3, SMTP et `SESSION_SECRET` non exercées reprennent le processus ou les valeurs de développement de `.env.example`. `POST /auth/logout` répond **204** (corps vide), comme `password/reset` et `invite/accept`. D-40 indiquait 200. Le client du back-office accepte tout statut 2xx (`response.ok`). Le 10e mot de passe faux reste 401 et pose le verrou ; la tentative suivante est 423 (inchangé, D-40).
- **Alternatives :** garder le logout en 200 ; relever la limite du throttler au lieu de couper le guard ; envoyer les courriels à Mailpit ; vider toute la base Redis.
- **À valider :** oui (logout 204 ; throttler coupé seulement dans ce fichier ; `DATABASE_URL` réécrit)

| Paquet          | Raison                                                                                                    | Licence |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------- |
| @nestjs/testing | `Test.createTestingModule` et `overrideProvider` pour brancher `FakeMailer` sans SMTP. 11.2.6, NestJS 11. | MIT     |

## D-52 — Installation de Docker Desktop

- **Date :** 29/09/2026
- **Décision :** Le porteur autorise l'installation de Docker Desktop (backend WSL2) sur le poste de développement. Sans lui, la Definition of Done de M0 ne se vérifie pas (quatre commandes, connexion réelle, migrations sur PostgreSQL). La session du scénario de démo n'a pas lancé l'installeur. La session suivante a exécuté `wsl --status` puis `wsl --install` : le jeton n'est pas élevé (compte `desktop-aa5s62m\hp` membre de `BUILTIN\Administrateurs`, niveau obligatoire moyen) et DISM renvoie l'erreur 740. L'installation s'arrête là, sans invite UAC. Les points qui dépendent de Docker restent bloqués dans `docs/PROGRESS.md` tant que `docker compose ps` ne montre pas les quatre services `healthy`.
- **Complément (29/09/2026) :** la session de validation NF-09 (migrations, seed, `pnpm test:int`, santé, Mailpit) s'arrête au prérequis. Docker Desktop n'est toujours pas installé : la commande `docker` est absente, aucun binaire sous Program Files ni `%LOCALAPPDATA%\Docker`, `winget list` ne trouve pas le paquet, `wsl --status` renvoie le code 50. Aucune migration corrective n'est créée. D-34 et D-44 ne sont pas revalidés sur PostgreSQL.
- **Alternatives :** lancer l'installeur pendant la session de documentation ; installer PostgreSQL, Redis et MinIO hors Compose.
- **À valider :** non

## D-53 — Dépôt distant pour la CI

- **Date :** 29/09/2026
- **Décision :** L'URL indiquée par le porteur est `https://github.com/sayoung/DARDEV-.git`. Le workflow `.github/workflows/ci.yml` ne s'exécute qu'après un push sur `main` ou `develop`. Cette session n'ajoute pas de remote et ne pousse pas : l'orchestrateur réserve les commandes git qui modifient le dépôt. « CI verte » reste bloquée jusqu'à ce push.
- **Complément (29/09/2026) :** le porteur a confirmé le remote et le push. `gh auth status` : compte `sayoung`, actif, scopes `gist`, `read:org`, `repo`. `gh run list --repo sayoung/DARDEV- --branch develop --limit 5` ne renvoie qu'un run, `36555554248` (push, 29/09/2026 10:26 UTC), conclusion `failure`. URL : `https://github.com/sayoung/DARDEV-/actions/runs/36555554248`. Le dépôt distant existe. Cette session ne pousse toujours pas.
- **Alternatives :** créer le dépôt sous une organisation GitHub `DARDEV` plutôt que sous le compte `sayoung`.
- **À valider :** non

## D-54 — Playwright pour les tests de bout en bout (F-90, DoD M0)

- **Date :** 29/09/2026
- **Décision :** `@playwright/test` 1.63.0 est une devDependency racine. `playwright.config.ts` ne lance que Chromium (`browserName: 'chromium'`), lit les tests dans `e2e/`, écrit dans `test-results/`, et ouvre `http://localhost:5173`. `webServer` exécute `pnpm --filter @xplor/admin dev` et réutilise un serveur déjà à l'écoute hors CI (`reuseExistingServer: !process.env.CI`). Le script racine est `pnpm test:e2e` (`playwright test`). Vitest exclut `e2e/**` (config racine, workspace, et projet `@xplor/admin`). Le `tsconfig.json` racine inclut `playwright.config.ts` et `e2e/**/*.ts` pour le lint et le typecheck. Le premier test, `e2e/smoke.spec.ts`, vérifie que `/` affiche le titre « Xplor » et que `html` a `lang=fr`. Il ne couvre pas un scénario métier. Le binaire Chromium s'installe avec `pnpm exec playwright install chromium` ; ce n'est pas un paquet npm. Firefox et WebKit ne sont pas installés.
- **Alternatives :** Cypress ; les trois navigateurs de Playwright ; démarrer aussi l'API dans `webServer` pour le test de fumée.
- **À valider :** oui (Chromium seul ; le test de fumée ne démarre pas l'API)

| Paquet           | Raison                                                                                  | Licence    |
| ---------------- | --------------------------------------------------------------------------------------- | ---------- |
| @playwright/test | Tests E2E du back-office exigés par la Definition of Done de M0. 1.63.0, Chromium seul. | Apache-2.0 |

`@types/node` (D-33, MIT, `^22.19.1`) est redéclaré en devDependency racine : le `tsconfig.json` racine typecheck `playwright.config.ts`, qui lit `process.env.CI`. pnpm n'expose pas les types d'un autre paquet du workspace à la racine.

## D-55 — Spec Playwright du back-office et imports workspace (F-90)

- **Date :** 29/09/2026
- **Décision :** `e2e/back-office.spec.ts` importe `@xplor/shared` et `@xplor/i18n` par leur nom de paquet. Le `tsconfig.json` racine déclare `paths` vers `packages/shared/src/index.ts` et `packages/i18n/src/index.ts`, plus `resolveJsonModule` (les locales sont des JSON). Aucun paquet npm n'est ajouté : pnpm n'installe pas ces paquets à la racine, et Playwright résout les `paths` du `tsconfig.json` le plus proche. Les corps simulés qui ont un schéma partagé passent par `MeResponseSchema.parse`. Les requêtes de formulaire passent par `LoginRequestSchema` et `ForgotPasswordRequestSchema`. Les réponses 401 `INVALID_CREDENTIALS` et 423 `ACCOUNT_LOCKED` reprennent le corps Nest `{ statusCode, code, message }` : ces codes n'ont pas de schéma Zod dans `@xplor/shared` (ils sont locaux au registre OpenAPI). `GET /auth/me` anonyme, `POST /auth/logout` et `POST /auth/password/forgot` n'ont pas de corps JSON (401, 204, 202). La capture `docs/screenshots/login-ar.png` est produite par le scénario `?lang=ar` et citée dans `docs/DEMO_M0.md`.
- **Alternatives :** déclarer `@xplor/shared` et `@xplor/i18n` en devDependencies racine (`workspace:*`), ce qui modifierait `pnpm-lock.yaml` ; importer les sources par chemin relatif.
- **À valider :** oui (alias `paths` à la racine ; pas de schéma partagé pour les corps d'erreur)

## D-56 — Playwright dans la CI (NF-08)

- **Date :** 29/09/2026
- **Décision :** Après `pnpm test:int`, le job unique de `.github/workflows/ci.yml` installe Chromium avec `pnpm exec playwright install --with-deps chromium` (bibliothèques système du runner `ubuntu-latest` ; Firefox et WebKit restent absents, D-54), lance `pnpm test:e2e` avec `CI=true` (le serveur Vite n'est pas réutilisé, D-54), puis publie `test-results/` via `actions/upload-artifact@v4` (`name: playwright-results`, `if: always()`, `include-hidden-files: true`). Le jeton du workflow reste limité à `contents: read` : `actions/upload-artifact@v4` s'authentifie avec `ACTIONS_RUNTIME_TOKEN` et ne demande aucune permission du `GITHUB_TOKEN`. `include-hidden-files` est requis parce que `upload-artifact@v4` ignore les fichiers cachés et que Playwright écrit `test-results/.last-run.json` même quand tous les tests passent. Aucun paquet npm n'est ajouté. L'exécution distante attend le push (D-53).
- **Complément (29/09/2026) :** le push de `develop` a eu lieu. Le run `36555554248` s'arrête avant Playwright, à `pnpm test:int`. L'artefact `playwright-results` n'a pas été publié. La correction du graphe Nest est D-57.
- **Alternatives :** `playwright install chromium` sans `--with-deps` (les bibliothèques manquent sur une image Ubuntu nue) ; n'envoyer l'artefact qu'en cas d'échec ; omettre `include-hidden-files` (un run vert ne publie que `.last-run.json`, que l'action ignore).
- **À valider :** oui (`include-hidden-files` ; l'ordre des étapes, `--with-deps chromium`, `CI=true` et l'artefact `playwright-results` sont imposés par la consigne)

## D-57 — Injection Nest explicite sous Vitest (NF-08, CI)

- **Date :** 29/09/2026
- **Décision :** Le run `36555554248` échoue à l'étape « Tests d'intégration » (`pnpm test:int`). Journal : `Nest can't resolve dependencies of the AuthController (?, Symbol(ENV))`. L'argument d'index 0 est indéfini au runtime. Vitest 3 transforme le TypeScript avec esbuild, qui n'émet pas `design:paramtypes`. Les décorateurs `@Inject(...)` restent, eux, enregistrés dans `self:paramtypes`. `nest build` (tsc, `emitDecoratorMetadata`) n'est pas touché : le binaire de production résout encore les types. Les constructeurs du graphe `AppModule` qui injectaient une classe sans jeton déclarent maintenant `@Inject` : `AuthController` (`AuthService`), `UsersController` (`UsersService`), `HealthController` (`HealthService`), `PrismaUserRepository`, `PrismaUserLookup`, `PrismaUserTokenRepository`, `PrismaUnitOfWork` et `DbHealthProbe` (`PrismaService`). `apps/api/src/app.module.test.ts` compile `AppModule.forRoot` sous Vitest et résout ces trois contrôleurs, sans PostgreSQL. Aucun paquet npm. Le workflow `.github/workflows/ci.yml` n'est pas modifié. Le run corrigé n'a pas été relancé : pas de push.
- **Constat du run `36555554248` :** job unique `ci` (`109363717843`) en échec. lint vert, typecheck vert, test:int échec, e2e ignoré, test unitaire ignoré, audit ignoré. L'étape « Publier les résultats Playwright » se termine avec l'avertissement `No files were found with the provided path: test-results/. No artifacts will be uploaded.` L'artefact `playwright-results` est absent (liste d'artefacts vide).
- **Complément (29/09/2026) :** le commit `31d3f82` est sur `develop`. Le run `36564976333` passe « Tests d'intégration » (8 tests, dont `auth.int.test.ts`). L'échec restant de ce run est l'audit (D-60).
- **Alternatives :** ajouter `unplugin-swc` (ou `@swc/core`) avec `decoratorMetadata: true` pour que Vitest émette `design:paramtypes` ; lancer `test:int` sur le JavaScript produit par `nest build`.
- **À valider :** oui (`@Inject` explicite plutôt qu'un second compilateur)

## D-58 — Test de fumée sans proxy vers l'API (F-90)

- **Date :** 29/09/2026
- **Décision :** `e2e/smoke.spec.ts` enregistre `page.route` sur `GET /api/v1/auth/me` avant `page.goto`. La réponse est 401 avec le corps `{ code: 'UNAUTHENTICATED' }`. Le navigateur ne joint donc pas le proxy Vite (`/api` → `http://localhost:3000`), qui journalisait `ECONNREFUSED` tant que l'API n'était pas démarrée. Le titre attendu est `resources.fr.common.appName` (`@xplor/i18n`). Aucune aide partagée : `e2e/back-office.spec.ts` répond 401 sans corps sur cette route (D-55) et son `codedError` ne connaît que `INVALID_CREDENTIALS` et `ACCOUNT_LOCKED`. Aucun paquet npm.
- **Alternatives :** réutiliser le 401 sans corps du back-office ; extraire un helper commun ; démarrer l'API dans `webServer`.
- **À valider :** oui (corps `{ code: 'UNAUTHENTICATED' }` plutôt que le 401 vide de D-55)

## D-59 — Fumée de démarrage réel de l'API en CI (NF-08)

- **Date :** 29/09/2026
- **Décision :** Docker n'est pas joignable sur le poste (D-52), donc `GET /api/health` en 200 n'y est pas rejoué. Après `pnpm test:int`, `.github/workflows/ci.yml` ajoute l'étape « API smoke ». Elle lance `minio/minio server /data` (`docker run -d --name minio -p 9000:9000`, `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` = `S3_ACCESS_KEY` / `S3_SECRET_KEY` de `.env.example`), crée le bucket `xplor` avec l'image `minio/mc` (`--network container:minio`), puis `pnpm --filter @xplor/api db:deploy` et `db:seed` sur la base `xplor` du service `postgres:16` (pas `xplor_test`). L'API démarre en arrière-plan par `pnpm --filter @xplor/api exec tsx src/main.ts` (même `src/main.ts` que le dev ; tsx est déjà la devDependency du seed, D-41). `NODE_ENV=development` pour que `GET /api/v1/openapi.json` ne réponde pas 404 (D-49). Les variables SMTP de `.env.example` sont posées pour `loadEnv` ; Mailpit n'est pas démarré (la fumée n'envoie pas de courriel). `scripts/ci-api-smoke.mjs` (Node 22, sans paquet npm) interroge `API_BASE_URL` (`http://127.0.0.1:3000`) : il attend au plus 60 s un `GET /api/health` 200 avec `checks.db`, `checks.redis` et `checks.storage` à `ok`, puis exige `GET /api/v1/openapi.json` 200, `POST /api/v1/auth/login` (`admin@xplor.local`, `SEED_DEFAULT_PASSWORD`) 200 avec le cookie `xplor_sid`, et `GET /api/v1/auth/me` 200 avec ce cookie. Le premier écart écrit un message sur stderr et sort en code 1. OpenAPI, login et `me` ont chacun un délai de 20 s (argon2id au login, D-37) ; les 60 s ne bornent que l'attente de `GET /api/health`. Le mot de passe n'est jamais affiché (y compris le journal API, relu en masquant `SEED_DEFAULT_PASSWORD`). L'étape « Arrêter l'API » (`if: always()`) envoie SIGTERM au processus enregistré et à ses descendants. Aucun `secrets.*`. Aucun paquet npm.
- **Complément (29/09/2026) :** le run `36568794014` (commit `870ed19`) exécute cette étape et s'arrête au `docker run minio/minio` (code 125). La suite est D-61.
- **Alternatives :** `aws s3api create-bucket` ; `nest start` (compilation `tsc`) au lieu de tsx ; attendre les 60 s dans le shell avant le script ; laisser l'API jusqu'à la fin du job.
- **À valider :** oui (tsx plutôt que `nest start` ; bucket via `minio/mc` ; Mailpit absent de cette étape)

## D-60 — Correctif d'audit `deepmerge-ts` (NF-08, CI)

- **Date :** 29/09/2026
- **Décision :** Le run `36564976333` (commit `31d3f82`, https://github.com/sayoung/DARDEV-/actions/runs/36564976333) échoue à l'étape « Audit ». `pnpm audit --audit-level=high` signale GHSA-ggr8-5vv4-36mx : `deepmerge-ts` avant 8.0.0, chemin `apps/api` → `prisma@6.19.3` → `@prisma/config@6.19.3` → `deepmerge-ts@7.1.5`. `@prisma/config` épingle `7.1.5` en version exacte. Aucune publication Prisma 6, ni `7.9.1`, ne porte la 8. Le `package.json` racine force donc `deepmerge-ts` à `8.0.2` par `pnpm.overrides`. `@prisma/config` 6.19.3 ne fait que `const { deepmerge } = await import("deepmerge-ts")` et le passe comme `merger` à c12 ; cet export nommé existe encore en 8.0.2. `prisma generate` (postinstall) a réussi avec cet override. En local, `pnpm audit --audit-level=high` sort en code 0. Quatre avis moderate restent sous le seuil : Vitest / `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, D-29) et fastify 5.11.3 (GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, D-39). Le workflow n'est pas modifié. Pas de push lors de cette décision.
- **Complément (29/09/2026) :** le commit `870ed19` sur `develop` contient cet override et l'étape « API smoke ». Le run `36568794014` s'arrête avant l'audit (échec « API smoke », D-61).
- **Alternatives :** passer Prisma en 7 ou 8 (écarté par D-34) ; abaisser `--audit-level` ; ignorer l'avis ; attendre prisma/prisma#30052.
- **À valider :** oui (override plutôt que d'attendre la publication Prisma)

| Paquet ou ressource | Raison                                                                                                                                           | Licence      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| deepmerge-ts        | Forcé en 8.0.2 par `pnpm.overrides` pour fermer GHSA-ggr8-5vv4-36mx. Transitif de `@prisma/config`, pas une dépendance directe de l'application. | BSD-3-Clause |

## D-61 — Image MinIO construite depuis les releases GitHub (NF-08, CI)

- **Date :** 29/09/2026
- **Décision :** Le run `36568794014` (commit `870ed19`, https://github.com/sayoung/DARDEV-/actions/runs/36568794014, job `ci` `109407271203`) échoue à l'étape « API smoke » avant les quatre appels. Journal : `pull access denied for minio/minio, repository does not exist or may require 'docker login'`, code 125. Les dépôts Docker Hub `minio/minio` et `minio/mc` ont été retirés. Un jeton anonyme Quay pour `repository:minio/minio:pull` renvoie `actions: []` et marque le dépôt `$disabled` : `quay.io/minio/minio` (alternative de D-31) ne se tire plus sans authentification. `https://dl.min.io/...` répond 410. Les binaires historiques restent sur GitHub Releases. `docker/minio/Dockerfile` (base `debian:bookworm-slim`) installe le serveur `RELEASE.2025-09-07T16-13-09Z` (linux-amd64, SHA-256 `7c5bd8512c6e966455b1d198209358b2d191c77a83ab377c4073281065fb855f`) et le client `mc` `RELEASE.2025-08-13T08-35-41Z` (SHA-256 `01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891`). `sha256sum -c` fait échouer le build si l'empreinte diffère. L'image locale s'appelle `xplor-minio:2025-09-07` ; elle n'est pas publiée. `docker-compose.yml` la construit pour `minio` et pour `minio-init` (même tag). Le healthcheck passe de `mc ready local` (alias de l'ancienne image officielle) à `curl -fsS` sur `/minio/health/live`. L'étape « API smoke » fait `docker build -t xplor-minio:2025-09-07 docker/minio`, puis `docker run` de cette image (`server /data`) et `docker run --entrypoint mc … mb --ignore-existing local/xplor`. `scripts/ci-api-smoke.mjs` n'est pas modifié. Aucun paquet npm. Pas de push : ce correctif n'est pas dans le run `36568794014`. Lint vert, typecheck vert. Artefact `playwright-results` de ce run : absent (liste vide).
- **Alternatives :** `quay.io/minio/minio` (pull anonyme désactivé) ; image commerciale `quay.io/minio/aistor/minio` ; un autre serveur S3.
- **À valider :** oui (binaires AGPL figés, linux-amd64 seulement ; healthcheck `curl`)

| Paquet ou ressource                  | Raison                                                                          | Licence  |
| ------------------------------------ | ------------------------------------------------------------------------------- | -------- |
| minio `RELEASE.2025-09-07T16-13-09Z` | Binaire serveur, les images Docker Hub et le pull anonyme Quay ayant disparu.   | AGPL-3.0 |
| mc `RELEASE.2025-08-13T08-35-41Z`    | Client pour créer le bucket `xplor` dans Compose et dans l'étape « API smoke ». | AGPL-3.0 |
| `debian:bookworm-slim`               | Image de base déjà sur Docker Hub, pour embarquer ces deux binaires.            | DFSG     |

## D-62 — Preuve provisoire des critères 1, 2 et 7 par l'étape CI « API smoke » (NF-09)

- **Date :** 29/09/2026
- **Décision :** Tant que la virtualisation est désactivée sur le poste du porteur, le moteur Docker ne démarre pas (D-52 ; section Bloqué de `docs/PROGRESS.md`). L'étape CI « API smoke » (D-59, image `xplor-minio:2025-09-07` de D-61) sert alors de preuve provisoire des critères 1, 2 et 7 de la Definition of Done de M0. Sur le service `postgres:16` du job, base `xplor` vierge en début de job (distincte de `xplor_test`), elle applique les migrations par `pnpm --filter @xplor/api db:deploy`, lance `db:seed`, puis `scripts/ci-api-smoke.mjs` exige `GET /api/health` à 200 avec `checks.db`, `checks.redis` et `checks.storage` à `ok`, `GET /api/v1/openapi.json` à 200, une vraie connexion `POST /api/v1/auth/login` du compte `admin@xplor.local` (`SEED_DEFAULT_PASSWORD`), puis `GET /api/v1/auth/me` à 200 avec le cookie `xplor_sid`. La preuve locale (quatre commandes, services `healthy`, connexion dans le navigateur contre l'API) reste due dès que Docker répond. Aucun code modifié par cette décision.
- **Complément (29/09/2026) :** le run `36569962273` (commit `b100f8c`, https://github.com/sayoung/DARDEV-/actions/runs/36569962273, job `ci` `109411207526`) a l'étape « API smoke » verte. Journal : « API smoke : health, openapi, login et me sont conformes. » Artefact `playwright-results` présent.
- **Complément (29/09/2026) :** le run `36580207347` (commit `1eaf986`, https://github.com/sayoung/DARDEV-/actions/runs/36580207347, job `ci` `109446061994`) est vert, y compris « API smoke » (même journal). Artefact `playwright-results` `11039602501`. Les critères 1, 2, 7 et 10 de `docs/PROGRESS.md`, ainsi que la variante « démo sans Docker local » de `docs/DEMO_M0.md`, citent ce run comme preuve CI.
- **Complément (29/09/2026, NF-09) :** le moteur local répond. `docker version` affiche Server Docker Desktop 4.93.0 (moteur 29.8.1, linux/amd64) alors que `(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled` vaut False. VirtualMachinePlatform et Microsoft-Windows-Subsystem-Linux sont activées (InstallState 1). `wsl --status` : distribution par défaut `docker-desktop`, version 2. Preuve locale des critères 1, 7 et 10 : quatre services `healthy`, `minio-init` sorti en 0, `pnpm db:migrate` déjà synchronisé, `pnpm db:seed` deux fois. Le critère 2 (connexion dans le navigateur) reste dû. Aucun code modifié.
- **Complément (29/09/2026, F-90) :** le parcours HTTP local du critère 2 est fait. `scripts/ci-api-smoke.mjs` sort en 0 sur `http://localhost:3000` et sur le proxy `http://localhost:5173` (`GET /api/health` 200, OpenAPI 200, login 200 avec `xplor_sid`, `GET /api/v1/auth/me` 200). Le clic dans un navigateur graphique reste à faire. Le démarrage `nest start --watch` échouait ; le correctif est D-64.
- **Complément (29/09/2026, démo M0) :** preuve locale obtenue le 29/09/2026 (Node 22.23.3). Quatre commandes : `docker compose up -d` (postgres, redis, minio et mailpit `healthy`, `minio-init` code 0), `pnpm db:migrate` déjà synchronisé, `pnpm db:seed` deux fois ; `pnpm install` non rejoué (workspace déjà installé). `GET /api/health` 200, `GET /api/v1/openapi.json` 200, `POST /api/v1/auth/login` 200 et `GET /api/v1/auth/me` 200 (`scripts/ci-api-smoke.mjs` sur `http://localhost:3000` et sur `http://localhost:5173`). Courriel de réinitialisation dans Mailpit (`POST /api/v1/auth/password/forgot` 202, corps contenant `/reset/`). `pnpm test:int` : 9 verts. La CI (run `36580207347`) reste une preuve complémentaire. La question de validation est sans objet pour les critères 1, 7 et 10.
- **Alternatives :** attendre l'activation d'Intel VT-x ou d'AMD-V (SVM) dans le BIOS/UEFI ; jouer la démo sur un autre poste où Docker démarre.
- **À valider :** sans objet pour les critères 1, 7 et 10 (preuve locale du 29/09/2026 ; la CI reste une preuve complémentaire).

## D-63 — Réinvitation d'un compte jamais connecté (F-90)

- **Date :** 29/09/2026
- **Décision :** `POST /api/v1/admin/users/invitations` ne répond plus 409 lorsque l'adresse appartient à un utilisateur `active=false` dont `lastLoginAt` est null (invitation créée, jamais acceptée). Le service met à jour `name`, `role` et `uiLang`, invalide les jetons `INVITE` encore inutilisés, crée un nouveau jeton `INVITE` de 48 h, puis envoie le courriel après la transaction Prisma, et répond 201 avec `InviteUserResponseSchema` (même identifiant). Un compte actif, ou dont `lastLoginAt` est renseigné, répond toujours 409 `EMAIL_TAKEN`, sans courriel et sans nouveau jeton. La création ou la mise à jour, l'invalidation et l'insertion du jeton tiennent dans `UnitOfWork`. Le hachage du secret initial reste hors transaction, et seulement à la création : une réinvitation ne change pas `passwordHash`. Un échec SMTP laisse ainsi un compte réinvitable, au lieu d'un compte bloqué sur `EMAIL_TAKEN` (risque retiré de `docs/PROGRESS.md`). Le seuil de couverture visé pour `apps/api/src/users` était 70 % ; la mesure Vitest est 100 % (lignes, branches, fonctions, instructions). Aucun paquet ajouté.
- **Complément (29/09/2026) :** le scénario `auth.int.test.ts` « renouvelle une invitation jamais acceptée et n'accepte que le second lien » est vert sur le run `36580207347` (commit `1eaf986`, test:int 9 dont 7 dans `auth.int.test.ts`).
- **Alternatives :** supprimer le compte inactif puis le recréer (nouvel identifiant) ; répondre 409 et exposer une route de renvoi séparée ; inclure l'envoi SMTP dans la transaction (le courriel n'est pas une écriture Prisma).
- **À valider :** oui (réinvitation seulement si le compte n'a jamais été connecté ; courriel après le commit ; pas de nouveau secret à la réinvitation)

## D-64 — `pnpm dev` de l'API via tsx (F-90)

- **Date :** 29/09/2026
- **Décision :** `pnpm dev` lançait `@xplor/api` avec `nest start --watch`. Nest compile vers `dist` puis Node exécute ce JavaScript. `@xplor/shared` (et `@xplor/i18n`) exportent `src/index.ts`. Node 22 retire les types de ce fichier, mais ne réécrit pas le spécificateur `./auth.js` vers `auth.ts`. Le processus s'arrête : `ERR_MODULE_NOT_FOUND` sur `packages/shared/src/auth.js`. Le script `dev` devient `tsx watch src/main.ts`, le même point d'entrée que l'étape CI « API smoke » (D-59). tsx, déjà devDependency pour le seed (D-41), résout ces spécificateurs `.js`. Les `@Inject` explicites (D-57) permettent au graphe de démarrer sous esbuild, sans `design:paramtypes`. `nest build` et `emitDecoratorMetadata` restent le chemin de production (D-33). Aucun paquet npm ajouté.
- **Alternatives :** compiler `@xplor/shared` et pointer `exports` vers `dist` ; garder `nest start --watch` (Node ne réécrit pas les spécificateurs).
- **À valider :** oui (dev local aligné sur le démarrage CI par tsx)

## D-65 — Modèle `Asset` minimal en M1

- **Date :** 29/09/2026
- **Décision :** En M1, le modèle `Asset` est créé en version minimale (`kind`, `originalKey`, `mimeType`, `sizeBytes`, `width`, `height`, `contentHash`, `processingStatus` défaut `PENDING`, `derivatives` Json défaut `{}`, `copyright`), parce que `Tour.coverAssetId` et `Scene.panoramaAssetId` en dépendent. L'upload pré-signé et le traitement sont reportés à M2.
- **Alternatives :** reporter tout le modèle `Asset` à M2 et laisser `coverAssetId` et `panoramaAssetId` sans cible jusqu'à M2 ; livrer dès M1 l'upload pré-signé et le traitement.
- **À valider :** oui

## D-66 — `Hotel`, `Selection`, `SelectionItem`, `Kiosk` et `UserHotel` dans le schéma M1

- **Date :** 29/09/2026
- **Décision :** `Hotel`, `Selection`, `SelectionItem`, `Kiosk` et `UserHotel` entrent dans le schéma en M1 pour le seed (1 hôtel, 1 kiosque). Leur CRUD et leurs écrans restent en M5.
- **Complément (29/09/2026) :** migration `20260929183235_hotels_kiosks` et seed (1 hôtel à Rabat, sélection vide, kiosque « Hall principal », rattachement de `manager@xplor.local`). Choix d'`onDelete` : D-70. Le `Principal` de session ne charge pas encore `hotelIds`.
- **Alternatives :** n'ajouter ces modèles qu'en M5, avec le CRUD ; livrer aussi leurs écrans en M1.
- **À valider :** oui

## D-67 — Schémas Zod du contenu (F-01)

- **Date :** 29/09/2026
- **Décision :** Les schémas de contenu vivent dans `@xplor/shared` (`src/catalog.ts`), sans route ni écran. `localizedText({ max })` est la fabrique de `LocalizedText` : sans `max`, le comportement reste celui de `LocalizedTextSchema` (`fr` obligatoire et non vide, `ar` et `en` facultatifs, y compris la chaîne vide). Avec `max`, la limite s'applique à `fr`, `ar` et `en`. Le `summary` d'une visite utilise 500. Les identifiants sont des UUID v7 (`z.uuidv7()`). Create et Update ont les mêmes champs obligatoires (remplacement complet, pas un PATCH). `CityResponse` et `CategoryResponse` ajoutent `id`. `HotspotCreate` est le corps de création, sans `sceneId` (il viendra de la route) : union discriminée sur `type`, avec les champs exigés en 5.4. Le graphe (même visite, scène différente, visite cible publiée) reste au service de validation F-03. Icône par défaut : `SCENE_LINK` → `ARROW`, `TOUR_LINK` → `PORTAL`, `INFO` → `INFO`, `MEDIA` → `PHOTO`, `URL` → `INFO`. `yaw`, `initialYaw` et `arrivalYaw` sont dans [−π, π] ; `pitch` et `initialPitch` dans [−π/2, π/2]. `mediaAssetIds` contient au moins un UUID v7. `url` suit `z.httpUrl()` (protocole `http` ou `https`, nom de domaine). Un `z.url()` nu accepte `javascript:` et `data:` via `URL.canParse` : le viewer public en ferait un lien cliquable (XSS stocké). `durationMinutes` et `weight` sont des entiers, sans contrainte de signe. La couleur est `#` suivi de 6 chiffres hexadécimaux. `PaginationQuery` valide des nombres déjà typés (`page` ≥ 1, obligatoire, sans défaut ; `pageSize` de 1 à 100, défaut 20). La coercition depuis une query string reste hors de ce schéma : elle se fera à la frontière HTTP. `paginated(item)` décrit `{ items, page, pageSize, total }`. `Paginated<T>` est `z.infer` du retour de `paginated`, pour ne pas diverger du schéma. Aucun paquet npm ajouté. Le script `test` de `@xplor/shared` utilise Vitest et `@vitest/coverage-v8`, déjà inscrits (D-29, D-35).
- **Complément (29/09/2026, F-01, schéma Prisma) :** `City`, `Category`, `Asset` (minimal, D-65), `Tour`, `TourCategory`, `Scene` et `Hotspot` sont dans `schema.prisma`. Migration `content_model`, générée par `prisma migrate dev` ; les migrations `init_users` et `user_tokens` ne sont pas modifiées. `shareToken` est `String?` `@unique` `@db.VarChar(22)`, sans défaut en base : le service l'émettra plus tard (`nanoid`, 22 caractères). PostgreSQL autorise plusieurs NULL sous une contrainte d'unicité, donc plusieurs brouillons peuvent coexister sans jeton. `publicShare` défaut `false` (D-05), `contentVersion` défaut `1`, `status` défaut `DRAFT` (D-26). `deletedAt` seulement sur `Tour` et `Scene` (suppression logique) ; les autres modèles de ce lot se suppriment physiquement. `TourCategory` est un modèle explicite (UUID v7, `createdAt`, `updatedAt`, unicité `(tourId, categoryId)`), pas une relation n-n implicite. `mediaAssetIds` est un `String[]` sans clé étrangère. `Asset` reste le sous-ensemble D-65 : pas de `durationMs`, `captureDevice`, `capturedOn` ni `processingLog`.
- **onDelete :** `Hotspot.targetScene`, `Hotspot.targetTour` et `Hotspot.targetTourScene` sont `SetNull` (cible facultative : supprimer la scène ou la visite visée ne supprime pas le hotspot). `Hotspot.scene` est `Cascade` (le hotspot n'existe pas sans sa scène). `Tour.startScene` est `SetNull` (scène de départ facultative avant publication). `Scene.ambientAsset` est `SetNull`. `Scene.tour`, `Tour.city`, `Tour.coverAsset`, `Scene.panoramaAsset` et `createdBy` (Tour, Scene, Hotspot) sont `Restrict` : on ne détruit pas une visite qui a encore des scènes, ni une ville, un panorama, une vignette ou un auteur encore référencés ; la disparition d'une visite ou d'une scène passe par `deletedAt`. `TourCategory.tour` est `Cascade` (la jointure part avec la visite) ; `TourCategory.category` est `Restrict`. Index sur chaque clé étrangère. Aucun paquet npm ajouté.
- **Alternatives :** Update partiel ; `sceneId` dans le corps ; UUID de toute version ; icône sans défaut ; `page` coercé depuis une chaîne de query ; `durationMinutes` strictement positif ; `z.url()` sans restriction de protocole. Pour le schéma : `@default` SQL de `shareToken` (PostgreSQL 16 n'a pas `nanoid`) ; `Cascade` de `Scene` vers `Tour` (effacerait les scènes à la suppression physique, alors que le cahier prévoit `deletedAt`) ; jointure implicite Prisma sans horodatage.
- **À valider :** oui

## D-68 — Validation de publication en fonction pure (F-03)

- **Date :** 29/09/2026
- **Décision :** `validateTour` (`apps/api/src/catalog/tour-validation.ts`) est une fonction pure. Elle ne lit pas Prisma : l'appelant fournit l'instantané de la visite et `findTargetTour`. Le service Nest qui chargera les lignes viendra avec la route de publication. `ValidationIssueCode` et `ValidationIssue` vivent dans `@xplor/shared` (`catalog.ts`) : l'admin importera la liste `{ code, sceneId?, hotspotId?, message }` sans redéclarer le type. `message` est une phrase française fixe, attachée au code.
- **Graphe :** une scène `deleted` sort du graphe de publication. On ne vérifie pas son panorama, on n'exige pas qu'elle soit atteignable, et on ne suit pas ses hotspots. Un `SCENE_LINK` vers elle produit `SCENE_LINK_TARGET_DELETED`. `startSceneId` null, ou une scène de départ supprimée, produit `START_SCENE_MISSING` (avec `sceneId` seulement dans le second cas). Un identifiant de départ absent de l'instantané produit `START_SCENE_FOREIGN`. S'il n'y a pas de scène de départ vivante, les autres scènes ne sont pas déclarées `SCENE_UNREACHABLE`. L'atteignabilité est un parcours en largeur depuis la scène de départ, en suivant uniquement les `SCENE_LINK` valides, dans le sens du lien. Un second chemin ou un cycle est ignoré. `INFO`, `MEDIA` et `URL` ne créent pas d'arête.
- **Visite cible :** `findTargetTour` renvoie `undefined` si l'identifiant est inconnu. Inconnue, `deleted` ou d'un statut autre que `PUBLISHED` : `TOUR_LINK_TARGET_UNPUBLISHED`. `sceneIds` est la liste des scènes vivantes de la cible. `TOUR_LINK_SCENE_FOREIGN` est émis seulement quand l'instantané cible existe et que `targetTourSceneId` est renseigné hors de `sceneIds` (y compris si la cible n'est pas publiée : les deux codes sortent ensemble). Une cible inconnue n'a pas de liste de scènes : pas de `TOUR_LINK_SCENE_FOREIGN`. Un `TOUR_LINK` sans `targetTourId`, ou vers la visite courante, n'appelle pas `findTargetTour`.
- **Couverture :** `vitest.config.ts` inclut `apps/api/src/catalog/publication-rules.ts` et en exige 100 % (lignes, branches, fonctions, instructions), comme `access-policy.ts` (D-35). Aucun paquet npm ajouté.
- **Complément (29/09/2026, renommage) :** la livraison automatique écartait les fichiers déjà non suivis avant la tâche, donc `tour-validation.ts` et `tour-validation.test.ts` n'entraient jamais dans les commits. Le même contenu vit désormais dans `publication-rules.ts` et `publication-rules.test.ts`, créés pendant cette tâche (seul l'import du test change). `ValidationIssue` n'est plus un type écrit à la main : c'est `z.infer<typeof ValidationIssueSchema>`. Le schéma a `code` via `z.nativeEnum(ValidationIssueCode)`, `sceneId` et `hotspotId` en UUID facultatifs (`z.uuid()`), et `message` en chaîne. Il est exporté par `packages/shared/src/index.ts`.
- **Alternatives :** une classe Nest injectée dès maintenant (elle tirerait Prisma dans le test) ; un code distinct pour une visite cible inconnue ; exiger l'atteignabilité des scènes supprimées ; messages traduits dans `@xplor/i18n` (l'interface admin reste en français, F-04). Garder le nom `tour-validation` (les fichiers restaient hors des commits).
- **À valider :** oui

## D-69 — CRUD des villes et des catégories (API-25)

- **Date :** 29/09/2026 (API), 30/09/2026 (UI)
- **Décision :** `CatalogModule` expose GET, POST, PATCH et DELETE sur `/api/v1/admin/cities` et `/api/v1/admin/categories`. Les contrôleurs valident avec les schémas Zod déjà dans `@xplor/shared` (`safeParse`, 400 sans détail, comme l'auth). La lecture est ouverte à toute session. L'écriture passe par `canManageCatalog` (ADMIN et EDITOR), distincte de `canManageContent` qui vise les visites. Le PATCH remplace toute la ressource (D-67). La liste est un tableau JSON trié sur `name.fr`, sans pagination : API-25 ne la demande pas, contrairement à API-21. GET `/:id` fait partie du CRUD. Une ville est « utilisée » dès qu'une ligne `Tour` la référence, y compris si `deletedAt` est posé (`onDelete: Restrict`). Une catégorie l'est dès qu'une ligne `TourCategory` existe. Le DELETE répond alors 409 `{ error: { code: "IN_USE", message } }`, format du cahier section 7. Les erreurs d'auth du socle M0 restent `{ statusCode, code, message }` : les aligner n'est pas dans ce lot. Un identifiant qui n'est pas un UUID v7 répond 400 ; une ligne absente répond 404 Nest.
  - **UI :** Les écrans admin `CitiesPage` et `CategoriesPage` ont été implémentés dans `apps/admin`. Ils utilisent le composant contrôlé `LocalizedTextField` (D-79), effectuent la validation avec Zod dans le navigateur, et affichent des alertes traduites pour l'erreur 409 `IN_USE`. Les boutons d'édition/suppression ne sont rendus que pour les rôles ADMIN et EDITOR.
- **Seed :** upsert sur des UUID v7 fixes. Villes Rabat, Salé, Kénitra, Témara, région `Rabat-Salé-Kénitra`, centres WGS84 approximatifs (Rabat 34.02088, −6.84165 ; Salé 34.03723, −6.79846 ; Kénitra 34.26101, −6.5802 ; Témara 33.92866, −6.90656). Catégories : Monuments (`landmark`, `#1F6F8B`, comme l'exemple de manifeste), Médina, Plages, Gastronomie, Nature, Artisanat, `weight` de 1 à 6. Traductions arabes et anglaises proposées (Salé → Sale, Kénitra → Kenitra, Témara → Temara ; Médina → Medina ; Gastronomie → المطبخ / Gastronomy ; Artisanat → الصناعة التقليدية / Crafts).
- **Alternatives :** réutiliser `canManageContent` sans règle dédiée ; liste paginée via `PaginationQuery` ; 409 au format `{ statusCode, code, message }` du socle ; ignorer les visites à `deletedAt` ; slug unique à la place d'UUID fixes pour le seed.
- **À valider :** oui (villes/catégories non cloisonnées par hôtel, coordonnées, icônes, couleurs, traductions, poids). Le format 409 suit le cahier et la consigne du jalon.

## D-70 — `onDelete` des modèles hôteliers (5.6 à 5.8)

- **Date :** 29/09/2026
- **Décision :** Migration `20260929183235_hotels_kiosks`, générée par `prisma migrate dev` sous Node 22.23.3. Les migrations `init_users`, `user_tokens` et `content_model` ne sont pas modifiées. `Hotel` et `Kiosk` ont `deletedAt` (suppression logique, convention de la section 5). `Selection`, `SelectionItem` et `UserHotel` se suppriment physiquement. `UserHotel` n'a pas d'UUID propre : clé composite `(userId, hotelId)`, plus `createdAt` et `updatedAt`. `Selection.hotelId` est unique (une sélection par hôtel). `SelectionItem` a un UUID v7 et une unicité `(selectionId, tourId)`, comme `TourCategory` (D-67). `languages` défaut `['fr']`, `active` défaut `true`, `version` défaut `1`, `Kiosk.status` défaut `PENDING`, `idleTimeoutSeconds` défaut `90`. `maintenancePinHash`, `enrollmentCode` (`VarChar(8)`, unique) et `tokenHash` (unique) sont nullables : plusieurs NULL coexistent sous une contrainte d'unicité PostgreSQL. `deviceType` n'a pas de défaut en base.
- **onDelete :** `Hotel.city` est `Restrict` (même règle que `Tour.city`, D-67). `Hotel.logoAsset` est `SetNull` (logo facultatif : retirer le média n'efface pas l'hôtel). `Selection.hotel` est `Cascade` (la sélection n'existe pas sans son hôtel). `Selection.featuredTour` est `SetNull` (mise en avant facultative). `SelectionItem.selection` est `Cascade`. `SelectionItem.tour` est `Restrict` : une visite encore listée ne se détruit pas physiquement ; sa disparition passe par `deletedAt`. `Kiosk.hotel` est `Restrict` (le kiosque a son propre `deletedAt` ; on n'efface pas les appareils en cascade). `UserHotel.user` et `UserHotel.hotel` sont `Cascade` (la jointure n'a pas d'existence propre). L'unicité de `Selection.hotelId` et la clé composite de `UserHotel` indexent déjà `hotelId` et `userId` ; un index explicite couvre l'autre côté (`UserHotel.hotelId`) et chaque clé étrangère qui n'est pas en tête d'un index unique (`Hotel.cityId`, `Hotel.logoAssetId`, `Selection.featuredTourId`, `SelectionItem.selectionId`, `SelectionItem.tourId`, `Kiosk.hotelId`).
- **Seed :** upsert sur des UUID v7 fixes. Un hôtel « Hôtel Démonstration Rabat », 5 étoiles, location, langues `fr`, `ar`, `en`, couleur `#1F6F8B`, sans logo ni PIN, actif, rattaché à Rabat. Contrat du 2026-01-01 au 2027-01-01 (UTC). Adresse, téléphone et e-mail sont des coordonnées professionnelles fictives (`rabat.demo@xplor.local`, `+212537000000`). Sélection vide (`version` 1, pas de mise en avant, `attractTourIds` vide) ; une réexécution retire les lignes `SelectionItem` de cette sélection. Un kiosque « Hall principal », `TOUCH_AND_HEADSET`, `PENDING`. `manager@xplor.local` est rattaché par `UserHotel`. Aucun paquet npm ajouté.
- **Alternatives :** `Restrict` sur `Selection.hotel` (bloquerait toute suppression physique d'un hôtel qui a sa sélection) ; `Cascade` sur `Kiosk.hotel` (effacerait les appareils alors que le cahier prévoit `deletedAt`) ; `Cascade` sur `SelectionItem.tour` ; `UserHotel` avec un UUID en plus de la clé composite ; omettre `deletedAt` jusqu'au CRUD M5.
- **À valider :** oui (coordonnées fictives, couleur, dates de contrat, type d'appareil `TOUCH_AND_HEADSET`)

## D-71 — CRUD des visites (API-21, partie 1)

- **Date :** 29/09/2026
- **Décision :** `GET`, `POST`, `PATCH` et `DELETE` sur `/api/v1/admin/tours`. Lecture et écriture passent par `canManageContent` : ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403, y compris en lecture (à la différence d’API-25, où la lecture du catalogue est ouverte). Les routes publish, unpublish, validate, duplicate, share-token, qr.svg, graph et preview-token restent hors de ce lot.
- **Création :** le corps est `TourCreateSchema`. Le service impose `status = DRAFT` (D-26) et `publicShare = false` (D-05). `createdById` est l’utilisateur de la session. `contentVersion` reste au défaut Prisma, 1. `shareToken` est `crypto.randomBytes(16).toString('base64url')` : 22 caractères, sans nouveau paquet. D-67 prévoyait `nanoid` ; la consigne de ce lot l’écarte. Les `categoryIds` en double sont ignorés, l’ordre de première occurrence est conservé. Les jointures sont insérées dans la transaction de création.
- **Mise à jour :** `TourUpdateSchema` remplace les champs éditables. `categoryIds` efface puis recrée toutes les lignes `TourCategory` dans la même transaction. `status`, `publicShare`, `shareToken` et `createdById` ne changent pas. `contentVersion` est incrémenté de 1 (cahier, 5.2). Les scènes et les hotspots incrémenteront cette version avec API-22 et API-23.
- **Suppression :** `deletedAt` est posé, la réponse est 204. La ligne reste : une ville ou une catégorie encore référencée par une visite supprimée répond toujours 409 `IN_USE` (D-69).
- **Liste :** `deletedAt` vide. Filtres `status`, `cityId`, `categoryId` (au moins une jointure) et `q` (contient le titre `fr`, insensible à la casse ; une chaîne vide ou blanche ne filtre pas). Tri `createdAt` décroissant, puis `id`. `page` absent vaut 1 ; `pageSize` défaut 20 (`PaginationQuery`). Les query strings sont converties en nombres dans le contrôleur : le schéma partagé ne coince pas les chaînes (D-67).
- **Détail :** `categoryIds` dans l’ordre des UUID v7 de `TourCategory` (ordre d’insertion). `sceneCount` compte les scènes dont `deletedAt` est vide (même règle que le graphe de publication, D-68). `TourResponse` n’expose pas `deletedAt` ni les horodatages de création et de mise à jour, mais expose désormais `startSceneId` et `publishedAt` (nullable).
- **Erreurs :** ville, catégorie ou vignette inconnue → 422 `{ error: { code, message } }` avec `CITY_NOT_FOUND`, `CATEGORY_NOT_FOUND` ou `COVER_ASSET_NOT_FOUND`, dans cet ordre. Visite absente ou déjà supprimée → 404. Identifiant qui n’est pas un UUID v7 → 400. Une clé étrangère apparue entre la vérification et l’écriture relance la même vérification.
- **Alternatives :** `nanoid` (écarté par la consigne) ; lecture ouverte aux quatre rôles comme API-25 ; `contentVersion` figé jusqu’à la publication ; compter aussi les scènes supprimées ; tri sur le titre français ; laisser un `categoryId` répété échouer sur la contrainte d’unicité.
- **À valider :** oui (jeton base64url plutôt que nanoid ; incrément de `contentVersion` dès le PATCH ; `q` vide ignoré ; scènes supprimées exclues du compteur)

## D-72 — CRUD des scènes (API-22, partie 1)

- **Date :** 29/09/2026
- **Décision :** `ScenesController` dans `CatalogModule` expose `GET` et `POST` `/api/v1/admin/tours/:tourId/scenes`, puis `GET`, `PATCH` et `DELETE` `/api/v1/admin/scenes/:id`. `SessionGuard`, `CsrfGuard` et `canManageContent` : ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403, y compris en lecture. `reorder` et `set-start` sont décrits ci-dessous.
- **Création :** le corps est `SceneCreateSchema` (vue initiale par défaut déjà dans le schéma). `createdById` est l’utilisateur de la session. Si `startSceneId` de la visite est null, la scène créée le devient, dans la même transaction. Une scène suivante ne le change pas. `contentVersion` de la visite est incrémenté de 1 dans cette transaction (cahier 5.2, prévu par D-71).
- **Liste :** `deletedAt` vide, tri `weight` croissant puis `createdAt` croissant. Tableau JSON, sans pagination. Visite absente ou supprimée : 404.
- **Mise à jour :** `SceneUpdateSchema` remplace les champs éditables. `tourId` et `createdById` ne changent pas. Une légende absente du corps est effacée. `contentVersion` +1. `startSceneId` ne change pas.
- **Suppression :** `deletedAt` est posé, la réponse est 204. Si la scène est la scène de départ, `startSceneId` revient à null dans la même transaction. Aucune autre scène n’est promue. `contentVersion` +1.
- **Réponse :** `SceneResponseSchema` : `id`, `tourId`, `title`, `caption` facultative, `panoramaAssetId`, `initialYaw`, `initialPitch`, `initialZoom`, `weight`, `hotspotCount`, `createdAt` et `updatedAt` en ISO 8601. `hotspotCount` compte les hotspots de la scène (suppression physique, cahier 5.4). Narration, ambiance et plan restent hors du schéma.
- **Erreurs :** `{ error: { code, message } }`, format du cahier section 7. Visite inconnue ou supprimée : 404 `TOUR_NOT_FOUND`. Scène inconnue, supprimée, ou rattachée à une visite supprimée : 404 `SCENE_NOT_FOUND`. `panoramaAssetId` absent : 422 `PANORAMA_ASSET_NOT_FOUND`. L’existence de la ligne `Asset` suffit : le `kind` n’est pas contrôlé (même choix que la vignette, D-71). Un identifiant qui n’est pas un UUID v7 répond 400 Nest. Une clé étrangère apparue entre la vérification et l’écriture relance la même vérification.
- **Réordonnancement :** `POST /api/v1/admin/tours/:tourId/scenes/reorder`, corps `SceneReorderRequestSchema` (`sceneIds`, UUID v7, doublons acceptés par le schéma). Le service exige exactement les scènes dont `deletedAt` est vide, sans doublon. Sinon 422 `SCENE_SET_MISMATCH`, sans écriture. En cas de succès, `weight` devient l’index dans la liste (à partir de 0), dans une transaction, et `contentVersion` de la visite augmente de 1 (cahier 5.2). Les scènes supprimées restent hors de l’ensemble et gardent leur poids. Réponse 200 : les scènes non supprimées, tri `weight` puis `createdAt`, comme la liste.
- **Scène de départ :** `POST /api/v1/admin/tours/:tourId/scenes/set-start`, corps `SetStartSceneRequestSchema` (`sceneId`). Une scène inconnue, supprimée ou d’une autre visite répond 422 `START_SCENE_FOREIGN` (même code que `ValidationIssueCode.START_SCENE_FOREIGN`), sans écriture. La visite absente ou supprimée reste 404 `TOUR_NOT_FOUND`. En cas de succès, `startSceneId` est posé et `contentVersion` augmente de 1 dans la même transaction. Réponse 200 : `TourResponse`. Ce schéma n’expose pas `startSceneId` (D-71) ; la valeur se lit en base.
- **Alternatives :** 404 au format Nest `{ statusCode, message, error }` comme API-21 ; promouvoir la scène de poids suivant comme départ ; refuser un asset dont le `kind` n’est pas `PANORAMA` ; trier `createdAt` en décroissant ; laisser `contentVersion` inchangé jusqu’à API-23 ; refuser les doublons dans `SceneReorderRequestSchema` ; répondre 404 plutôt que 422 pour une scène inconnue au `set-start` ; inclure `startSceneId` dans `TourResponse`.
- **À valider :** oui (codes 404, tri croissant, incrément de `contentVersion`, asset accepté quel que soit son `kind` ; poids = index à partir de 0 ; 422 `SCENE_SET_MISMATCH` ; 422 `START_SCENE_FOREIGN` pour une scène inconnue, supprimée ou d’une autre visite ; `TourResponse` sans `startSceneId`)

## D-73 — Hotspots (API-23, partie 1, contrats)

- **Date :** 29/09/2026
- **Décision :** Les contrats de hotspot restent dans `@xplor/shared` (`catalog.ts`). Ce lot n’ajoute aucune route, aucun service, aucun écran. `HotspotUpdateSchema` est la même union discriminée sur `type` que `HotspotCreateSchema` : chaque variante exige ses champs requis (cahier 5.4), `arrivalYaw` et `targetTourSceneId` restent facultatifs, l’icône garde le défaut du type (D-67). Le `type` fait partie du corps : un remplacement peut passer de `SCENE_LINK` à `INFO`, ou l’inverse. `url` reste `z.httpUrl()` (`http` ou `https` seulement). `HotspotResponseSchema` est un objet plat : `id` et `sceneId` en UUID v7, `type`, `yaw`, `pitch`, `label` (`LocalizedText`), `icon`, `createdAt` et `updatedAt` en ISO 8601. `targetSceneId`, `targetTourId`, `targetTourSceneId`, `body`, `url` et `arrivalYaw` sont nullables (la clé est présente, la valeur peut être `null`). `url` non nulle reste `http` ou `https`. `mediaAssetIds` est un `string[]`, éventuellement vide : la création continue d’exiger au moins un UUID v7, la réponse reflète le `String[]` Prisma sans reclouer l’identifiant. `HotspotUpdate` et `HotspotResponse` sont `z.infer`, exportés par `index.ts`. Aucun paquet npm ajouté.
- **Alternatives :** un PATCH partiel qui omettrait `type` ; une réponse elle-même en union discriminée (les champs absents omis plutôt que `null`) ; exiger un UUID v7 dans `mediaAssetIds` de la réponse ; rendre `arrivalYaw` obligatoire au remplacement.
- **À valider :** oui (réponse plate à champs nullables ; `mediaAssetIds` en chaînes, pas en UUID v7 ; remplacement complet avec changement de type)
- **Complément (29/09/2026) — partie 2, liste et création :** `HotspotsController` dans `CatalogModule` expose `GET` et `POST` `/api/v1/admin/scenes/:sceneId/hotspots`. `SessionGuard`, `CsrfGuard` et `canManageContent` : ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403, y compris en lecture. PATCH, DELETE et les écrans restent hors de ce lot. Aucun paquet npm ajouté.
- **Création :** le corps est `HotspotCreateSchema`. `createdById` est l’utilisateur de la session. Réponse 201 `HotspotResponseSchema`. Les champs des autres variantes sont écrits à null, et `mediaAssetIds` à `[]` hors d’un hotspot `MEDIA`. `contentVersion` de la visite qui porte la scène augmente de 1 dans la même transaction.
- **Liste :** tableau JSON, sans pagination, tri `createdAt` croissant. Scène parente absente, supprimée, ou rattachée à une visite supprimée : 404 `SCENE_NOT_FOUND`.
- **Contrôles :** méthode privée `assertTargets`. Le PATCH pourra l’appeler : `HotspotUpdate` est la même union que `HotspotCreate`. Format 422 `{ error: { code, message } }`. `SCENE_LINK` vers une scène absente ou supprimée, y compris si elle appartient à une autre visite : `SCENE_LINK_TARGET_MISSING`. Le code de publication `SCENE_LINK_TARGET_DELETED` n’est pas utilisé ici. Vers la scène elle-même : `SCENE_LINK_SELF`. Vers une scène vivante d’une autre visite : `SCENE_LINK_FOREIGN`. `TOUR_LINK` vers une visite absente ou supprimée : `TOUR_LINK_TARGET_MISSING`. Vers la visite courante : `TOUR_LINK_SELF`. Si `targetTourSceneId` est présent et que la scène est inconnue, supprimée ou hors de la visite cible : `TOUR_LINK_SCENE_FOREIGN`. Une visite cible en `DRAFT` est acceptée ; `TOUR_LINK_TARGET_UNPUBLISHED` reste un contrôle de publication (F-03). Un identifiant de `mediaAssetIds` inconnu : `MEDIA_ASSET_NOT_FOUND`. Le `kind` du média n’est pas contrôlé (même choix que le panorama, D-72). Un refus n’écrit rien et n’incrémente pas `contentVersion`. Une clé étrangère entre la vérification et l’écriture relance les mêmes contrôles.
- **Alternatives (partie 2) :** trier `createdAt` en décroissant ; répondre `SCENE_LINK_TARGET_DELETED` pour une scène supprimée ; refuser une visite cible en brouillon dès la création ; exiger un `kind` `IMAGE`, `AUDIO` ou `VIDEO`.
- **À valider (partie 2) :** oui (tri croissant ; scène supprimée en `SCENE_LINK_TARGET_MISSING` ; brouillon accepté ; `kind` non contrôlé ; `assertTargets` partagée avec le PATCH)
- **Complément (29/09/2026) — partie 3, modification et suppression :** `PATCH` et `DELETE` `/api/v1/admin/hotspots/:id`. Même garde que la liste : `SessionGuard`, `CsrfGuard`, `canManageContent` (ADMIN et EDITOR). Le corps du PATCH est `HotspotUpdateSchema`, remplacement complet. `assertTargets` est la méthode commune avec la création : mêmes codes 422, sans écriture et sans incrément de `contentVersion` si le contrôle échoue. Quand le type change, les champs propres aux autres types sont remis à `null`, et `mediaAssetIds` à `[]`, dans la même écriture (`variantFields`). `sceneId` et `createdById` ne changent pas. `contentVersion` de la visite qui porte la scène augmente de 1 dans la même transaction, à la modification comme à la suppression. La suppression est physique (`delete`, 204, corps vide). Hotspot inconnu, scène parente absente ou supprimée, ou visite parente supprimée : 404 `HOTSPOT_NOT_FOUND` (`Ce hotspot est inconnu.`). Une clé étrangère entre le contrôle et l’écriture relance les mêmes contrôles. Les écrans admin restent hors de ce lot. Aucun paquet npm ajouté.
- **Alternatives (partie 3) :** suppression logique ; 404 `SCENE_NOT_FOUND` quand la scène parente est supprimée ; conserver les champs de l’ancien type ; PATCH partiel qui omettrait `type`.
- **À valider (partie 3) :** oui (suppression physique ; 404 `HOTSPOT_NOT_FOUND` si le hotspot est inconnu ou si la scène ou la visite parente est supprimée ; champs des autres types remis à null ou `[]` dans la même écriture ; `contentVersion` +1)

## D-74 — Validation et publication des visites (F-03)

- **Date :** 29/09/2026
- **Décision :** `POST /api/v1/admin/tours/:id/validate` répond toujours 200 `{ issues: ValidationIssue[] }`. La liste est vide quand la visite est publiable. Cette route ne publie pas et ne change pas `contentVersion`. Le 422 de publication reste pour la route `publish`, hors de ce lot. `TourPublicationService` charge l’instantané avec Prisma et appelle `validateTour` (`publication-rules.ts`) sans la modifier. `TourValidationResponseSchema` vit dans `@xplor/shared` (`catalog.ts`) : `{ issues }` est un tableau de `ValidationIssueSchema`.
- **Instantané :** la visite absente ou déjà supprimée (`deletedAt` posé) répond 404 `{ error: { code: "TOUR_NOT_FOUND", message } }`, même format que API-22. Les scènes supprimées restent dans l’instantané (`deleted: true`) : un `SCENE_LINK` vers elles produit `SCENE_LINK_TARGET_DELETED` (D-68). `panoramaStatus` est le `processingStatus` de l’asset panorama. Les scènes sont lues par `weight` croissant, puis `createdAt`. Les hotspots le sont par `createdAt` croissant : l’ordre des problèmes est stable.
- **Visites cibles :** les `targetTourId` des hotspots `TOUR_LINK`, autres que la visite courante, sont chargés en une requête, y compris si la cible est supprimée. Un identifiant inconnu n’est pas dans la map : `findTargetTour` renvoie `undefined`. `sceneIds` ne contient que les scènes vivantes de la cible. `status` et `deleted` viennent de la ligne `Tour`.
- **Garde :** `SessionGuard`, `CsrfGuard`, `canManageContent`. ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403. Un identifiant qui n’est pas un UUID v7 répond 400. Aucun paquet npm ajouté. Pas d’écran admin.
- **Alternatives :** répondre 422 dès que `issues` n’est pas vide (réservé à `publish`) ; 404 au format Nest `{ statusCode, message, error }` comme le CRUD des visites (D-71) ; omettre les scènes supprimées de l’instantané ; ne pas charger une visite cible déjà supprimée (`undefined` et `deleted: true` produisent le même `TOUR_LINK_TARGET_UNPUBLISHED`, mais seule la ligne chargée permet aussi `TOUR_LINK_SCENE_FOREIGN`).
- **À valider :** oui (200 même quand la liste n’est pas vide ; 404 `TOUR_NOT_FOUND` ; scènes supprimées conservées ; visites cibles supprimées chargées ; `sceneIds` limité aux scènes vivantes)
- **Complément (30/09/2026) — partie 2, publication et dépublication :** `POST /api/v1/admin/tours/:id/publish` et `POST /api/v1/admin/tours/:id/unpublish`. Même garde que `validate` : `SessionGuard`, `CsrfGuard`, `canManageContent` (ADMIN et EDITOR). PARTNER et HOTEL_MANAGER reçoivent 403. Visite absente ou supprimée : 404 `TOUR_NOT_FOUND`. Aucun paquet npm ajouté. Pas d’écran admin.
- **Publication :** la validation (`validateTour`, instantané inchangé) et l’écriture tiennent dans la même transaction. Si `issues` n’est pas vide, 422 `{ error: { code: "TOUR_NOT_PUBLISHABLE", message, issues: ValidationIssue[] } }` et la transaction n’écrit rien (`status`, `publishedAt` et `contentVersion` restent). Sinon : `status` = `PUBLISHED`, `publishedAt` = maintenant, `contentVersion` +1. Réponse 200 : `TourResponse`, le même corps que `GET /admin/tours/:id`, lu après la transaction. `status` est déjà sur `TourResponseSchema` (D-71) ; `publishedAt` reste hors de ce schéma.
- **Dépublication :** `status` = `DRAFT`, `publishedAt` conservé, `contentVersion` +1, dans une transaction. Réponse 200 : `TourResponse`. Pas de contrôle des règles de publication.
- **Alternatives (partie 2) :** refuser la publication hors transaction, après la lecture ; répondre 409 si la visite est déjà publiée ; effacer `publishedAt` à la dépublication ; inclure `publishedAt` dans `TourResponse`.
- **À valider (partie 2) :** oui (422 avec `issues` et sans écriture ; `publishedAt` posé à chaque publication réussie ; dépublication qui conserve `publishedAt` et incrémente `contentVersion` ; `TourResponse` déjà porteur de `status`)

## D-75 — Duplication des visites (F-01)

- **Date :** 30/09/2026
- **Décision :** `POST /api/v1/admin/tours/:id/duplicate` répond 201 `TourResponse`. La copie tient dans une seule transaction Prisma. La visite source n’est pas modifiée. Aucun paquet npm ajouté. Pas d’écran admin.
- **Visite copiée :** `status` = `DRAFT` (même si la source est publiée), `publicShare` = false (D-05), `publishedAt` null, `contentVersion` = 1, `createdById` = l’utilisateur de la session. `shareToken` est un nouveau jeton, `crypto.randomBytes(16).toString('base64url')`, 22 caractères, comme à la création (D-71). Ville, vignette, résumé, description, durée, coordonnées et infos pratiques sont recopiés. Les mêmes catégories sont rattachées, dans l’ordre des jointures source.
- **Titre :** seul `title.fr` reçoit le suffixe ` (copie)` (espace comprise, pour ne pas coller au texte). `ar` et `en` restent ceux de la source. `duplicateFrenchTitle` dans `tour-duplicate.ts`.
- **Scènes :** seules les scènes dont `deletedAt` est vide sont copiées, avec le même `weight` et les autres champs (panorama, angles, narration, ambiance, plan). Leurs hotspots sont copiés. `createdById` des scènes et des hotspots copiés est la session, comme pour la visite.
- **Remappage :** `remapDuplicateLinks` est une fonction pure. `startSceneId` et les `targetSceneId` des `SCENE_LINK` pointent vers les nouvelles scènes. Une cible absente de la carte (scène supprimée, donc non copiée) devient `null` : aucun hotspot copié ne pointe vers une scène de la source. Les `TOUR_LINK` conservent `targetTourId` et `targetTourSceneId`. Un `TOUR_LINK` vers la visite source n’est pas réécrit : la création l’interdit déjà (`TOUR_LINK_SELF`).
- **Garde :** `SessionGuard`, `CsrfGuard`, `canManageContent`. ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403. Visite absente ou supprimée : 404 `{ error: { code: "TOUR_NOT_FOUND", message } }`. Un identifiant qui n’est pas un UUID v7 répond 400.
- **Alternatives :** suffixe `(copie)` sans espace ; conserver le `createdById` d’origine sur les scènes et les hotspots ; laisser un `SCENE_LINK` pointer vers une scène source supprimée ; copier aussi les scènes supprimées ; incrémenter `contentVersion` de la source.
- **À valider :** oui (suffixe ` (copie)` avec espace, seulement sur le français ; `createdById` de la copie = session, y compris scènes et hotspots ; cible de `SCENE_LINK` non copiée remise à `null` ; `TOUR_LINK` inchangé ; `publicShare` forcé à false et statut `DRAFT`)

## D-76 — Liste des médias en lecture seule (F-05)

- **Date :** 30/09/2026
- **Décision :** `GET /api/v1/admin/assets` et `GET /api/v1/admin/assets/:id` exposent la médiathèque en lecture seule, pour que les formulaires admin puissent choisir un panorama, une vignette ou un média de hotspot. Pas d’upload, pas de `complete`, pas de `reprocess`, pas de suppression : cela reste API-24 en M2 (D-65). Aucun paquet npm ajouté. Pas d’écran admin.
- **Contrat :** `AssetResponseSchema` dans `@xplor/shared` : `id`, `kind`, `mimeType`, `sizeBytes`, `width`, `height`, `processingStatus`, `copyright`, `createdAt`. `width`, `height` et `copyright` sont `null` quand ils sont absents. `originalKey`, `contentHash`, `derivatives` et `updatedAt` ne sortent pas. `AssetListQuerySchema` étend `PaginationQuery` : `page` défaut 1, `pageSize` défaut 20 (1…100), `kind` facultatif (`AssetKind`). Tri `createdAt` décroissant, puis `id` croissant pour stabiliser la page. `PaginatedAssetResponseSchema` via `paginated`.
- **Garde :** `SessionGuard`, `CsrfGuard`, `canManageContent`. ADMIN et EDITOR seulement. PARTNER et HOTEL_MANAGER reçoivent 403, y compris en lecture. GET est une méthode sûre : le jeton CSRF n’est pas exigé. Média inconnu : 404 `{ error: { code: "ASSET_NOT_FOUND", message } }`. Un identifiant qui n’est pas un UUID v7, ou un `kind` inconnu, répond 400.
- **Alternatives :** ouvrir la lecture à toute session comme API-25 ; paginer sans `kind` ; inclure `originalKey` dans la réponse ; trier seulement sur `createdAt` sans second critère ; livrer l’upload dans ce lot.
- **À valider :** oui (lecture réservée à ADMIN et EDITOR ; champs de réponse limités à la liste F-05 ; second tri `id` croissant ; upload, retraitement et suppression reportés à M2)

## D-77 — Fichiers des médias de démonstration (M1 NF-09)

- **Date :** 30/09/2026
- **Décision :** le seed (NF-09) crée les lignes en base pour les 11 médias (3 vignettes IMAGE, 8 panoramas PANORAMA) associés aux visites de Kasbah des Oudayas, Jardin de Salé et Plage de Mehdia. Ces médias sont créés en `READY` avec un `contentHash` précalculé et une clé `originalKey` préfixée `seed/`. Aucun fichier physique n'est poussé sur MinIO durant M1 : les panoramas libres de droits présents dans `apps/api/prisma/seed-assets/` seront chargés sur MinIO via le pipeline métier de M2 (exigence API-24).
- **Alternatives :** Uploader directement les fichiers via le script de seed.
- **À valider :** oui (le report à M2 touche un critère de la DoD de M1 et le porteur doit l'accepter).

## Encore à valider (cahier des charges, section 11.2)

Pas de numéro de décision tant que le porteur n'a pas tranché :

1. Matériel des kiosques : mini-PC + écran tactile 32" et/ou casque autonome (Meta Quest 3 / Pico 4).
2. Hébergement : VPS au Maroc ou cloud international ; stockage S3 (MinIO auto-hébergé ou service géré). Impact loi 09-08 et coût.
3. Nombre de visites prévues au lancement et liste des sites de la région Rabat-Salé-Kénitra.
4. Nom de domaine et charte graphique Xplor.

## D-78 — Client API : requestJson et modules (M1 F-01)

- **Date :** 30/09/2026
- **Décision :** La fonction `requestJson<T>` (dans `apps/admin/src/api/client.ts`) centralise les appels au back-end : sérialisation JSON automatique via `Content-Type: application/json` pour `init.body`, gestion centralisée des erreurs `ApiError` (incluant `issues` pour les rejets de type 422), et validation Zod de la réponse. La fonction utilise des surcharges TypeScript (`schema: ZodType<T>` ou `null`) pour retourner avec précision `Promise<T>` ou `Promise<void>` (en cas de 204), respectant l'import direct des types Zod sans dépendance additionnelle dans le front (`ZodType` et `z` étant exportés par `@xplor/shared`). La propagation de `X-CSRF-Token` pour les méthodes avec effet de bord est déléguée à l'existant `apiFetch`. Le fichier `catalog.ts` définit le CRUD de l'API (cities, categories, tours) avec un typage strict (`CityCreate`, `TourUpdate`, etc.) pour les paramètres d'entrée et de sortie afin d'éviter tout recours à `unknown`. `listCities` et `listCategories` ne sont pas paginées (D-69) et utilisent les schémas listes de `@xplor/shared`.
- **Alternatives :** fetch brut à chaque appel (sans parse).
- **À valider :** non

## D-79 — Composant LocalizedTextField (F-04)

- **Date :** 30/09/2026
- **Décision :** Composant contrôlé `LocalizedTextField` dans `apps/admin/src/catalog/` pour un `LocalizedText` (fr/ar/en). Un seul champ visible. Les onglets (`role="tab"`, `aria-selected`, flèches gauche et droite) sont dans un `role="tablist"` nommé par le libellé du champ (`aria-labelledby`). Chaque onglet a `aria-controls` vers un `role="tabpanel"` dont `aria-labelledby` désigne l’onglet actif. Identifiants via `useId()`, focus clavier via `useRef`. L’onglet arabe : `dir="rtl"` et `lang="ar"` ; les autres : `dir="ltr"`. Un onglet vide affiche « Traduction manquante » en texte visible, sans `aria-label` sur l’indicateur. Si `required`, l’exigence reste sur le français quel que soit l’onglet actif : l’onglet fr porte `aria-required` et le libellé « obligatoire », un message signale `value.fr` vide, et l’envoi du formulaire est bloqué (écoute `submit` en capture et champ de contrainte dédié au français — pas d’attribut `required` lié à l’onglet actif). `onChange` ne modifie que la langue active. Classes préfixées `.ltf-`, propriétés CSS logiques. Clés i18n : `catalog.translation.missing`, `catalog.translation.required`, `catalog.translation.frRequired`, `catalog.translation.tab.*`. Tests Vitest (jsdom) avec le vrai i18n (`i18n.changeLanguage('fr')`).
- **Alternatives :** Trois champs visibles en même temps ; lier l’attribut HTML `required` à `activeTab === 'fr'` (l’envoi passait alors que le français était vide sur un autre onglet).
- **À valider :** non

## D-80 — Client des médias et sélecteur AssetPicker (F-05)

- **Date :** 30/09/2026
- **Décision :** `apps/admin/src/api/catalog.ts` expose `listAssets` et `getAsset`. Le composant `AssetPicker` (React contrôlé, `apps/admin/src/catalog/`) permet de sélectionner un média selon son `AssetKind`. Il affiche une liste déroulante `<select>` liée avec `<label>` via un ID unique. Les options présentent les 8 derniers caractères de l'ID, le type MIME, les dimensions (si connues) et le statut de traitement traduit. Les états (chargement, liste vide, erreur réseau) sont traduits avec les clés `catalog.asset.*`. Si l'appel API échoue, le composant cache le sélecteur et affiche l'erreur. L'upload reste prévu pour M2. Le composant est couvert par Vitest sous jsdom.
- **Alternatives :** utiliser un paquet comme react-select ; inclure la logique d'upload immédiatement.
- **À valider :** oui

## D-81 — Formulaires de visite et intégration front (M1 F-01)

- **Date :** 30/09/2026
- **Décision :** Implémentation du frontend pour la création et modification des visites (M1 F-01). `TourForm.tsx` coordonne la saisie : titre, résumé, description, infos pratiques (via `LocalizedTextField`), ville, catégories, et durée/coordonnées (champs optionnels). L'Asset de couverture utilise `AssetPicker`. L'affichage du formulaire est restreint aux rôles ADMIN et EDITOR via l'objet `Role` partagé. La validation Zod est effectuée côté client avant l'envoi, avec une gestion gracieuse des erreurs. Les IDs des mocks de test utilisent désormais de véritables UUIDs pour passer la validation stricte de Zod sur le schéma `idSchema`.
- **Complément (30/09/2026) :** une erreur au chargement de la visite (autre qu’un 404) remplace le formulaire. Une erreur d’enregistrement (422 ou autre) ou de suppression enregistre la clé `common.error.generic` et la traduit au rendu, sans démonter le formulaire. L’échec de `listCities` ou `listCategories` affiche `catalog.errors.fetchFailed`. Le 404 propose un lien `hrefFor('/tours')`, pas un bouton.
- **Alternatives :** Création et modification dans des modals (rejeté pour des URL distinctes `/tours/new` et `/tours/:id`). Un seul état `globalError` pour le chargement et l’action (rejeté : il démontait le formulaire et perdait la saisie).
- **À valider :** non


## D-82 — Exception temporaire à D-03 (Focus français)

- **Date :** 30/09/2026
- **Décision :** Jusqu'au M8, on se concentre sur le français. L'infrastructure multilingue est conservée (toutes les chaînes via `packages/i18n`, champs `LocalizedText` avec `fr` obligatoire, propriétés CSS logiques compatibles RTL, sélecteur de langue). Sont suspendus : la traduction des nouvelles chaînes et contenus en arabe et en anglais (repli sur le français), les vérifications visuelles RTL, les tests exigeant la présence des 3 langues (le contrôle de complétude des clés rend l'arabe et l'anglais optionnels avec simple avertissement, fait en `keys.test.ts`), ainsi que le critère « 3 langues / RTL » de la Definition of Done des jalons (« reporté, D-82 »). Les traductions existantes ne sont pas supprimées. Un lot « traductions ar/en complètes + vérification RTL + réactivation des contrôles 3 langues » est prévu avant le pilote M8.
- **Alternatives :** Maintenir l'exigence des 3 langues à chaque jalon, ce qui ralentit le développement.
- **À valider :** non (décision du porteur du 30/09/2026)

## D-83 — Tailwind CSS 4 et shadcn/ui pour apps/admin

- **Date :** 30/09/2026
- **Décision :** Le back-office (apps/admin) adopte Tailwind CSS 4 et shadcn/ui comme imposé par la section 4.1 du cahier des charges, avec l'utilisation de propriétés CSS logiques pour assurer la compatibilité RTL (Arabe). Aucune API n'est modifiée.
- **Alternatives :** Rester sur du CSS personnalisé brut, ce qui s'éloigne du cahier des charges.
- **À valider :** non (consigne du porteur du 30/09/2026)

| Paquet | Raison | Licence |
| ------ | ------ | ------- |
| @radix-ui/react-label | Composant primitif de label pour shadcn/ui. | MIT |
| @radix-ui/react-slot | Composition de composants polymorphiques pour shadcn/ui. | MIT |
| @radix-ui/react-tabs | Composant d'onglets pour shadcn/ui (utilisé pour les langues). | MIT |
| @tailwindcss/vite | Intégration de Tailwind CSS 4 avec Vite. | MIT |
| tailwindcss | Cadre CSS utilitaire pour la mise en forme (version 4). | MIT |
| class-variance-authority | Gestion des variantes CSS pour les composants shadcn/ui. | Apache-2.0 |
| clsx | Utilitaire pour la construction conditionnelle de classes CSS. | MIT |
| tailwind-merge | Fusion de classes Tailwind pour éviter les conflits (shadcn/ui). | MIT |
| lucide-react | Icônes SVG pour l'interface utilisateur. | ISC |

## D-84 — Dépendances Worker & API (M2 F-11)

- **Date :** 02/10/2026
- **Décision :** Ajout de paquets pour le Worker M2 et l'API.
  - `sharp` (Apache-2.0) : Génération des dérivés (vignettes, tuiles) pour les panoramas 360° (Worker).
  - `bullmq` (MIT) : Gestion des files d'attente pour le traitement asynchrone des médias (fournit ses propres types, `@types/ioredis` n'est pas nécessaire). Utilisé dans le Worker pour traiter, et dans l'API pour soumettre des tâches (`panorama-queue.service`).
- **Alternatives :** `jimp` pour les images (plus lent, moins adapté aux très grandes images VR) ; `bull` (version antérieure, moins adaptée à TypeScript).
- **À valider :** non

## D-85 — Stockage S3 uniquement (M2 API-24)

- **Date :** 02/10/2026
- **Décision :** Stockage S3 uniquement (MinIO en local) pour les médias. Pas de fournisseur « local » simulé. Utilisation de @aws-sdk/s3-request-presigner (licence Apache-2.0) pour générer les URL présignées d'upload.
- **Raison :** Simplifie l'architecture en unifiant le pipeline de stockage entre les environnements de développement et de production. Évite de maintenir deux implémentations de stockage.
- **Alternatives :** Stockage local avec Multer (rejeté car diverge de la production).
- **À valider :** non


## D-86 — Upload de médias (API-24)

- **Date :** 02/10/2026
- **Décision :** Lors de l'initialisation de l'upload (createUploadUrl), l'enregistrement Asset est créé en base avec processingStatus à PENDING et un contentHash vide '' de manière provisoire jusqu'à la finalisation de l'upload. L'ID est généré par Prisma au moment de la création pour ensuite construire la clé de stockage originalKey. Ajout du champ `processingLog` au modèle `Asset` (migration additive `asset_processing_log`) pour le journal d'erreur. Lecture des dimensions JPEG (M2 F-10) ajoutée avec le paquet image-size.
- **Alternatives :** rendre le champ optionnel (nécessiterait une migration Prisma) ; le remplir dès le début avec une valeur aléatoire ; générer l'ID UUIDv7 avant l'insertion (nécessiterait une librairie UUIDv7).
- **À valider :** oui

| Paquet | Raison | Licence |
| --- | --- | --- |
| image-size | Lecture rapide des dimensions d'une image depuis les premiers octets (M2 F-10). | MIT |
| sharp | devDependency ajoutée à apps/api pour générer les images de test JPEG. | Apache-2.0 |

## D-87 — File panorama (contrat partagé) (M2 F-11)

- **Date :** 02/10/2026
- **Décision :** Création des constantes et types pour la file d'attente BullMQ dédiée aux panoramas (packages/shared/src/panorama-queue.ts). La file s'appelle 'panorama', a 3 tentatives, un backoff de 5000ms et une concurrence de 2. Les clés de stockage dérivées (preview, web, thumb, tiles) sont centralisées pour être partagées par le worker et l'API.
- **Alternatives :** Placer ces constantes dans apps/worker ou apps/api uniquement (rejeté car elles doivent être partagées pour les soumissions et les lectures).
- **À valider :** non


## D-88 — Dérivés de panorama (F-11)

- **Date :** 02/10/2026
- **Décision :** La génération des dérivés (preview, web, thumb) se fait via des instances de sharp(input) séparées. La miniature (thumb 400x225) extrait d'abord le centre de la vue initiale (yaw 0, c'est-à-dire le centre de l'image équirectangulaire), avant de redimensionner. L'extraction prend un quart de la largeur originale. Une erreur est levée si les métadonnées de l'image ne comportent pas de dimensions.
- **Alternatives :** Redimensionner l'image entière pour la miniature (déformé ou non pertinent).
- **À valider :** non


## D-89 — Charte graphique Xplor et polices

- **Date :** 02/10/2026
- **Décision :** Application de la charte Xplor au back-office (pps/admin). Couleurs shadcn modifiées (primary #6958A5, gris #E6E7E9, etc.). Polices Montserrat et Comfortaa auto-hébergées via @fontsource/montserrat et @fontsource/comfortaa (licence OFL), importées dans main.tsx pour éviter toute requête vers Google Fonts (permettant le mode hors ligne). Logos SVG importés dans src/assets/brand/.
- **Alternatives :** Utiliser Google Fonts (rejeté pour le mode hors ligne du kiosque) ; conserver le thème par défaut.
- **À valider :** non

| Paquet                  | Raison                                                                              | Licence |
| ----------------------- | ----------------------------------------------------------------------------------- | ------- |
| @fontsource/montserrat  | Police principale de la charte Xplor (titres, interface, texte courant).            | OFL     |
| @fontsource/comfortaa   | Police secondaire pour touches de marque.                                           | OFL     |

