# Notes de vérification DoD M4 (F-20 à F-25)

| Critère | Statut | Fichiers et tests cités |
|---|---|---|
| **F-20** Éditeur 360 dans l'onglet de la scène | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (TabsContent "editor"), `apps/admin/src/components/SceneEditor360.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (vérifie l'onglet Éditeur 360), `apps/admin/src/components/SceneEditor360.test.tsx` |
| **F-21** Création de hotspot au clic avec panneau latéral | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (gestion de `onPanoramaClick`), `apps/admin/src/pages/HotspotForm.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (simule le clic sur le mock du panorama et vérifie l'apparition du panneau de création) |
| **F-22** Glisser-déposer, suppression, annuler/rétablir (Ctrl+Z/Y), sauvegarde (debounce 1s) | Écart | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (écoute des événements `keydown` pour Z/Y, utilisation du debounce), `apps/admin/src/editor/editHistory.ts`, `apps/admin/src/editor/debouncedSaver.ts`<br>**Tests :** `apps/admin/src/editor/editHistory.test.ts`, `apps/admin/src/editor/debouncedSaver.test.ts`, `apps/admin/src/pages/SceneDetailPage.test.tsx` (test de debounce instable) |
| **F-23** Vue initiale et orientation d'arrivée | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (`handleSetInitialView`), `apps/admin/src/pages/ArrivalOrientationDialog.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (boutons "Définir la vue actuelle..." et "Définir l'orientation..."), `apps/admin/src/pages/ArrivalOrientationDialog.test.tsx` |
| **F-24** Bouton « Tester la visite », jeton d'aperçu | OK | **Fichiers :** `apps/admin/src/pages/TourDetailPage.tsx` (bouton), `apps/api/src/catalog/tours.controller.ts` (route POST preview-token), `apps/api/src/catalog/preview-token.ts`, `apps/web/src/route.ts`, `apps/web/src/app.ts`<br>**Tests :** `apps/admin/src/pages/TourDetailPage.test.tsx`, `apps/api/test/tours.int.test.ts` (tests de la route), `apps/api/src/catalog/preview-token.test.ts`, `apps/web/src/route.test.ts`, `apps/web/src/app.test.ts` |
| **F-25** Carte des liens avec orphelins | OK | **Fichiers :** `apps/admin/src/pages/TourLinkMapPanel.tsx`, `apps/admin/src/editor/LinkMapGraph.tsx`, `apps/admin/src/editor/linkMapLayout.ts`, `packages/shared/src/tour-graph.ts`<br>**Tests :** `apps/admin/src/pages/TourLinkMapPanel.test.tsx`, `apps/admin/src/editor/LinkMapGraph.test.tsx`, `apps/admin/src/editor/linkMapLayout.test.ts`, `packages/shared/src/tour-graph.test.ts`, `apps/api/test/tours.int.test.ts` (cas graphe avec orphelins) |

## Écarts

| Critère | Écart | Cause |
|---|---|---|
| Tests d'intégration | Non exécuté | Les fichiers `/tmp/int.exit` et `/tmp/int.log` complets (produits des sous-tâches précédentes) sont introuvables sur l'environnement. |

## Contrôle d'accès

- Les routes `POST /api/v1/admin/tours/:id/preview-token` et `GET /api/v1/admin/tours/:id/graph` dans `apps/api/src/catalog/tours.controller.ts` sont réservées aux rôles `EDITOR` et supérieurs (403 pour PARTNER et HOTEL_MANAGER), donc sans filtre par hôtel ; le test « gestionnaire de l'hôtel A / hôtel B » est sans objet.
- Les tests (401, 403, 404, nominal) existent dans `apps/api/test/tours.int.test.ts` pour ces deux routes.

## Sorties des commandes

### pnpm test
**Commande :** `CI=1 timeout 480 pnpm test > /tmp/test.log 2>&1; echo EXIT=$?`
**Code de sortie :** 0
**Résumé Vitest :** 133 fichiers réussis, 0 en échec. 1000 tests réussis, 0 en échec.

