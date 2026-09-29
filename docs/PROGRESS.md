# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** M0 NF-09 — préparer la démo M0 au porteur. Aucun code.

Plan :

1. Lire `docs/DEMO_M0.md`, D-62 et les critères 8 et 11.
2. Faire du parcours local sous Node 22 (`docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`) la variante principale de `docs/DEMO_M0.md`. Garder le repli « démo sans Docker local » (D-62).
3. Cocher dans Résultat les preuves déjà obtenues (date et source local ou CI). Laisser vides les contrôles du porteur, chacun avec une ligne « Retours du porteur ».
4. Compléter D-62 : preuve locale du 29/09/2026, CI complémentaire, question de validation sans objet pour les critères 1, 7 et 10.
5. Critères 8 et 11 : démo prête, n'attend plus que le porteur. `En cours` réduit à cette ligne. `pnpm lint`, Prettier sur le Markdown. Aucun commit (orchestrateur).

Réalisé (29/09/2026) : les cinq points ci-dessus. Aucun code modifié. Le détail des preuves reste dans le tableau Definition of Done et dans D-62.

## Definition of Done — M0

Cahier des charges, section 9 (livrable) et section 10 (liste commune). Definition of Done du jalon : **non remplie**.

| #   | Critère                                                                                                          | État                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Environnement complet en 4 commandes (`docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`) | Prouvé en local (29/09/2026, Node 22.23.3) et en CI (run `36580207347`). `docker version` affiche une section Server (Docker Desktop 4.93.0, moteur 29.8.1, linux/amd64). `docker compose up -d` : postgres, redis, minio et mailpit `healthy` ; `minio-init` `Exited (0)`. `pnpm db:migrate` : « Already in sync ». `pnpm db:seed` deux fois : « 4 utilisateurs de démonstration prêts. » `.env` et `apps/api/.env` existaient déjà. `pnpm install` non rejoué (workspace déjà installé ; `pnpm test:int` vert, 9 tests). L'étape « API smoke » du run CI reste une preuve distincte (`GET /api/health` 200). |
| 2   | Connexion au back-office                                                                                         | Prouvé en local (29/09/2026, Node 22.23.3) et en CI (run `36580207347`, D-62). `scripts/ci-api-smoke.mjs` sort en 0 sur `http://localhost:3000` et sur le proxy `http://localhost:5173` : `GET /api/health` 200 (`db`, `redis`, `storage` à `ok`), `GET /api/v1/openapi.json` 200, `POST /api/v1/auth/login` 200 avec le cookie `xplor_sid`, `GET /api/v1/auth/me` 200. `POST /api/v1/auth/password/forgot` via le proxy : 202. Le clic dans un navigateur graphique n'est pas fait.                                                                                                                           |
| 3   | CI verte                                                                                                         | Rempli sur le run `36580207347` (push `develop`, commit `1eaf986`, 29/09/2026 14:06 UTC, https://github.com/sayoung/DARDEV-/actions/runs/36580207347), job `ci` `109446061994` : succès. Lint, typecheck, test:int (9), API smoke, e2e (7), unitaires (188), audit (4 avis moderate). Artefact `playwright-results` `11039602501`. Le run `36568794014` échouait au pull `minio/minio` ; D-61 est dans ce run.                                                                                                                                                                                                 |
| 4   | Exigences du jalon implémentées, critères d'acceptation vérifiés (NF-06, NF-08, NF-09, F-90 sans 2FA)            | Code du socle en place, y compris `docs/DEMO_M0.md` (parcours local principal, repli D-62). Scénarios Playwright du back-office verts avec `/api` simulé (D-55). Critères 1, 2, 7 et 10 : preuve locale obtenue (29/09/2026). Le clic de connexion dans un navigateur graphique n'est pas fait. CI : critère 3 rempli sur le run `36580207347`. La démo n'attend plus que le porteur (critères 8 et 11).                                                                                                                                                                                                       |
| 5   | Tests verts en CI : Vitest unitaire, intégration API, Playwright                                                 | Run `36580207347` (https://github.com/sayoung/DARDEV-/actions/runs/36580207347) : lint vert, typecheck vert, test:int vert (9 tests : `auth.int.test.ts` 7, `seed.int.test.ts` 1, `migrations.int.test.ts` 1), unitaires verts (188 tests, 35 fichiers), e2e vert (7), audit vert (4 avis moderate sous le seuil). API smoke vert (`GET /api/health`, `GET /api/v1/openapi.json`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`). Artefact `playwright-results` `11039602501`.                                                                                                                              |
| 6   | `pnpm lint` et `pnpm typecheck` sans erreur                                                                      | Verts (Node 22.23.3), y compris `playwright.config.ts`, `e2e/`, `apps/api/src/app.module.test.ts` (D-57), `scripts/ci-api-smoke.mjs` (D-59) et l'override `deepmerge-ts` 8.0.2 (D-60).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Migrations Prisma appliquées sur une base vierge ; seed à jour                                                   | Prouvé en local et en CI (run `36580207347`). `pnpm db:migrate` (Node 22.23.3, `prisma migrate dev`) sur PostgreSQL 16, base `xplor` : « Already in sync, no schema change or pending migration was found. » Aucune migration `fix_drift`. Fichiers inchangés : `20260929022909_init_users`, `20260929043449_user_tokens`. `pnpm db:seed` deux fois, idempotent. En CI, `db:deploy` puis `db:seed` sur une base vierge en début de job (D-62).                                                                                                                                                                 |
| 8   | Chaînes fr/ar/en ; contrôle visuel arabe (RTL)                                                                   | Chaînes et test de complétude en place. Capture Playwright pleine page `docs/screenshots/login-ar.png` (`?lang=ar`, `lang=ar`, `dir=rtl`), citée dans `docs/DEMO_M0.md`. Le sélecteur de langue est couvert par Vitest (jsdom). La démo est prête (`docs/DEMO_M0.md`, parcours local principal) et n'attend plus que le porteur : bascule en arabe et contrôle visuel RTL de chaque écran (connexion, mot de passe oublié, définition du mot de passe, accueil).                                                                                                                                               |
| 9   | `docs/PROGRESS.md`, `docs/DECISIONS.md`, OpenAPI à jour                                                          | PROGRESS et DECISIONS mis à jour (démo M0 NF-09, D-62 complétée ; parcours local F-90, D-64). DECISIONS : D-58 à D-64. `GET /api/v1/openapi.json` 200 en local le 29/09/2026 (Node 22.23.3) sur `http://localhost:3000` et sur `http://localhost:5173`, et en CI (run `36580207347`, D-49). `.gitattributes` (`docs/openapi.json text eol=lf`) ; `git add --renormalize .` non lancé (orchestrateur). Le test d'identité normalise déjà les CRLF.                                                                                                                                                              |
| 10  | `pnpm db:seed` : 3 visites liées, 1 hôtel, 1 kiosque, un utilisateur par rôle                                    | Utilisateurs prouvés en local : `pnpm db:seed` deux fois (Node 22.23.3), « 4 utilisateurs de démonstration prêts. » `test/seed.int.test.ts` vert. Aussi en CI (run `36580207347`, D-62). Hôtel, kiosque et visites : jalon M1, pas M0.                                                                                                                                                                                                                                                                                                                                                                         |
| 11  | Démo au porteur faite, retours consignés                                                                         | Démo prête (`docs/DEMO_M0.md`) et n'attend plus que le porteur. Parcours local principal sous Node 22 (`docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`) ; repli « démo sans Docker local » (D-62). Résultat : étapes techniques cochées (29/09/2026, source local ou CI, run `36580207347`). Contrôles du porteur laissés vides, avec une ligne « Retours du porteur ».                                                                                                                                                                                                  |

## Tableau

### Fait

- **NF-06**
  - Paquet `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés (D-30).
  - Web et kiosque : `?lang=` pose `lang` / `dir`, libellé `common.appName` depuis `@xplor/i18n` (D-36).
- **NF-08**
  - ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests (D-29).
  - `@xplor/api` : NestJS 11 sur Fastify, préfixe `/api/v1`, `loadEnv` (Zod), `ConfigModule` global (D-33).
  - Script `dev` : `tsx watch src/main.ts` (D-64). `nest start --watch` s'arrêtait sur `ERR_MODULE_NOT_FOUND` (`packages/shared/src/auth.js`).
  - Squelettes `@xplor/web` (5174), `@xplor/kiosk` (5175), `@xplor/worker` (`REDIS_URL`, journal `worker prêt`, sans BullMQ) (D-36).
  - `GET /api/health` agrège base, Redis et stockage (délai 2 s, 200 ou 503), hors préfixe `/api/v1` (D-38, aussi NF-04).
  - `@xplor/admin` : React 19 + Vite, port 5173, proxy `/api`, i18next, sélecteur fr/ar/en (`?lang=` puis `localStorage` `xplor.lang`, `dir` sans rechargement) (D-42).
  - OpenAPI 3.1 depuis les schémas Zod (`@asteasolutions/zod-to-openapi`), fichier `docs/openapi.json`, `GET /api/v1/openapi.json` hors production, `.gitattributes` eol=lf (D-49).
  - Harness Vitest `api-int`, `pnpm test:int`, `globalSetup` (`DATABASE_URL_TEST`, `prisma migrate deploy`, `resetDb()`), `migrations.int.test.ts` et `seed.int.test.ts` (D-50).
  - Workflow `.github/workflows/ci.yml` : lint, typecheck, test, audit ; services postgres:16 et redis:7 ; Playwright Chromium `--with-deps`, `pnpm test:e2e` (`CI=true`), artefact `playwright-results` (D-32, D-56).
  - `@Inject` explicite sur les constructeurs Nest du graphe `AppModule`, test `apps/api/src/app.module.test.ts` (D-57). Commit `31d3f82` sur `origin/develop`.
  - Étape « API smoke » après `pnpm test:int` (MinIO, bucket `xplor`, `db:deploy`, `db:seed` sur `xplor`, `scripts/ci-api-smoke.mjs`, arrêt de l'API `if: always()`) (D-59). Verte sur le run `36580207347`. Le run `36568794014` échouait au pull `minio/minio`.
  - `pnpm.overrides` force `deepmerge-ts` 8.0.2 (GHSA-ggr8-5vv4-36mx) ; `pnpm audit --audit-level=high` sort en 0 en local (D-60) et sur le run `36580207347` (4 avis moderate).
  - Image `xplor-minio:2025-09-07` (`docker/minio/Dockerfile`, binaires GitHub `RELEASE.2025-09-07T16-13-09Z` et `mc` `RELEASE.2025-08-13T08-35-41Z`) à la place de `minio/minio` et `minio/mc` (D-61). Présente dans le run `36580207347`.
- **NF-09**
  - Squelette monorepo pnpm, `docker-compose.yml` (postgres, redis, minio, mailpit), `docker/postgres/init.sql`, `.env.example`, `docs/INSTALL.md` (D-31).
  - Prisma : schéma `User` et enum `Role`, migration `20260929022909_init_users` (générée sans base), scripts `db:migrate` / `db:deploy` / `db:generate`, `PrismaModule` global (D-34).
  - `prisma/seed.ts` upsert quatre utilisateurs actifs (`admin@xplor.local` ADMIN, `editor@xplor.local` EDITOR, `manager@xplor.local` HOTEL_MANAGER, `partner@xplor.local` PARTNER), mot de passe `SEED_DEFAULT_PASSWORD` haché en argon2id, idempotent (D-41). Hôtel, kiosque et visites : M1.
  - `docs/DEMO_M0.md` (parcours local principal sous Node 22, repli D-62, Résultat prérempli pour les preuves du 29/09/2026) et `docs/INSTALL.md` (Node 22, `.env` racine et `apps/api/.env`, `pnpm test:int`, `pnpm test:e2e`).
  - `.gitignore` ignore `test-results/`, `playwright-report/`, `blob-report/` et `playwright/.cache/` ; `git.txt` supprimé.
  - Section « Dépannage : moteur Docker injoignable » dans `docs/INSTALL.md` (29/09/2026).
  - D-62 : preuve locale obtenue le 29/09/2026. La CI (run `36580207347`) reste une preuve complémentaire. La question de validation est sans objet pour les critères 1, 7 et 10. `docs/DEMO_M0.md` : parcours local principal, repli « démo sans Docker local ». Démo prête, n'attend plus que le porteur.
  - Moteur local (29/09/2026) : `docker version` affiche Server (Docker Desktop 4.93.0). `VirtualizationFirmwareEnabled` reste False ; VirtualMachinePlatform et WSL sont activées (InstallState 1) ; WSL 2, distribution `docker-desktop`. Quatre services `healthy`, `minio-init` sorti en 0. `pnpm db:migrate` déjà synchronisé, `pnpm db:seed` deux fois, `pnpm test:int` 9 verts. Aucun code modifié.
- **F-90**
  - `AccessPolicy` (`apps/api/src/auth/access-policy.ts`, couverture 100 %), `Principal` et `PasswordSchema` (≥ 12 caractères) dans `@xplor/shared` (D-35).
  - `PasswordService` argon2id (`@node-rs/argon2`), liste SecLists `Pwdb_top-10000.txt`, `validateNewPassword` (`PASSWORD_TOO_COMMON`), verrouillage `lockout.ts` (10 échecs, 15 min) (D-37).
  - `SessionStore` Redis (`sess:<id>`, set par utilisateur, inactivité 8 h) et mémoire (tests), cookie `xplor_sid`, `SessionGuard` et `CsrfGuard` (D-39).
  - `POST /api/v1/auth/login`, `POST logout`, `GET me`, `UserRepository`, 401 `INVALID_CREDENTIALS`, 423 `ACCOUNT_LOCKED`, `@nestjs/throttler` 5/min/IP (D-40).
  - Écran de connexion : `AuthProvider`, `LoginPage`, client `fetch` avec jeton CSRF, accueil nom / rôle `auth.role.*`, clés `auth.login.locked` et `auth.login.failed` fr/ar/en (D-43).
  - Enum `UserTokenType`, modèle `UserToken`, migration `20260929043449_user_tokens` (générée sans base), `generateToken` / `hashToken` / `expiryFor` / `checkToken` (invitation 48 h, réinitialisation 1 h) (D-44).
  - `MailModule` global, `SmtpMailer` (nodemailer, sans authentification vers Mailpit) et `FakeMailer`, `renderMail` (`mail.invite.*` / `mail.reset.*`, fr/ar/en), `ADMIN_BASE_URL` (défaut `http://localhost:5173`) (D-45).
  - `POST /api/v1/auth/password/forgot` (202, 5/min/IP) et `POST /api/v1/auth/password/reset` (204), publics ; `UserTokenRepository` ; 202 uniforme même si l'envoi échoue ; `TOKEN_INVALID` unique ; transaction puis destruction des sessions (D-46).
  - `POST /api/v1/admin/users/invitations` (ADMIN, 201, courriel `invite` dans `uiLang`) et `POST /api/v1/auth/invite/accept` (public, 204, 5/min/IP, sans session). Compte créé `active=false` ; 409 `EMAIL_TAKEN` ; jeton `INVITE` 48 h (D-47). CRUD utilisateurs et rattachement aux hôtels : hors de ce jalon.
  - Réinvitation d'un compte `active=false` dont `lastLoginAt` est null : mise à jour de `name`, `role` et `uiLang`, invalidation des jetons `INVITE`, nouveau jeton 48 h, courriel après la transaction, 201 `InviteUserResponseSchema`. Un compte actif ou déjà connecté répond 409 (D-63). Couverture Vitest de `apps/api/src/users` : 100 % (lignes, branches, fonctions, instructions). Le scénario `auth.int.test.ts` « renouvelle une invitation jamais acceptée et n'accepte que le second lien » est vert en CI (run `36580207347`, test:int 9).
  - Écrans `/forgot`, `/reset/:token` et `/invite/:token` (routeur maison) ; `SetPasswordPage` partagée (`PasswordSchema`, confirmation identique) ; `TOKEN_INVALID`, `PASSWORD_TOO_COMMON` et `PASSWORD_INVALID` traduits ; succès vers la connexion avec un message (D-48).
  - `auth.int.test.ts` : application Nest sur Fastify (`app.inject`, cookie `xplor_sid`, `FakeMailer`), scénarios login, CSRF, logout 204, verrouillage, reset et invitation (D-51). Vert en CI (critère 5) et en local (29/09/2026, `pnpm test:int`, 7 tests).
  - `@playwright/test` 1.63.0, `playwright.config.ts` (Chromium, `e2e`, `http://localhost:5173`), script `test:e2e`, `e2e/smoke.spec.ts` (D-54, D-58). Vitest exclut `e2e/**`.
  - `e2e/back-office.spec.ts` simule `/api/**` (`MeResponseSchema`, `LoginRequestSchema`, `ForgotPasswordRequestSchema`), textes `@xplor/i18n`, capture `docs/screenshots/login-ar.png` (D-55).
  - Parcours local (29/09/2026, Node 22.23.3, D-64) : `scripts/ci-api-smoke.mjs` sort en 0 sur `http://localhost:3000` et sur `http://localhost:5173`. `POST /api/v1/auth/password/forgot` via le proxy : 202. Mailpit a un message pour `editor@xplor.local` dont le corps contient `/reset/`.

### En cours

- Démo M0 prête (`docs/DEMO_M0.md`) : n'attend plus que le porteur (critères 8 et 11).

### Bloqué

Aucun.

### Risques

- `VirtualizationFirmwareEnabled` vaut False, mais le moteur répond (Server Docker Desktop 4.93.0, WSL 2 `docker-desktop`).
- Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm).
- ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, exigés par NF-08.
- Quatre avis moderate restent sous le seuil CI : Vitest 3.2.7 et `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11 ; D-29 maintient Vitest 3) et fastify 5.11.3 (GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, correctif en 5.12.1 ; D-39 épingle 5.11.3).
- Les ports 5174 et 5175 restent pris sur `[::1]` par des `node.exe` antérieurs (PID 20972 et 5156). `taskkill` répond « Accès refusé ». `pnpm dev` sans `--no-bail` s'arrête sur `EADDRINUSE` pour le web et le kiosque.
- Le sélecteur de langue et l'invitation n'ont pas été ouverts dans un navigateur graphique contre l'API (Vitest jsdom, ou Playwright avec `/api` simulé). Les scénarios back-office ne démarrent pas l'API. La connexion et le courriel de réinitialisation ont été exercés en HTTP le 29/09/2026.
- Prisma 6 avertit que `package.json#prisma` (dont `prisma.seed`) est déprécié au profit de `prisma.config.ts` en Prisma 7 ; D-34 et D-41 conservent Prisma 6 et ce champ.
- `.gitattributes` ne force LF au checkout de `docs/openapi.json` qu'une fois `git add --renormalize .` indexé par l'orchestrateur (critère 9).
- Décisions encore à valider : voir `docs/DECISIONS.md` (D-37, D-38, D-39, D-40, D-44, D-45, D-46, D-47, D-48, D-49, D-51, D-54, D-55, D-61, D-63, D-64). D-62 : question de validation sans objet pour les critères 1, 7 et 10.
