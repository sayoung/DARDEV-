# Suivi — Xplor

## Jalon en cours

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA).

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 29/09/2026  
**Exigence :** NF-08 — lire le résultat de la CI distante sur `1eaf986` (D-63, scénario « inviter deux fois la même adresse »).

Plan :

1. `gh run list` puis `gh run view` sur le run du commit `1eaf986` ; artefacts `playwright-results`.
2. Si une étape échoue, corriger la cause dans le code (D-64) sans modifier une assertion conforme à la spécification.
3. Réécrire les critères 3 et 5 ; mettre à jour le run cité aux critères 1, 2, 7 et 10 et dans `docs/DEMO_M0.md` ; puce D-63 (scénario vert en CI, couverture de `apps/api/src/users` à 100 %).
4. `pnpm lint` et `pnpm typecheck`. Aucun push.

Réalisé : run `36580207347` (commit `1eaf986`, https://github.com/sayoung/DARDEV-/actions/runs/36580207347, job `ci` `109446061994`) en succès. Lint, typecheck, test:int (9 : `auth.int.test.ts` 7, `seed.int.test.ts` 1, `migrations.int.test.ts` 1), API smoke, e2e (7), unitaires (188, 35 fichiers), audit (4 avis moderate). Artefact `playwright-results` `11039602501`. Aucun échec : pas de correctif de code, pas de D-64. Couverture de `apps/api/src/users` laissée à 100 % (session précédente). En local (Node 22.23.3) : `pnpm lint` et `pnpm typecheck` verts. Aucun commit (orchestrateur).

## Definition of Done — M0

Cahier des charges, section 9 (livrable) et section 10 (liste commune). Definition of Done du jalon : **non remplie**.

| #   | Critère                                                                                                          | État                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Environnement complet en 4 commandes (`docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`) | Prouvé en CI (run `36580207347`), preuve locale en attente de Docker. L'étape « API smoke » (D-59, D-61, D-62) a joué `db:deploy` et `db:seed` sur PostgreSQL 16, puis `GET /api/health` 200 (`db`, `redis`, `storage` à `ok`). En local, Docker Desktop 4.93.0 est installé (D-52) mais le moteur ne démarre pas (`Virtual Machine Platform not enabled`). Les quatre commandes et `docker compose ps` ne sont pas jouées. Dépannage : `docs/INSTALL.md`.                  |
| 2   | Connexion au back-office                                                                                         | Prouvé en CI (run `36580207347`), preuve locale en attente de Docker. Vraie connexion `POST /api/v1/auth/login` (`admin@xplor.local`) puis `GET /api/v1/auth/me` à 200 (D-62). Le parcours dans le navigateur contre l'API locale n'est pas joué.                                                                                                                                                                                                                           |
| 3   | CI verte                                                                                                         | Rempli sur le run `36580207347` (push `develop`, commit `1eaf986`, 29/09/2026 14:06 UTC, https://github.com/sayoung/DARDEV-/actions/runs/36580207347), job `ci` `109446061994` : succès. Lint, typecheck, test:int (9), API smoke, e2e (7), unitaires (188), audit (4 avis moderate). Artefact `playwright-results` `11039602501`. Le run `36568794014` échouait au pull `minio/minio` ; D-61 est dans ce run.                                                                                      |
| 4   | Exigences du jalon implémentées, critères d'acceptation vérifiés (NF-06, NF-08, NF-09, F-90 sans 2FA)            | Code du socle en place, y compris `docs/DEMO_M0.md` (variante sans Docker, D-62). Scénarios Playwright du back-office verts avec `/api` simulé (D-55). Critères 1, 2 et 7 : prouvés en CI (run `36580207347`), preuve locale en attente de Docker. CI : critère 3 rempli sur ce run.                                                                                                                                                                                        |
| 5   | Tests verts en CI : Vitest unitaire, intégration API, Playwright                                                 | Run `36580207347` (https://github.com/sayoung/DARDEV-/actions/runs/36580207347) : lint vert, typecheck vert, test:int vert (9 tests : `auth.int.test.ts` 7, `seed.int.test.ts` 1, `migrations.int.test.ts` 1), unitaires verts (188 tests, 35 fichiers), e2e vert (7), audit vert (4 avis moderate sous le seuil). API smoke vert (`GET /api/health`, `GET /api/v1/openapi.json`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`). Artefact `playwright-results` `11039602501`. |
| 6   | `pnpm lint` et `pnpm typecheck` sans erreur                                                                      | Verts (Node 22.23.3), y compris `playwright.config.ts`, `e2e/`, `apps/api/src/app.module.test.ts` (D-57), `scripts/ci-api-smoke.mjs` (D-59) et l'override `deepmerge-ts` 8.0.2 (D-60).                                                                                                                                                                                                                                                                                      |
| 7   | Migrations Prisma appliquées sur une base vierge ; seed à jour                                                   | Prouvé en CI (run `36580207347`), preuve locale en attente de Docker. `db:deploy` puis `db:seed` sur la base `xplor` de PostgreSQL 16 (vierge en début de job, distincte de `xplor_test`) dans « API smoke » (D-62). Fichiers : `20260929022909_init_users`, `20260929043449_user_tokens`. Aucune migration `fix_drift`. En local, `pnpm db:migrate` et `pnpm db:seed` ne sont pas lancés.                                                                                  |
| 8   | Chaînes fr/ar/en ; contrôle visuel arabe (RTL)                                                                   | Chaînes et test de complétude en place. Capture Playwright pleine page `docs/screenshots/login-ar.png` (`?lang=ar`, `lang=ar`, `dir=rtl`), citée dans `docs/DEMO_M0.md`. Le sélecteur de langue est couvert par Vitest (jsdom) ; il n'a pas été cliqué dans un navigateur graphique. Le contrôle visuel par le porteur pendant la démo n'est pas fait.                                                                                                                      |
| 9   | `docs/PROGRESS.md`, `docs/DECISIONS.md`, OpenAPI à jour                                                          | PROGRESS et DECISIONS mis à jour (run `36580207347`, D-62, D-63). DECISIONS : D-58 à D-63. `docs/openapi.json` et `GET /api/v1/openapi.json` en place (D-49) ; l'étape « API smoke » de ce run a obtenu 200. L'URL n'a pas été appelée en local : moteur Docker injoignable. `.gitattributes` (`docs/openapi.json text eol=lf`) ; `git add --renormalize .` non lancé (orchestrateur). Le test d'identité normalise déjà les CRLF.                                                |
| 10  | `pnpm db:seed` : 3 visites liées, 1 hôtel, 1 kiosque, un utilisateur par rôle                                    | Utilisateurs : `db:seed` a tourné en CI dans « API smoke » (run `36580207347`, D-62). Exécution locale en attente de Docker. Hôtel, kiosque et visites : jalon M1, pas M0.                                                                                                                                                                                                                                                                                                  |
| 11  | Démo au porteur faite, retours consignés                                                                         | Scénario écrit (`docs/DEMO_M0.md`), y compris la variante « démo sans Docker local » (D-62). Liste Résultat vide. Démo non jouée par le porteur.                                                                                                                                                                                                                                                                                                                            |

## Tableau

### Fait

- **NF-06**
  - Paquet `@xplor/i18n` fr/ar/en, `isRtl` / `dir`, test de complétude des clés (D-30).
  - Web et kiosque : `?lang=` pose `lang` / `dir`, libellé `common.appName` depuis `@xplor/i18n` (D-36).
- **NF-08**
  - ESLint 9, Prettier, Vitest, `@xplor/shared` (`Role`, `LocalizedText`, `localize`) et leurs tests (D-29).
  - `@xplor/api` : NestJS 11 sur Fastify, préfixe `/api/v1`, `loadEnv` (Zod), `ConfigModule` global (D-33).
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
  - `docs/DEMO_M0.md` (scénario porteur, liste Résultat) et `docs/INSTALL.md` (Node 22, `.env` racine et `apps/api/.env`, `pnpm test:int`, `pnpm test:e2e`).
  - `.gitignore` ignore `test-results/`, `playwright-report/`, `blob-report/` et `playwright/.cache/` ; `git.txt` supprimé.
  - Section « Dépannage : moteur Docker injoignable » dans `docs/INSTALL.md` (29/09/2026).
  - D-62 : tant que la virtualisation est désactivée, l'étape « API smoke » prouve provisoirement les critères 1, 2 et 7. Run vert `36580207347`. Variante « démo sans Docker local » dans `docs/DEMO_M0.md`. À valider par le porteur.
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
  - `auth.int.test.ts` : application Nest sur Fastify (`app.inject`, cookie `xplor_sid`, `FakeMailer`), scénarios login, CSRF, logout 204, verrouillage, reset et invitation (D-51). Vert en CI (critère 5) ; pas relancé en local.
  - `@playwright/test` 1.63.0, `playwright.config.ts` (Chromium, `e2e`, `http://localhost:5173`), script `test:e2e`, `e2e/smoke.spec.ts` (D-54, D-58). Vitest exclut `e2e/**`.
  - `e2e/back-office.spec.ts` simule `/api/**` (`MeResponseSchema`, `LoginRequestSchema`, `ForgotPasswordRequestSchema`), textes `@xplor/i18n`, capture `docs/screenshots/login-ar.png` (D-55).

### En cours

- Preuve locale des critères 1, 2 et 7 (D-62) : activer la virtualisation, puis jouer les quatre commandes, la connexion réelle, `pnpm db:migrate`, `pnpm db:seed` et `pnpm dev`.
- Contrôle visuel arabe (RTL) par le porteur (critère 8) et démo `docs/DEMO_M0.md` (critère 11), y compris la variante sans Docker.
- Appeler `GET /api/v1/openapi.json` sur l'API démarrée en local (critère 9). L'appel est déjà vert en CI.

### Bloqué

- 29/09/2026 — moteur Docker injoignable : la virtualisation est désactivée. Docker Desktop 4.93.0 est installé ; le moteur linux/wsl ne démarre pas (`Virtual Machine Platform not enabled` / `No virtualization available`). Symptômes : preuve locale des critères 1, 2 et 7 (D-62). Action du porteur : activer Intel VT-x ou AMD-V (SVM) dans le BIOS/UEFI, activer les fonctionnalités Windows VirtualMachinePlatform et Microsoft-Windows-Subsystem-Linux, redémarrer, lancer `wsl --update` puis `wsl --status`, relancer Docker Desktop et confirmer que `docker version` affiche une section Server. Commandes : section « Dépannage : moteur Docker injoignable » de `docs/INSTALL.md`.

### Risques

- La preuve locale des critères 1, 2 et 7 attend la virtualisation (D-62). Le run `36580207347` a l'étape « API smoke » verte, image D-61 comprise. Ce correctif n'est pas rejoué sur le poste.
- Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm).
- ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, exigés par NF-08.
- Quatre avis moderate restent sous le seuil CI : Vitest 3.2.7 et `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11 ; D-29 maintient Vitest 3) et fastify 5.11.3 (GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, correctif en 5.12.1 ; D-39 épingle 5.11.3).
- En local, les healthchecks MinIO (`curl` sur `/minio/health/live`, D-61) et Mailpit (`wget` sur `/livez`) ne sont pas confirmés. En CI, `GET /api/health` a répondu 200 (run `36580207347`).
- Le sélecteur de langue, la connexion, la réinitialisation et l'invitation n'ont pas été ouverts dans un navigateur graphique contre l'API (Vitest jsdom, ou Playwright avec `/api` simulé). Les scénarios back-office ne démarrent pas l'API.
- Prisma 6 avertit que `package.json#prisma` (dont `prisma.seed`) est déprécié au profit de `prisma.config.ts` en Prisma 7 ; D-34 et D-41 conservent Prisma 6 et ce champ.
- `.gitattributes` ne force LF au checkout de `docs/openapi.json` qu'une fois `git add --renormalize .` indexé par l'orchestrateur (critère 9).
- Décisions encore à valider : voir `docs/DECISIONS.md` (D-37, D-38, D-39, D-40, D-44, D-45, D-46, D-47, D-48, D-49, D-51, D-54, D-55, D-61, D-62, D-63).