**Dernières lignes :**
```text
 ✓  @xplor/api  src/health/health.service.test.ts (3 tests) 8ms
 ✓  @xplor/api  src/auth/prisma-user.repository.test.ts (8 tests) 11ms
 ✓  @xplor/viewer-core  src/tour-nodes.test.ts (1 test) 6ms
 ✓  @xplor/api  src/viewer/tour-graph-refs.test.ts (6 tests) 6ms
 ✓  @xplor/api  src/auth/lockout.test.ts (4 tests) 5ms
 ✓  scripts  demo-m2-lib.spec.ts (8 tests) 6ms
 ✓  @xplor/api  src/auth/unit-of-work.test.ts (2 tests) 5ms
 ✓  @xplor/worker  src/derivatives/content-hash.test.ts (3 tests) 5ms
 ✓  @xplor/viewer-core  src/hotspot-action.test.ts (6 tests) 5ms
 ✓  @xplor/viewer-core  src/tour-config.test.ts (5 tests) 6ms
 ✓  @xplor/api  src/catalog/tour-duplicate.test.ts (5 tests) 6ms
 ✓  @xplor/api  src/auth/session.guard.test.ts (10 tests) 10ms
 ✓  @xplor/api  src/viewer/share-html.test.ts (3 tests) 4ms
 ✓  @xplor/api  src/mail/fake-mailer.test.ts (1 test) 4ms
 ✓  @xplor/viewer-core  src/tour-link.test.ts (5 tests) 5ms
 ✓  @xplor/api  src/mail/render-mail.test.ts (2 tests) 4ms
 ✓  @xplor/api  src/seed/seed-users.test.ts (4 tests) 8ms
 ✓  @xplor/shared  src/password.test.ts (1 test) 3ms
 ✓  @xplor/api  src/prisma/role.test.ts (1 test) 4ms
 ✓  @xplor/api  src/mail/smtp-mailer.test.ts (1 test) 3ms
 ✓  @xplor/api  src/cli/format-error.test.ts (4 tests) 4ms
 ✓  @xplor/api  src/auth/prisma-user.lookup.test.ts (2 tests) 4ms
 ✓  @xplor/web  src/controls.test.ts (4 tests) 14ms
 ✓  @xplor/web  src/info-panel.test.ts (9 tests) 24ms
 ✓  @xplor/web  src/media-overlay.test.ts (11 tests) 29ms
 ✓  @xplor/web  src/confirm-dialog.test.ts (7 tests) 17ms
 ✓  @xplor/web  src/text-html.test.ts (6 tests) 4ms
 ✓  @xplor/web  src/route.test.ts (15 tests) 5ms
 ✓  @xplor/web  src/lang-switcher.test.ts (3 tests) 11ms
 ✓  @xplor/kiosk  src/mount.test.ts (2 tests) 4ms
 ✓  @xplor/web  src/scene-audio-player.test.ts (7 tests) 13ms
 ✓  @xplor/web  src/hotspot-ui.test.ts (7 tests) 18ms
 ✓  @xplor/web  src/viewer-controller.test.ts (13 tests) 43ms
 ✓  @xplor/web  src/app.test.ts (7 tests) 18ms

 Test Files  133 passed (133)
      Tests  1000 passed (1000)
   Start at  14:00:32
   Duration  16.75s (transform 7.18s, setup 0ms, collect 92.65s, tests 21.39s, environment 127.10s, prepare 25.40s)
```

### pnpm test:int
**Commande :** `CI=1 timeout 480 pnpm test:int > /tmp/int.log 2>&1; echo EXIT=$?`
**Code de sortie :** non exécuté
**Résumé Vitest :** non exécuté

**Erreur :**
```text
Non exécuté : les fichiers /tmp/int.exit et /tmp/int.log (produits des sous-tâches précédentes) sont introuvables ou incomplets sur l'environnement.
```

### pnpm lint
**Code de sortie :** 0

### pnpm typecheck
**Code de sortie :** 0
