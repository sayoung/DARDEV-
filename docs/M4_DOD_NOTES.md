# Notes de vérification DoD M4 (F-20 à F-25)

| Critère | Statut | Fichiers et tests cités |
|---|---|---|
| **F-20** Éditeur 360 dans l'onglet de la scène | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (TabsContent "editor"), `apps/admin/src/components/SceneEditor360.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (vérifie l'onglet Éditeur 360), `apps/admin/src/components/SceneEditor360.test.tsx` |
| **F-21** Création de hotspot au clic avec panneau latéral | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (gestion de `onPanoramaClick`), `apps/admin/src/pages/HotspotForm.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (simule le clic sur le mock du panorama et vérifie l'apparition du panneau de création) |
| **F-22** Glisser-déposer, suppression, annuler/rétablir (Ctrl+Z/Y), sauvegarde (debounce 1s) | Écart | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (écoute des événements `keydown` pour Z/Y, utilisation du debounce), `apps/admin/src/editor/editHistory.ts`, `apps/admin/src/editor/debouncedSaver.ts`<br>**Tests :** `apps/admin/src/editor/editHistory.test.ts`, `apps/admin/src/editor/debouncedSaver.test.ts`, `apps/admin/src/pages/SceneDetailPage.test.tsx` (test de debounce instable) |
| **F-23** Vue initiale et orientation d'arrivée | OK | **Fichiers :** `apps/admin/src/pages/SceneDetailPage.tsx` (`handleSetInitialView`), `apps/admin/src/pages/ArrivalOrientationDialog.tsx`<br>**Tests :** `apps/admin/src/pages/SceneDetailPage.test.tsx` (boutons "Définir la vue actuelle..." et "Définir l'orientation..."), `apps/admin/src/pages/ArrivalOrientationDialog.test.tsx` |
| **F-24** Bouton « Tester la visite », jeton d'aperçu | OK | **Fichiers :** `apps/api/src/catalog/preview-token.ts`, `apps/web`<br>**Tests :** `apps/api/src/catalog/preview-token.test.ts` |
| **F-25** Carte des liens avec orphelins | OK | **Fichiers :** `apps/admin/src/pages/TourLinkMapPanel.tsx`, `apps/admin/src/editor/LinkMapGraph.tsx`, `apps/admin/src/editor/linkMapLayout.ts`, `packages/shared/src/tour-graph.ts` |

## Contrôle d'accès

- Les routes `POST /api/v1/admin/tours/:id/preview-token` et `GET /api/v1/admin/tours/:id/graph` dans `apps/api/src/catalog/tours.controller.ts` sont réservées aux rôles `EDITOR` et supérieurs (403 pour PARTNER et HOTEL_MANAGER), donc sans filtre par hôtel ; le test « gestionnaire de l'hôtel A / hôtel B » est sans objet.
- Les tests (401, 403, 404, nominal) sont bien présents et validés dans `apps/api/test/tours.int.test.ts`.
