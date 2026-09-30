# Suivi — Xplor

## Jalon en cours

**M1 — Modèle de données** (S3–S6). Exigences du jalon : F-01, F-02 (sans traitement), F-03, F-04, F-05, API-21/22/23/25.

Contenu (cahier des charges, section 9) : schéma Prisma 5.1 à 5.8, API-21/22/23/25 (CRUD), écrans admin de liste et de formulaire, onglets de traduction, règles de validation. Livrable : création d'une visite de 3 scènes et hotspots (coordonnées saisies à la main) via le back-office.

Definition of Done du jalon : non remplie.

## Session en cours

**Date :** 30/09/2026
**Exigence :** M1 API-22 (écran des scènes) — correction de revue

Plan :
1. Corriger les erreurs lint dans `TourScenesSection.tsx` (types de `title`/`caption`, assertions inutiles) et `TourScenesSection.test.tsx` (`eslint-disable`, assertions non nulles).
2. Compléter les mocks dans les tests (ajouter `createdAt` dans `mockScenes`, compléter l'asset mock selon `AssetResponseSchema`).
3. Corriger les clés de traduction (`catalog.actions`, `catalog.edit`, `catalog.cancel`, `common.deleteConfirm`).
4. Implémenter le rechargement de la visite (`getTour` et `onTourUpdated`) après création ou suppression d'une scène, et ajouter un test validant la mise à jour du badge.
5. Garder le formulaire monté (supprimer `loading` lors des rechargements) et ajouter `TourScenesSection.css`.
6. Afficher une erreur locale pour Zod (`catalog.errors.invalidForm`).
7. Mettre à jour `docs/PROGRESS.md` et s'assurer que `lint`, `typecheck` et `test` passent.

Réalisé (30/09/2026) : correction de revue M1 API-22 (écran des scènes). Les types de state `title` et `caption` utilisent désormais `LocalizedText`. Les assertions non nulles dans les tests ont été remplacées par des vérifications ou des casts sûrs, et les `eslint-disable` supprimés. Les mocks ont été alignés sur les schémas partagés (`createdAt` ajouté, mock asset complet). Les clés i18n introuvables ont été corrigées. Après une création ou suppression de scène, la visite est rechargée via `getTour` puis passée à `onTourUpdated`, ce qui déclenche un rendu pour le badge "Scène de départ", testé avec succès. `loading` est maintenant réservé au chargement initial. CSS logique intégré. L'erreur `ZodError` est traitée localement. `pnpm lint`, `pnpm typecheck` et `pnpm test` passent avec succès. Aucun commit (orchestrateur).

Réalisé (30/09/2026) :
- `TourForm.test.tsx` corrigé : `HTMLElement` résolu en omettant le champ de garde de `LocalizedTextField`.
- `TourDetailPage.tsx` affiche désormais les erreurs réseau autres que 404 via `globalError` et utilise `ApiError`. La dépendance `t` est retirée de l'effet.
- Types de l'API importés dans `TourForm.tsx` (`CityResponse`, `CategoryResponse`).
- Validation des tests e2e, typecheck et lint. Tous validés avec succès.

Réalisé (30/09/2026) : 
- `TourResponseSchema` mis à jour et validé avec ces deux champs.
- Le helper `toTour` de l'API remplit automatiquement ces champs pour tous les endpoints retournant une `TourResponse`.
- Les mocks admin et api (`ToursPage.test.tsx` et `scenes.service.test.ts`) ont été adaptés.
- Les tests d'intégration (`tours.int.test.ts`, `scenes.int.test.ts`, `tours-publication.int.test.ts`) s'assurent désormais que la création donne des nulls, la publication pose `publishedAt`, et le set-start pose `startSceneId`.
- OpenAPI regénéré. 
- Décisions et `PROGRESS.md` corrigés (D-78 -> D-79).
- Succès de `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:int`. Aucun commit (orchestrateur).

```text
NODE v22.23.3

> xplor@ lint D:\DARDEV\local\xplor_smit
> eslint .

> xplor@ typecheck D:\DARDEV\local\xplor_smit
> tsc --noEmit -p tsconfig.json && pnpm -r typecheck

Scope: 7 of 8 workspace projects
apps/worker typecheck$ tsc --noEmit -p tsconfig.json
packages/shared typecheck$ tsc --noEmit -p tsconfig.json
apps/worker typecheck: Done
packages/shared typecheck: Done
packages/i18n typecheck$ tsc --noEmit -p tsconfig.json
packages/i18n typecheck: Done
apps/admin typecheck$ tsc --noEmit -p tsconfig.json
apps/api typecheck$ tsc --noEmit -p tsconfig.json
apps/kiosk typecheck$ tsc --noEmit -p tsconfig.json
apps/web typecheck$ tsc --noEmit -p tsconfig.json
apps/kiosk typecheck: Done
apps/web typecheck: Done
apps/admin typecheck: Done
apps/api typecheck: Done

> xplor@ test D:\DARDEV\local\xplor_smit
> vitest run

 Test Files  53 passed (53)
      Tests  411 passed (411)

> xplor@ test:int D:\DARDEV\local\xplor_smit
> pnpm --filter @xplor/api test:int

 Test Files  10 passed (10)
      Tests  54 passed (54)
```


Réalisé (30/09/2026, Node 22.23.3) : correction de revue M1 API-25 (écrans villes et catégories). Le poids d'une catégorie reste une chaîne ; `Number()` n'est appliqué qu'à l'envoi, et une chaîne vide est laissée telle quelle pour que `CategoryCreateSchema` refuse `1.5` et `''` (`catalog.errors.invalidForm`). L'indicateur de traduction manquante est un élément distinct, écarté par `margin-inline-start`. Les tests de création attendent un POST 201 avec un UUID v7, l'absence du message générique et un second GET. `window.confirm` est espionné puis restauré. Un test par page vérifie le repli français et « Missing translation » quand `en` est absent (langue d'interface `en`, clé `xplor.lang`, car le shell réapplique la langue au montage). `pnpm lint`, `pnpm typecheck` et `pnpm test` (402 tests) sont verts. Aucun paquet ajouté. Aucun commit (orchestrateur).

```text
NODE v22.23.3

> xplor@ lint D:\DARDEV\local\xplor_smit
> eslint .


> xplor@ typecheck D:\DARDEV\local\xplor_smit
> tsc --noEmit -p tsconfig.json && pnpm -r typecheck

Scope: 7 of 8 workspace projects
apps/worker typecheck$ tsc --noEmit -p tsconfig.json
packages/shared typecheck$ tsc --noEmit -p tsconfig.json
apps/worker typecheck: Done
packages/shared typecheck: Done
packages/i18n typecheck$ tsc --noEmit -p tsconfig.json
packages/i18n typecheck: Done
apps/kiosk typecheck$ tsc --noEmit -p tsconfig.json
apps/api typecheck$ tsc --noEmit -p tsconfig.json
apps/admin typecheck$ tsc --noEmit -p tsconfig.json
apps/web typecheck$ tsc --noEmit -p tsconfig.json
apps/kiosk typecheck: Done
apps/web typecheck: Done
apps/admin typecheck: Done
apps/api typecheck: Done

> xplor@ test D:\DARDEV\local\xplor_smit
> vitest run

 DEPRECATED  The workspace file is deprecated and will be removed in the next major. Please, use the `test.projects` field in D:/DARDEV/local/xplor_smit/vitest.config.ts instead.

 RUN  v3.2.7 D:/DARDEV/local/xplor_smit

 ✓ |@xplor/shared| src/catalog.test.ts (72 tests) 55ms
 ✓ |@xplor/api| src/openapi/registry.test.ts (4 tests) 210ms
 ✓ |@xplor/api| src/catalog/hotspots.service.test.ts (17 tests) 36ms
 ✓ |@xplor/api| src/auth/password.service.test.ts (6 tests) 158ms
 ✓ |@xplor/api| src/catalog/scenes.service.test.ts (10 tests) 25ms
 ✓ |@xplor/api| src/catalog/tours.service.test.ts (8 tests) 26ms
[Nest] 12868  - 30/09/2026 01:26:33    WARN [AuthService] Envoi de réinitialisation interrompu
 ✓ |@xplor/api| src/auth/auth.service.test.ts (26 tests) 35ms
 ✓ |@xplor/api| src/catalog/tour-publication.service.test.ts (11 tests) 22ms
 ✓ |@xplor/api| src/config/env.test.ts (4 tests) 16ms
 ✓ |@xplor/api| src/auth/auth.controller.test.ts (16 tests) 20ms
 ✓ |@xplor/api| src/seed/seed-tours.test.ts (2 tests) 18ms
 ✓ |@xplor/api| src/users/invitation.test.ts (8 tests) 27ms
 ✓ |@xplor/shared| src/auth.test.ts (14 tests) 14ms
 ✓ |@xplor/worker| src/env.test.ts (2 tests) 10ms
 ✓ |@xplor/api| src/auth/session-store.test.ts (6 tests) 11ms
 ✓ |@xplor/api| src/seed/seed-catalog.test.ts (2 tests) 11ms
 ✓ |@xplor/shared| src/localized-text.test.ts (6 tests) 13ms
 ✓ |@xplor/api| src/catalog/cities.service.test.ts (8 tests) 14ms
 ✓ |@xplor/api| src/app.module.test.ts (1 test) 94ms
 ✓ |@xplor/api| src/catalog/catalog-http.test.ts (14 tests) 15ms
 ✓ |@xplor/api| src/catalog/categories.service.test.ts (6 tests) 14ms
 ✓ |@xplor/api| src/health/health.service.test.ts (3 tests) 7ms
 ✓ |@xplor/api| src/catalog/publication-rules.test.ts (25 tests) 10ms
 ✓ |@xplor/api| src/auth/user-token.test.ts (6 tests) 8ms
 ✓ |@xplor/api| src/catalog/assets.service.test.ts (4 tests) 13ms
 ✓ |@xplor/api| src/auth/access-policy.test.ts (14 tests) 9ms
 ✓ |@xplor/i18n| src/keys.test.ts (4 tests) 7ms
 ✓ |@xplor/admin| src/router.test.ts (4 tests) 6ms
 ✓ |@xplor/worker| src/main.test.ts (2 tests) 6ms
 ✓ |@xplor/api| src/auth/lockout.test.ts (4 tests) 5ms
 ✓ |@xplor/api| src/catalog/tour-duplicate.test.ts (5 tests) 6ms
 ✓ |@xplor/api| src/mail/render-mail.test.ts (2 tests) 5ms
 ✓ |@xplor/api| src/auth/prisma-user.repository.test.ts (8 tests) 10ms
 ✓ |@xplor/admin| src/lang.test.ts (1 test) 5ms
 ✓ |@xplor/api| src/auth/user-token.repository.test.ts (6 tests) 12ms
 ✓ |@xplor/api| src/auth/session.guard.test.ts (10 tests) 10ms
 ✓ |@xplor/admin| src/api/client.test.ts (11 tests) 33ms
 ✓ |@xplor/api| src/seed/seed-users.test.ts (4 tests) 7ms
 ✓ |@xplor/api| src/mail/fake-mailer.test.ts (1 test) 4ms
 ✓ |@xplor/shared| src/password.test.ts (1 test) 4ms
 ✓ |@xplor/api| src/prisma/role.test.ts (1 test) 4ms
 ✓ |@xplor/api| src/auth/unit-of-work.test.ts (2 tests) 4ms
 ✓ |@xplor/api| src/auth/prisma-user.lookup.test.ts (2 tests) 4ms
 ✓ |@xplor/api| src/mail/smtp-mailer.test.ts (1 test) 3ms
 ✓ |@xplor/admin| src/catalog/LocalizedTextField.test.tsx (4 tests) 367ms
 ✓ |@xplor/admin| src/App.test.tsx (3 tests) 374ms
 ✓ |@xplor/admin| src/auth/account-access.test.tsx (8 tests) 548ms
   ✓ réinitialisation et invitation > l’envoi de forgot affiche toujours le même message de confirmation  309ms
 ✓ |@xplor/admin| src/pages/CitiesPage.test.tsx (5 tests) 556ms
 ✓ |@xplor/admin| src/session.test.tsx (8 tests) 588ms
 ✓ |@xplor/admin| src/pages/CategoriesPage.test.tsx (6 tests) 632ms
 ✓ |@xplor/kiosk| src/mount.test.ts (2 tests) 4ms
 ✓ |@xplor/web| src/mount.test.ts (2 tests) 5ms

 Test Files  52 passed (52)
      Tests  402 passed (402)
   Start at  01:26:31
   Duration  5.80s (transform 3.19s, setup 0ms, collect 36.20s, tests 4.10s, environment 33.82s, prepare 10.80s)
```

Réalisé (30/09/2026, Node 22) : M1 API-25 (CRUD des villes et des catégories, front). Implémentation des pages back-office `CitiesPage` et `CategoriesPage` (`apps/admin/src/pages`). Affichage des données avec texte de chargement (`common.loading`) et avertissement texte lisible pour les traductions manquantes (`catalog.translation.missing`) en gérant correctement le code langue principal. Formulaires complets basés sur `LocalizedTextField` et validation Zod front-end. Suppression avec confirmation et traduction native de l'erreur 409 IN_USE (`ApiError` gérant `error.code`). Gestion des erreurs via alertes locales aux pages. Accès en écriture (boutons) restreint aux rôles ADMIN et EDITOR via `useAuth()`. Traductions ajoutées dans `@xplor/i18n` (fr, ar, en). Les tests Vitest (`CitiesPage.test.tsx` et `CategoriesPage.test.tsx`) valident le rendu, l'envoi correct des corps HTTP, la traduction du 409 sur la base du format `{ error: { code, message } }` et l'inaccessibilité des boutons pour le rôle PARTNER. `pnpm lint`, `pnpm typecheck` et `pnpm test` (399 tests) sont verts. Aucun paquet ajouté. Aucun commit (orchestrateur).

```text
NODE v22.23.3

> xplor@ lint D:\DARDEV\local\xplor_smit
> eslint .

> xplor@ typecheck D:\DARDEV\local\xplor_smit
> tsc --noEmit -p tsconfig.json && pnpm -r typecheck

Scope: 7 of 8 workspace projects
apps/worker typecheck$ tsc --noEmit -p tsconfig.json
packages/shared typecheck$ tsc --noEmit -p tsconfig.json
apps/worker typecheck: Done
packages/shared typecheck: Done
packages/i18n typecheck$ tsc --noEmit -p tsconfig.json
packages/i18n typecheck: Done
apps/api typecheck$ tsc --noEmit -p tsconfig.json
apps/admin typecheck$ tsc --noEmit -p tsconfig.json
apps/kiosk typecheck$ tsc --noEmit -p tsconfig.json
apps/web typecheck$ tsc --noEmit -p tsconfig.json
apps/web typecheck: Done
apps/kiosk typecheck: Done
apps/admin typecheck: Done
apps/api typecheck: Done

> xplor@ test D:\DARDEV\local\xplor_smit
> vitest run

 DEPRECATED  The workspace file is deprecated and will be removed in the next major. Please, use the `test.projects` field in D:/DARDEV/local/xplor_smit/vitest.config.ts instead.

 RUN  v3.2.7 D:/DARDEV/local/xplor_smit

 ✓  @xplor/shared  src/catalog.test.ts (72 tests) 89ms
 ✓  @xplor/api  src/catalog/scenes.service.test.ts (10 tests) 40ms
 ✓  @xplor/api  src/catalog/tours.service.test.ts (8 tests) 163ms
 ✓  @xplor/api  src/catalog/tour-publication.service.test.ts (11 tests) 21ms
 ✓  @xplor/api  src/auth/password.service.test.ts (6 tests) 325ms
 ✓  @xplor/api  src/catalog/hotspots.service.test.ts (17 tests) 35ms
 ✓  @xplor/api  src/openapi/registry.test.ts (4 tests) 545ms
 ✓  @xplor/api  src/seed/seed-tours.test.ts (2 tests) 20ms
[Nest] 20348  - 30/09/2026 01:16:41    WARN [AuthService] Envoi de réinitialisation interrompu
 ✓  @xplor/api  src/auth/auth.service.test.ts (26 tests) 40ms
 ✓  @xplor/api  src/config/env.test.ts (4 tests) 11ms
 ✓  @xplor/shared  src/auth.test.ts (14 tests) 14ms
 ✓  @xplor/api  src/users/invitation.test.ts (8 tests) 48ms
 ✓  @xplor/api  src/catalog/catalog-http.test.ts (14 tests) 16ms
 ✓  @xplor/api  src/auth/session-store.test.ts (6 tests) 12ms
 ✓  @xplor/api  src/catalog/cities.service.test.ts (8 tests) 16ms
 ✓  @xplor/api  src/auth/auth.controller.test.ts (16 tests) 36ms
 ✓  @xplor/api  src/catalog/assets.service.test.ts (4 tests) 12ms
 ✓  @xplor/api  src/catalog/categories.service.test.ts (6 tests) 13ms
 ✓  @xplor/shared  src/localized-text.test.ts (6 tests) 10ms
 ✓  @xplor/admin  src/router.test.ts (4 tests) 6ms
 ✓  @xplor/admin  src/lang.test.ts (1 test) 4ms
 ✓  @xplor/admin  src/api/client.test.ts (11 tests) 63ms
 ✓  @xplor/api  src/seed/seed-catalog.test.ts (2 tests) 11ms
 ✓  @xplor/api  src/app.module.test.ts (1 test) 378ms
 ✓  @xplor/api  src/catalog/publication-rules.test.ts (25 tests) 10ms
 ✓  @xplor/admin  src/App.test.tsx (3 tests) 528ms
 ✓  @xplor/admin  src/pages/CitiesPage.test.tsx (4 tests) 771ms
 ✓  @xplor/api  src/auth/user-token.test.ts (6 tests) 9ms
 ✓  @xplor/admin  src/pages/CategoriesPage.test.tsx (4 tests) 800ms
 ✓  @xplor/api  src/auth/session.guard.test.ts (10 tests) 12ms
 ✓  @xplor/admin  src/auth/account-access.test.tsx (8 tests) 862ms
 ✓  @xplor/admin  src/catalog/LocalizedTextField.test.tsx (4 tests) 585ms
 ✓  @xplor/admin  src/session.test.tsx (8 tests) 908ms
 ✓  @xplor/api  src/auth/access-policy.test.ts (14 tests) 8ms
 ✓  @xplor/api  src/auth/user-token.repository.test.ts (6 tests) 12ms
 ✓  @xplor/api  src/auth/prisma-user.repository.test.ts (8 tests) 10ms
 ✓  @xplor/api  src/health/health.service.test.ts (3 tests) 8ms
 ✓  @xplor/api  src/seed/seed-users.test.ts (4 tests) 8ms
 ✓  @xplor/worker  src/env.test.ts (2 tests) 7ms
 ✓  @xplor/api  src/auth/lockout.test.ts (4 tests) 6ms
 ✓  @xplor/worker  src/main.test.ts (2 tests) 6ms
 ✓  @xplor/api  src/catalog/tour-duplicate.test.ts (5 tests) 6ms
 ✓  @xplor/api  src/mail/render-mail.test.ts (2 tests) 4ms
 ✓  @xplor/api  src/mail/fake-mailer.test.ts (1 test) 4ms
 ✓  @xplor/i18n  src/keys.test.ts (4 tests) 7ms
 ✓  @xplor/shared  src/password.test.ts (1 test) 6ms
 ✓  @xplor/api  src/prisma/role.test.ts (1 test) 4ms
 ✓  @xplor/api  src/auth/unit-of-work.test.ts (2 tests) 3ms
 ✓  @xplor/api  src/mail/smtp-mailer.test.ts (1 test) 2ms
 ✓  @xplor/api  src/auth/prisma-user.lookup.test.ts (2 tests) 3ms
 ✓  @xplor/web  src/mount.test.ts (2 tests) 4ms
 ✓  @xplor/kiosk  src/mount.test.ts (2 tests) 4ms

 Test Files  52 passed (52)
      Tests  399 passed (399)
   Duration  11.00s
```

**Exigence précédente :** M1 NF-09 — seed des 3 visites liées.

Plan :

1. Intégrer `seed-tours.ts` dans `prisma/seed.ts`.
2. Vérifier que la création des lignes Asset est correcte (processingStatus READY, originalKey sous seed/). Consigner D-77 pour les fichiers M2.
3. Vérifier que `test/seed.int.test.ts` confirme le nombre exact de visites (3), scènes (8), hotspots (11) et assets (11), sans duplication au second seed.
4. Mettre à jour `docs/PROGRESS.md` (critère 7) et exécuter la validation (`lint`, `typecheck`, `test:int`, `db:seed`).

Réalisé (30/09/2026, Node 22.23.3) : M1 NF-09 (seed des 3 visites liées). `seed-tours.ts` a été intégré dans `prisma/seed.ts`. Le seed crée 3 visites publiées (Kasbah des Oudayas, Jardin de Salé, Plage de Mehdia) reliées par des SCENE_LINK et TOUR_LINK distincts. La création est idempotente (UUID v7 fixes). La validation des visites est assurée par `validateTour` dans `seed-tours.test.ts`. Les 11 assets générés (3 images, 8 panoramas) ont un `processingStatus` READY, une `originalKey` commençant par `seed/` et un `contentHash` fixe ; les fichiers physiques viendront avec M2 (D-77). `seed.int.test.ts` mis à jour et vert (vérification du `status` PUBLISHED, des 3 `TOUR_LINK` avec `targetTourId` vers une autre visite, et 3 `tourCategory`). `pnpm lint`, `pnpm typecheck` réussis sans erreur. `pnpm test` passe avec 376 tests, `pnpm test:int` avec 54 tests. `pnpm db:seed` a été lancé deux fois avec succès. Aucun commit (orchestrateur).

Réalisé (30/09/2026, Node 22.23.3) : `GET /api/v1/admin/assets` et `GET /api/v1/admin/assets/:id`. `AssetResponseSchema` et `AssetListQuerySchema` dans `@xplor/shared`. Filtre `kind` facultatif, pagination `PaginationQuery`, tri `createdAt` décroissant puis `id` croissant. 404 `ASSET_NOT_FOUND`. Garde `SessionGuard`, `CsrfGuard`, `canManageContent`. Pas d’upload ni de suppression (API-24, M2). D-76. OpenAPI régénéré. `pnpm lint` et `pnpm typecheck` verts. `pnpm test` : 374. `pnpm test:int` : 54, dont 3 dans `assets.int.test.ts`. Couverture de `catalog.ts` : 100 % (93 tests du paquet `@xplor/shared`). Aucun commit (orchestrateur).

Réalisé (30/09/2026, Node 22) : M1 F-01 (extension du routeur et navigation admin). `apps/admin/src/router.ts` étendu avec les routes `home` (/), `cities` (/cities), `categories` (/categories), `tours` (/tours), `tour-new` (/tours/new) et `tour-detail` (/tours/:id). L'ID est décodé via `decodeSegment`. Les chemins inconnus ou les ID vides renvoient sur `home`. `App.tsx` affiche désormais une barre de navigation (`<nav>`) conditionnée à une session authentifiée, avec les liens Visites, Villes et Catégories. `aria-current="page"` est posé sur le lien actif. Le clic déclenche `navigate()` (history pushState). Si la route requiert une authentification mais que la session est anonyme, `LoginPage` s'affiche. Sinon, des composants de page vides avec des `<h2>` traduits s'affichent. Clés `nav.*` et `page.*` ajoutées dans `fr/ar/en.json` (packages/i18n). CSS logique utilisé. Tests Vitest `router.test.ts` ajoutés pour valider `parsePathname`. `pnpm lint`, `pnpm typecheck`, `pnpm test` (390 tests) et `pnpm test:e2e` réussis. Aucun commit (orchestrateur).

Réalisé (30/09/2026, Node 22) : M1 F-01 (`requestJson` et `catalog.ts`). Corrections apportées suite à la revue : `requestJson` accepte désormais un `schema: ZodType<T>` ou `null` avec des surcharges (overloads) TypeScript pour retourner `Promise<T>` ou `Promise<void>` (undefined sur 204). L'utilisation des types de création et de mise à jour (`CityCreate`, `TourUpdate`, etc.) a été appliquée dans `catalog.ts` pour éviter `data: unknown`. `CityListResponseSchema` et `CategoryListResponseSchema` ont été ajoutés dans `@xplor/shared` et sont utilisés pour typer correctement les listes non paginées. Les tests dans `client.test.ts` (Vitest) utilisent de vrais schémas Zod avec un mock global de fetch. En-tête X-CSRF-Token présent sur POST et absent sur GET. Aucun paquet npm ajouté (`z` et `ZodType` sont exportés par `@xplor/shared`). Les contrôles `pnpm lint`, `pnpm typecheck` et `pnpm test` (382 tests) passent avec succès. Aucun commit (orchestrateur).
Réalisé (30/09/2026, Node 24.5.0) : `POST /api/v1/admin/tours/:id/duplicate` répond 201 `TourResponse`. Une transaction crée un brouillon, `publicShare` false, un nouveau `shareToken`, le titre français suffixé de ` (copie)`, les mêmes catégories, les scènes non supprimées (même `weight`) et leurs hotspots. `remapDuplicateLinks` remappe `startSceneId` et les `targetSceneId` des `SCENE_LINK` ; une cible non copiée devient `null`. Les `TOUR_LINK` gardent leur visite cible. `createdById` = session. 404 `TOUR_NOT_FOUND` si la visite est absente ou supprimée. D-75. OpenAPI régénéré. `pnpm lint` et `pnpm typecheck` verts. `pnpm test` : 361. `pnpm test:int` : 51, dont 4 dans `tours-duplicate.int.test.ts`. Aucun commit (orchestrateur).

Réalisé (30/09/2026, Node 22.23.3) : `POST /api/v1/admin/tours/:id/publish` et `POST .../unpublish`. Une visite non publiable répond 422 `TOUR_NOT_PUBLISHABLE` avec `issues`, sans écriture. Sinon : `PUBLISHED`, `publishedAt` = maintenant, `contentVersion` +1, 200 `TourResponse`. La dépublication repasse en `DRAFT`, conserve `publishedAt` et incrémente `contentVersion`. `status` était déjà sur `TourResponseSchema` (D-71). D-74 complétée. OpenAPI régénéré. `pnpm lint` et `pnpm typecheck` verts. `pnpm test` : 356. `pnpm test:int` : 47, dont 6 dans `tours-publication.int.test.ts`. Aucun commit (orchestrateur).

Réalisé (29/09/2026, Node 22.23.3) : `POST /api/v1/admin/tours/:id/validate`. `TourPublicationService` charge l’instantané Prisma et appelle `validateTour` sans la modifier. 200 `{ issues }` (`TourValidationResponseSchema`), liste vide si la visite est publiable. 404 `TOUR_NOT_FOUND` si elle est absente ou supprimée. `contentVersion` inchangé. D-74. OpenAPI régénéré. `pnpm lint`, `pnpm typecheck` et `pnpm test` (351) verts. `pnpm test:int` vert (45, dont 4 dans `tours-publication.int.test.ts`). Aucun commit (orchestrateur).

Le schéma 5.6 à 5.8 et API-25 sont dans la section « Fait ».

## Definition of Done — M1

Cahier des charges, section 10. Definition of Done du jalon : **non remplie**.

| #   | Critère                                                                                                                                                                                               | État    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Toutes les exigences du jalon implémentées et leurs CA vérifiés.                                                                                                                                      | à faire |
| 2   | Tests automatisés ajoutés et verts en CI (Vitest unitaires + intégration API, Playwright pour les parcours principaux).                                                                               | à faire |
| 3   | `pnpm lint`, `pnpm typecheck` sans erreur.                                                                                                                                                            | à faire |
| 4   | Migrations Prisma créées et appliquées sur une base vierge sans erreur ; seed à jour.                                                                                                                 | à faire |
| 5   | Chaînes d'interface dans les 3 langues ; vérification visuelle en arabe (RTL).                                                                                                                        | à faire |
| 6   | `docs/PROGRESS.md` mis à jour (fait / reste / risques) ; `docs/DECISIONS.md` complété ; OpenAPI à jour si l'API a changé.                                                                             | à faire |
| 7   | Données de démonstration : `pnpm db:seed` crée 3 visites liées entre elles, 1 hôtel, 1 kiosque et un utilisateur par rôle (panoramas d'exemple libres de droits dans `apps/api/prisma/seed-assets/`). | Partiel (renvoi à D-77 : les panoramas sont absents du dépôt et aucun fichier n'est déposé) |
| 8   | Démo au porteur effectuée et retours consignés.                                                                                                                                                       | à faire |

## Tableau

### Fait

- **F-01** (schémas Zod et modèle Prisma 5.1 à 5.5) : `localizedText({ max })`, enums de contenu, schémas City, Category, Tour, Scene, `HotspotCreate` (`url` en `z.httpUrl()`, http/https seulement), `PaginationQuery` et `paginated` dans `@xplor/shared` (`src/catalog.ts`, tests `src/catalog.test.ts`). `TourResponse`, `PaginatedTourResponse` et `TourListQuery` complètent le contrat de liste (D-71). `HotspotUpdate` et `HotspotResponse` complètent le contrat hotspot (D-73). `Paginated<T>` est inféré du schéma. Couverture de `catalog.ts` : 100 % (93 tests du paquet, dont `AssetResponseSchema`, D-76). Schéma Prisma : `City`, `Category`, `Asset` (minimal, D-65), `Tour`, `TourCategory`, `Scene`, `Hotspot`, migration `20260929172452_content_model` (D-67). Le CRUD des visites est en place (API-21, partie 1). La duplication est en place (D-75). L'écran de liste `/tours` est en place (filtres d'URL, pagination, duplication). Les formulaires `/tours/new` et `/tours/:id` sont en place (F-01) : création, édition, suppression, validation Zod, rôles ADMIN et EDITOR. Une erreur d’enregistrement ou de suppression laisse le formulaire monté (D-81). Le détail du socle M0 est dans la section repliée « Jalons terminés — M0 ».
- **API-21, partie 1** (CRUD des visites, D-71) : `GET` / `POST` / `PATCH` / `DELETE` sur `/api/v1/admin/tours`. Liste paginée (`status`, `cityId`, `categoryId`, `q` sur le titre fr), détail avec `categoryIds` et `sceneCount`. Création en `DRAFT` (D-26), `publicShare` false (D-05), `shareToken` émis par le service, `createdById` = session. Suppression logique. 422 si la ville, une catégorie ou la vignette est inconnue. ADMIN et EDITOR seulement. OpenAPI à jour. `publish` et `unpublish` sont livrés avec F-03 (D-74). `duplicate` est livré avec F-01 (D-75). Hors de ce lot : share-token, qr.svg, graph, preview-token. Pas d'écran admin.
- **API-22, partie 1** (CRUD des scènes, D-72) : `GET` / `POST` `/api/v1/admin/tours/:tourId/scenes`, `GET` / `PATCH` / `DELETE` `/api/v1/admin/scenes/:id`. Liste des scènes non supprimées, tri `weight` puis `createdAt`. La première scène devient `startSceneId` ; la suppression de la scène de départ le remet à null, dans la même transaction. `createdById` = session. `contentVersion` de la visite +1. 404 `TOUR_NOT_FOUND` ou `SCENE_NOT_FOUND`, 422 `PANORAMA_ASSET_NOT_FOUND`, format `{ error: { code, message } }`. ADMIN et EDITOR (`canManageContent`). `SceneResponseSchema` dans `@xplor/shared`. OpenAPI à jour. Pas d'écran admin.
- **API-22, partie 2** (réordonnancement et scène de départ, D-72) : `POST /api/v1/admin/tours/:tourId/scenes/reorder` (`SceneReorderRequestSchema`) et `POST .../scenes/set-start` (`SetStartSceneRequestSchema`). Liste incomplète, doublon ou scène hors de l’ensemble → 422 `SCENE_SET_MISMATCH`, sans écriture. `weight` = index. Scène inconnue, supprimée ou d’une autre visite → 422 `START_SCENE_FOREIGN`. Succès : 200, liste triée ou `TourResponse`. `contentVersion` +1. Même contrôle d’accès. OpenAPI à jour. Pas d'écran admin.
- **F-03** (règles de publication, D-68, D-74) : `validateTour` dans `apps/api/src/catalog/publication-rules.ts` (25 tests, dont « Visite manuelle »), fonction pure, couverture 100 %. `POST /api/v1/admin/tours/:id/validate` répond 200 `{ issues: ValidationIssue[] }` via `TourPublicationService` : visite, scènes (y compris supprimées) avec `processingStatus` du panorama, hotspots, et `findTargetTour` préchargé. Liste vide si la visite est publiable. Cette route ne publie pas et ne change pas `contentVersion`. `TourValidationResponseSchema` est dans `@xplor/shared`. 404 `TOUR_NOT_FOUND` si la visite est absente ou supprimée. `POST .../publish` : si `issues` n’est pas vide, 422 `{ error: { code: "TOUR_NOT_PUBLISHABLE", message, issues } }` sans écriture ; sinon, dans la même transaction, `status` PUBLISHED, `publishedAt` = maintenant, `contentVersion` +1, puis 200 `TourResponse`. `POST .../unpublish` : `status` DRAFT, `publishedAt` conservé, `contentVersion` +1, 200 `TourResponse`. `status` est déjà sur `TourResponseSchema` (D-71). ADMIN et EDITOR (`canManageContent`). OpenAPI à jour. L’affichage des problèmes dans l’admin reste à faire.
- **API-25** (CRUD villes et catégories) : `GET` / `POST` / `PATCH` / `DELETE` sur `/api/v1/admin/cities` et `/api/v1/admin/categories`. Lecture pour toute session ; écriture ADMIN et EDITOR (`canManageCatalog`). 409 `IN_USE` au format du cahier. Seed fr/ar/en. OpenAPI à jour. Écrans `/cities` et `/categories` : liste avec repli `localize`, formulaire `LocalizedTextField`, validation Zod, confirmation de suppression, 409 traduit (D-69).
- **Schéma 5.6 à 5.8** (D-66, D-70) : `Hotel`, `Selection`, `SelectionItem`, `Kiosk`, `UserHotel`, migration `20260929183235_hotels_kiosks`. Seed : 1 hôtel à Rabat (FIVE, RENTAL, fr/ar/en, sans PIN), sélection vide, kiosque « Hall principal » PENDING, `UserHotel` pour `manager@xplor.local`. CRUD et écrans restent en M5. La session ne charge pas encore `hotelIds`.
- **API-23, partie 1** (contrats, D-73) : `HotspotUpdateSchema` et `HotspotResponseSchema` dans `@xplor/shared`, types `z.infer` exportés par `index.ts`. Tests : une réponse valide par type, type inconnu refusé, URL non http/https refusée à la mise à jour. Pas de route, pas d’OpenAPI, pas d’écran.
- **API-23, partie 2** (liste et création, D-73) : `GET` et `POST` `/api/v1/admin/scenes/:sceneId/hotspots`. Liste triée par `createdAt` croissant. Création 201 `HotspotResponseSchema`, `createdById` = session, `contentVersion` de la visite +1. 404 `SCENE_NOT_FOUND` si la scène parente est absente ou supprimée. 422 `{ error: { code, message } }` via `assertTargets` (réutilisable par PATCH) : `SCENE_LINK_TARGET_MISSING`, `SCENE_LINK_SELF`, `SCENE_LINK_FOREIGN`, `TOUR_LINK_TARGET_MISSING`, `TOUR_LINK_SELF`, `TOUR_LINK_SCENE_FOREIGN` (une cible `DRAFT` reste acceptée), `MEDIA_ASSET_NOT_FOUND`. ADMIN et EDITOR (`canManageContent`). OpenAPI à jour.
- **API-23, partie 3** (modification et suppression, D-73) : `PATCH` et `DELETE` `/api/v1/admin/hotspots/:id`. Remplacement complet (`HotspotUpdateSchema`) ; si le type change, les champs des autres types passent à `null` ou `[]` dans la même écriture. Suppression physique, 204. 404 `HOTSPOT_NOT_FOUND` si le hotspot est inconnu ou si la scène parente est supprimée. `contentVersion` +1 dans la même transaction. Mêmes 422 via `assertTargets`. ADMIN et EDITOR. OpenAPI à jour. Pas d’écran admin.
- **F-05** (liste des médias, lecture seule, D-76, D-80) : API en place (`GET /api/v1/admin/assets` et `:id`). `AssetResponseSchema` exporté. Côté back-office, `listAssets` et `getAsset` ajoutés dans `api/catalog.ts`. Composant React contrôlé `AssetPicker` créé : `<select>` filtré par `kind`, affichant l'ID court, le type MIME, les dimensions et le statut de traitement (traduits). Les états de chargement (`common.loading`), erreur et liste vide sont gérés via les clés `catalog.asset.*` (fr, ar, en). Tests Vitest (`AssetPicker.test.tsx`) verts sous jsdom. L'upload, le retraitement et la suppression restent prévus en M2 (API-24). Pas d'écran admin dédié pour le CRUD des médias dans ce jalon, seul le sélecteur est fourni pour le formulaire de visite.

- **NF-09** (seed des 3 visites liées) : `seed-tours.ts` intégré à `prisma/seed.ts`. 3 visites publiées créées, valides (`validateTour`), idempotence via UUID v7. Couvert par `seed.int.test.ts`.
- **F-04** (onglets de traduction, D-79) : composant contrôlé `LocalizedTextField` (`apps/admin/src/catalog/`). Un champ visible, onglets fr/ar/en, `dir="rtl"` sur l'arabe, indicateur « Traduction manquante », français obligatoire quel que soit l'onglet actif. La liste des visites signale une traduction manquante (`catalog.translation.missing`) quand la langue active, autre que le français, est absente du titre.

### En cours

- Reste du jalon M1 : API-21 au-delà du CRUD et de la duplication (share-token, qr.svg, graph, preview-token), écran admin des hotspots, médiathèque et affichage des problèmes de publication (la liste `/tours`, les formulaires `/tours/new` et `/tours/:id`, les villes et les catégories sont en place), F-02 (sans traitement). F-04 : le composant `LocalizedTextField` est en place (D-79) ; la liste des visites signale une traduction manquante. F-01 : le formulaire de visite est en place (D-81) ; liste, CRUD, réordonnancement et scène de départ des scènes sont en place ; l'écran admin des scènes est en place (API-22) ; CRUD des hotspots en place ; publication et dépublication des visites aussi (D-74) ; la duplication aussi (D-75). La dépublication n’a pas encore d’écran. F-03 : `validate`, `publish` (422 `TOUR_NOT_PUBLISHABLE`) et `unpublish` sont en place ; l’affichage des problèmes dans l’admin reste à faire. F-05 : la lecture des médias est en place (D-76) ; l’upload, le retraitement et la suppression restent API-24 en M2. Le schéma 5.6 à 5.8 est en place ; le CRUD hôtel et kiosque reste en M5 (D-66).

### Bloqué

Aucun.

### Risques

- `VirtualizationFirmwareEnabled` vaut False, mais le moteur répond (Server Docker Desktop 4.93.0, WSL 2 `docker-desktop`).
- Le Node par défaut du poste n'est pas la 22 (24 et 25 sont installés ; la 22.23.3 est disponible via nvm).
- ESLint 9 et `vitest.workspace.ts` sont dépréciés en amont, exigés par NF-08.
- Quatre avis moderate restent sous le seuil CI : Vitest 3.2.7 et `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, correctif en 4.1.11 ; D-29 maintient Vitest 3) et fastify 5.11.3 (GHSA-w2qp-rph6-63g4, GHSA-3m5p-2c4r-xxw2, correctif en 5.12.1 ; D-39 épingle 5.11.3).
- Les ports 5174 et 5175 ont été libérés le 29/09/2026 (processus orphelins 20972, 5156 et 5672 ; `taskkill` refusait, `Win32_Process.Terminate` a réussi). `pnpm dev` (Node 22.23.3) est relancé : API, back-office, web, kiosque et worker répondent.
- Le sélecteur de langue, l'invitation et les autres écrans de la démo M0 ont été validés visuellement par le porteur le 29/09/2026 (`docs/DEMO_M0.md`). Les tests automatisés restent Vitest (jsdom) ou Playwright avec `/api` simulé : les scénarios back-office ne démarrent pas l'API.
- Prisma 6 avertit que `package.json#prisma` (dont `prisma.seed`) est déprécié au profit de `prisma.config.ts` en Prisma 7 ; D-34 et D-41 conservent Prisma 6 et ce champ.
- `.gitattributes` ne force LF au checkout de `docs/openapi.json` qu'une fois `git add --renormalize .` indexé par l'orchestrateur (critère 9).
- Décisions encore à valider : voir `docs/DECISIONS.md` (D-37, D-38, D-39, D-40, D-44, D-45, D-46, D-47, D-48, D-49, D-51, D-54, D-55, D-61, D-63, D-64, D-65, D-66, D-67, D-68, D-69, D-70, D-71, D-72, D-73, D-74, D-75, D-76). D-62 : question de validation sans objet pour les critères 1, 7 et 10.

<details>
<summary>Jalons terminés — M0</summary>

**M0 — Socle** (S1–S2). Exigences du jalon : NF-06, NF-08, NF-09, F-90 (sans 2FA). Definition of Done du jalon : **remplie**.

## Definition of Done — M0

Cahier des charges, section 9 (livrable) et section 10 (liste commune). Definition of Done du jalon : **remplie**.

| #   | Critère                                                                                                          | État                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Environnement complet en 4 commandes (`docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`) | Prouvé en local (29/09/2026, Node 22.23.3) et en CI (run `36580207347`). `docker version` affiche une section Server (Docker Desktop 4.93.0, moteur 29.8.1, linux/amd64). `docker compose up -d` : postgres, redis, minio et mailpit `healthy` ; `minio-init` `Exited (0)`. `pnpm db:migrate` : « Already in sync ». `pnpm db:seed` deux fois : « 4 utilisateurs de démonstration prêts. » `.env` et `apps/api/.env` existaient déjà. `pnpm install` non rejoué (workspace déjà installé ; `pnpm test:int` vert, 9 tests). L'étape « API smoke » du run CI reste une preuve distincte (`GET /api/health` 200). |
| 2   | Connexion au back-office                                                                                         | Prouvé en local (29/09/2026, Node 22.23.3) et en CI (run `36580207347`, D-62). `scripts/ci-api-smoke.mjs` sort en 0 sur `http://localhost:3000` et sur le proxy `http://localhost:5173` : `GET /api/health` 200 (`db`, `redis`, `storage` à `ok`), `GET /api/v1/openapi.json` 200, `POST /api/v1/auth/login` 200 avec le cookie `xplor_sid`, `GET /api/v1/auth/me` 200. `POST /api/v1/auth/password/forgot` via le proxy : 202. Le clic dans le navigateur a été validé par le porteur le 29/09/2026 (`docs/DEMO_M0.md`).                                                                                      |
| 3   | CI verte                                                                                                         | Rempli sur le run `36580207347` (push `develop`, commit `1eaf986`, 29/09/2026 14:06 UTC, https://github.com/sayoung/DARDEV-/actions/runs/36580207347), job `ci` `109446061994` : succès. Lint, typecheck, test:int (9), API smoke, e2e (7), unitaires (188), audit (4 avis moderate). Artefact `playwright-results` `11039602501`. Le run `36568794014` échouait au pull `minio/minio` ; D-61 est dans ce run.                                                                                                                                                                                                 |
| 4   | Exigences du jalon implémentées, critères d'acceptation vérifiés (NF-06, NF-08, NF-09, F-90 sans 2FA)            | Code du socle en place, y compris `docs/DEMO_M0.md` (parcours local principal, repli D-62). Scénarios Playwright du back-office verts avec `/api` simulé (D-55). Critères 1, 2, 7 et 10 : preuve locale obtenue (29/09/2026). Le clic de connexion dans le navigateur a été validé par le porteur le 29/09/2026. CI : critère 3 rempli sur le run `36580207347`. Démo validée par le porteur le 29/09/2026 (critères 8 et 11).                                                                                                                                                                                 |
| 5   | Tests verts en CI : Vitest unitaire, intégration API, Playwright                                                 | Run `36580207347` (https://github.com/sayoung/DARDEV-/actions/runs/36580207347) : lint vert, typecheck vert, test:int vert (9 tests : `auth.int.test.ts` 7, `seed.int.test.ts` 1, `migrations.int.test.ts` 1), unitaires verts (188 tests, 35 fichiers), e2e vert (7), audit vert (4 avis moderate sous le seuil). API smoke vert (`GET /api/health`, `GET /api/v1/openapi.json`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`). Artefact `playwright-results` `11039602501`.                                                                                                                              |
| 6   | `pnpm lint` et `pnpm typecheck` sans erreur                                                                      | Verts (Node 22.23.3), y compris `playwright.config.ts`, `e2e/`, `apps/api/src/app.module.test.ts` (D-57), `scripts/ci-api-smoke.mjs` (D-59) et l'override `deepmerge-ts` 8.0.2 (D-60).                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Migrations Prisma appliquées sur une base vierge ; seed à jour                                                   | Prouvé en local et en CI (run `36580207347`). `pnpm db:migrate` (Node 22.23.3, `prisma migrate dev`) sur PostgreSQL 16, base `xplor` : « Already in sync, no schema change or pending migration was found. » Aucune migration `fix_drift`. Fichiers inchangés : `20260929022909_init_users`, `20260929043449_user_tokens`. `pnpm db:seed` deux fois, idempotent. En CI, `db:deploy` puis `db:seed` sur une base vierge en début de job (D-62).                                                                                                                                                                 |
| 8   | Chaînes fr/ar/en ; contrôle visuel arabe (RTL)                                                                   | Chaînes et test de complétude en place. Capture Playwright pleine page `docs/screenshots/login-ar.png` (`?lang=ar`, `lang=ar`, `dir=rtl`), citée dans `docs/DEMO_M0.md`. Le sélecteur de langue est couvert par Vitest (jsdom). Démo validée par le porteur le 29/09/2026 (`docs/DEMO_M0.md`) : bascule en arabe et contrôle visuel RTL de chaque écran (connexion, mot de passe oublié, définition du mot de passe, accueil).                                                                                                                                                                                 |
| 9   | `docs/PROGRESS.md`, `docs/DECISIONS.md`, OpenAPI à jour                                                          | PROGRESS et DECISIONS mis à jour (démo M0 NF-09, D-62 complétée ; parcours local F-90, D-64). DECISIONS : D-58 à D-64. `GET /api/v1/openapi.json` 200 en local le 29/09/2026 (Node 22.23.3) sur `http://localhost:3000` et sur `http://localhost:5173`, et en CI (run `36580207347`, D-49). `.gitattributes` (`docs/openapi.json text eol=lf`) ; `git add --renormalize .` non lancé (orchestrateur). Le test d'identité normalise déjà les CRLF.                                                                                                                                                              |
| 10  | `pnpm db:seed` : 3 visites liées, 1 hôtel, 1 kiosque, un utilisateur par rôle                                    | Utilisateurs prouvés en local : `pnpm db:seed` deux fois (Node 22.23.3), « 4 utilisateurs de démonstration prêts. » `test/seed.int.test.ts` vert. Aussi en CI (run `36580207347`, D-62). Hôtel, kiosque et visites : jalon M1, pas M0.                                                                                                                                                                                                                                                                                                                                                                         |
| 11  | Démo au porteur faite, retours consignés                                                                         | Démo validée par le porteur le 29/09/2026.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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
  - D-62 : preuve locale obtenue le 29/09/2026. La CI (run `36580207347`) reste une preuve complémentaire. La question de validation est sans objet pour les critères 1, 7 et 10. `docs/DEMO_M0.md` : parcours local principal, repli « démo sans Docker local ». Démo validée par le porteur le 29/09/2026.
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

</details>
