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
- **Décision :** `POST /api/v1/admin/users/invitations` est réservé à `ADMIN` (`SessionGuard`, `CsrfGuard`, `canManageUsers`). EDITOR, HOTEL_MANAGER et PARTNER reçoivent 403, même avec des hôtels rattachés. La route n'est pas limitée en débit : l'appelant est déjà authentifié. Le corps est `InviteUserRequestSchema` (email, nom non vide, `Role`, `uiLang`). La réponse 201 est `InviteUserResponseSchema` (id, email, nom, rôle). L'email est normalisé (trim, minuscules), comme au login (D-40). S'il existe déjà, le service répond 409 `EMAIL_TAKEN`, sans courriel et sans nouveau jeton, y compris lorsque le compte est encore inactif. Le compte est créé avec `active=false`. `passwordHash` est l'argon2id d'un secret de 32 octets (base64url) qui n'est ni stocké, ni envoyé, ni renvoyé. Les jetons `INVITE` encore inutilisés de ce compte sont marqués `usedAt` avant d'en créer un nouveau, valable 48 h (D-44). Le courriel est `renderMail('invite', uiLang, lien)` avec `ADMIN_BASE_URL/invite/<token>` (D-45). `POST /api/v1/auth/invite/accept` est public, limité à 5 requêtes par minute et par IP (même compteur mémoire que le login, D-40), et répond 204 sans poser de cookie de session. `checkToken` qui n'est pas `OK`, un jeton d'un autre type, ou un compte absent produisent le même 400 `TOKEN_INVALID`. Le jeton d'un compte absent est consommé avant le contrôle du mot de passe. `validateNewPassword` produit 400 `PASSWORD_TOO_COMMON` ou `PASSWORD_INVALID` sans consommer le jeton. La transaction pose `usedAt` seulement si le jeton est encore libre, puis hache le mot de passe choisi et passe `active` à true. Elle ne remet pas `failedLoginCount` ni `lockedUntil` à zéro (contrairement à D-46) et ne détruit pas de session. Le reste de l'API-28 (CRUD complet, rattachement aux hôtels) reste pour M1/M8. Aucun paquet ajouté.
- **Alternatives :** créer le compte déjà actif ; renvoyer une invitation pour un email inactif au lieu de 409 ; ouvrir une session à l'acceptation ; répondre 200 avec un corps ; remettre le verrouillage à zéro comme pour la réinitialisation ; distinguer un jeton expiré d'un jeton inconnu ; hacher le mot de passe avant de poser `usedAt` (deux acceptations parallèles pourraient alors écrire le mot de passe si la transaction simulée des tests n'annule pas).
- **À valider :** oui (compte inactif jusqu'à l'acceptation ; 409 même si l'invitation n'a pas été acceptée ; pas de session à l'acceptation ; pas de remise à zéro du verrouillage ; `usedAt` avant le hachage dans la transaction)

## D-48 — Écrans de réinitialisation et d'invitation (F-90)

- **Date :** 29/09/2026
- **Décision :** Le back-office route `/forgot`, `/reset/<token>` et `/invite/<token>` avec `history.pushState` et l'événement `popstate`, sans paquet de routage. Toute autre adresse affiche la session (connexion ou accueil). Les liens interceptent le clic simple et laissent le navigateur ouvrir un nouvel onglet si un modificateur est enfoncé. `?lang=` est conservé lors d'un changement d'écran. Après un mot de passe enregistré, l'adresse redevient `/` avec `notice=reset` ou `notice=invite`, et le message `auth.setPassword.successReset` ou `auth.setPassword.successInvite` s'affiche. `POST /api/v1/auth/password/forgot` (202), `POST /api/v1/auth/password/reset` (204) et `POST /api/v1/auth/invite/accept` (204) passent par `client.ts`, qui parse les schémas de `@xplor/shared` avant l'envoi. L'écran d'oubli affiche toujours `auth.forgot.sent` quand la réponse est acceptée, sans dire si le compte existe. Une confirmation différente ou un mot de passe refusé par `PasswordSchema` n'appelle pas le réseau. `TOKEN_INVALID`, `PASSWORD_TOO_COMMON` et `PASSWORD_INVALID` (400) utilisent `auth.errors.*`. Tout autre échec utilise `auth.errors.request`. Aucun paquet ajouté.
- **Alternatives :** `react-router-dom` ; afficher la confirmation d'oubli même si le réseau échoue ; message de succès seulement dans l'état React, perdu au rafraîchissement.
- **À valider :** oui (routeur maison ; paramètre `notice` ; confirmation uniquement sur réponse acceptée)

## Encore à valider (cahier des charges, section 11.2)

Pas de numéro de décision tant que le porteur n'a pas tranché :

1. Matériel des kiosques : mini-PC + écran tactile 32" et/ou casque autonome (Meta Quest 3 / Pico 4).
2. Hébergement : VPS au Maroc ou cloud international ; stockage S3 (MinIO auto-hébergé ou service géré). Impact loi 09-08 et coût.
3. Nombre de visites prévues au lancement et liste des sites de la région Rabat-Salé-Kénitra.
4. Nom de domaine et charte graphique Xplor.
