# Suivi — Xplor

## Jalon en cours : M4 — Éditeur visuel

Exigences : F-20 à F-25

Livrable : L'équipe contenus produit une visite complète sans aide technique

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | Toutes les exigences implémentées et CA vérifiés | à faire | - |
| 2 | Tests automatisés ajoutés et verts en CI (unitaires, int, e2e) | à faire | - |
| 3 | pnpm lint, pnpm typecheck sans erreur | à faire | - |
| 4 | Migrations appliquées, seed à jour | à faire | - |
| 5 | Chaînes d'interface dans les 3 langues ; RTL vérifié | reporté (D-82) | - |
| 6 | PROGRESS.md à jour, DECISIONS.md complété, OpenAPI à jour | à faire | - |
| 7 | Démo avec données pertinentes | à faire | - |
| 8 | Démo au porteur et retours consignés | à faire | - |

DoD M4 remplie : non

Jalon précédent : M3b validé par le porteur ; détail dans docs/archive/PROGRESS-M3b.md

## État des tâches

### En cours
- Aucun.

### Fait

- 07/10/2026 — M4 F-23 (2/4) : dans apps/admin/src/pages/SceneDetailPage.tsx (SceneEditorTab), crée une ref SceneEditor360Handle passée en `handleRef` à SceneEditor360. Ajoute… — Bouton « Définir la vue actuelle comme vue initiale » avec ref SceneEditor360Handle, appel updateScene (corps complet, requis par le schéma PUT), message de succès/erreur, clés fr et test ajoutés ; co… (80e91a5)
- 07/10/2026 — M4 F-23 (1/4) : dans apps/admin/src/components/SceneEditor360.tsx, ajoute une prop facultative `handleRef?: React.Ref<SceneEditor360Handle>` et exporte `type Sc… — handleRef/SceneEditor360Handle ajoutés avec getView normalisé (yaw via normalizeYaw, zoom arrondi, repli sur la vue initiale), test conforme, deux fichiers seulement, lint/typecheck/test verts. (8dda7e7)
- 07/10/2026 — M4 F-22 (7/7) : dans apps/admin/src/pages/SceneDetailPage.tsx (SceneEditorTab), branche createEditHistory (apps/admin/src/editor/editHistory.ts, via useRef). Ch… — Annuler/Rétablir des déplacements de marqueurs via createEditHistory, raccourcis clavier, boutons, clé fr et 2 tests ajoutés ; lint, typecheck et test au vert. (c794051)
- 07/10/2026 — M4 F-22 (6c/7) : ajoute 1 test dans apps/admin/src/pages/SceneDetailPage.test.tsx pour le déplacement de marqueur de SceneEditorTab. Étends le mock existant de… — Le test de déplacement de marqueur avec debounce de 1000 ms est conforme à la consigne (999 ms puis 1000 ms, timers restaurés), seul le fichier de test est modifié, et lint, typecheck et test passent. (6791ca1)
- 07/10/2026 — M4 F-22 (6b/7) : dans apps/admin/src/pages/SceneDetailPage.tsx (SceneEditorTab), câble le déplacement des marqueurs vers la sauvegarde. Contexte : `createDeboun… — Câblage du déplacement des marqueurs vers la sauvegarde différée conforme à la demande, contrôles au vert, clés i18n présentes. (53c1311)
- 06/10/2026 — M4 F-22 (6a/7) : ajoute dans packages/i18n/src/locales/fr.json, sous `catalog.hotspots.editor` (à côté de `confirmDelete`), un objet `status` avec `pending` « M… — Ajout correct de catalog.hotspots.editor.status (4 libellés fr) dans fr.json uniquement, contrôles au vert. (3506122)
- 06/10/2026 — M4 F-22 (5/7) : dans apps/admin/src/pages/SceneDetailPage.tsx (SceneEditorTab), onMarkerSelect enregistre `selectedHotspotId` (et vide draftPosition). Si un hot… — Sélection de hotspot, suppression avec confirmation, bouton Fermer, clés fr et 2 tests conformes à la demande ; lint, typecheck et test au vert. (03a8fbe)
- 06/10/2026 — M4 F-22 (4/7) : dans apps/admin/src/components/SceneEditor360.tsx, ajoute une prop facultative `onMarkerMove?: (id: string, yaw: number, pitch: number) => void`… — onMarkerMove est transmis via callbacksRef sans remontage, avec un test couvrant l'appel et le rerender ; lint, typecheck et tests sont au vert. (f04698a)
- 06/10/2026 — M4 F-22 (3/7) : dans packages/viewer-core/src/scene-editor.test.ts, ajoute les tests du glisser-déposer de mountSceneEditor avec onMarkerMove (en t'appuyant sur… — Tests de glisser-déposer (a) yaw hors plage normalisé, (b) pas de déplacement donc pas d'appel, (c) retrait des écouteurs au destroy sont présents et corrects ; lint, typecheck et test passent. (bed07ec)
- 06/10/2026 — M4 F-22 (3/7) : dans packages/viewer-core/src/scene-editor.ts, ajoute à l'option de mountSceneEditor `onMarkerMove?: (id: string, yaw: number, pitch: number) =>… — onMarkerMove ajouté avec écouteurs conditionnels, drag/drop et nettoyage dans destroy() conformes à la tâche ; contrôles verts. (268362d)
- 06/10/2026 — M4 F-22 (3/7) : dans packages/viewer-core/src/scene-editor.test.ts, prépare le mock PSV existant pour le glisser-déposer, sans modifier scene-editor.ts. Ajoute… — Mocks PSV préparés (container, dataHelper, updateMarker) et test d'absence d'écouteurs pointer ajouté, sans toucher scene-editor.ts ni apps/admin ; lint, typecheck et tests verts. (0354ed2)
- 06/10/2026 — M4 F-22 (2/7, tests d'abord) : crée apps/admin/src/editor/debouncedSaver.ts et debouncedSaver.test.ts (TypeScript pur). Exporte `type SaveStatus = 'idle' | 'pen… — debouncedSaver et ses tests respectent la spec (regroupement par clé, statuts, flush, cancel, error) et les contrôles sont verts. (1b3e4e3)
- 06/10/2026 — M4 F-22 (1/7, tests d'abord) : crée apps/admin/src/editor/editHistory.ts (TypeScript pur, sans React) et editHistory.test.ts. Exporte le type `EditCommand = { k… — editHistory.ts et ses tests respectent la spécification, D-112 est ajoutée avec le bon numéro, seuls les fichiers demandés sont touchés et lint/typecheck/test passent. (edd4632)
- 06/10/2026 — M4 F-21 (4/4, tests) : dans apps/admin/src/pages/SceneDetailPage.test.tsx (SceneEditor360 mocké, le mock expose onPanoramaClick par exemple via un bouton de tes… — Les 3 tests demandés (aide puis formulaire yaw/pitch, soumission avec rafraîchissement, annulation) sont ajoutés dans le seul fichier de test, sans toucher à la production ni au suivi, et lint, typech… (c081c42)
- 06/10/2026 — M4 F-21 (3/4) : dans apps/admin/src/pages/SceneDetailPage.tsx (onglet Éditeur 360), mets la vue en deux colonnes (éditeur à gauche, panneau latéral à droite, Ta… — L'éditeur 360 passe en deux colonnes avec le formulaire de création de hotspot, la gestion d'erreur et les clés fr demandées. Lint, typecheck et tests passent. (57d1f1e)
- 06/10/2026 — M4 F-21 (2/4) : dans apps/admin/src/pages/HotspotForm.tsx, ajoute une prop facultative `defaultPosition?: { yaw: number; pitch: number }` utilisée comme valeur… — defaultPosition et onCancel ajoutés dans HotspotForm avec la clé i18n common.actions.cancel et deux tests ciblés ; lint, typecheck et test sont au vert. (f64e2a0)
- 06/10/2026 — M4 F-21 (1/4, tests d'abord) : dans packages/viewer-core/src/scene-editor.ts, ajoute et exporte `normalizeYaw(yaw: number): number`, qui ramène un angle en radi… — normalizeYaw correct, exporté et appliqué au clic, tests conformes à la demande, lint/typecheck/test verts. (3af0381)
- 06/10/2026 — M4 F-20 (correctif 2/2, éditeur) : dans packages/viewer-core/src/scene-editor.ts, change `editorPanorama` pour qu'elle prenne `asset: { panorama: PanoramaUrls |… — editorPanorama utilise désormais asset.panorama (PanoramaUrls) avec tileUrl par gabarit, tests et fixtures mis à jour, contrôles verts. (a1a39f9)
- 06/10/2026 — M4 F-20 (correctif 1/2, étape b, API + tests + OpenAPI) : dans apps/api/src/catalog/assets.service.ts, fonction `toAsset(row, mediaBase)` (fin du fichier), remp… — toAsset calcule panorama (preview/web/tiles, null sinon) avec try/catch, deux tests pertinents ajoutés, openapi.json déjà à jour depuis l'étape a, contrôles verts. (e641ca3)
- 06/10/2026 — M4 F-20 (correctif 1/2, étape a, schémas partagés) : (1) dans packages/shared/src/panorama-queue.ts, crée et exporte `PanoramaUrlsSchema` = z.object({ preview:… — PanoramaUrlsSchema créé, exporté et réutilisé dans tour-graph et AssetResponseSchema, avec panorama: null provisoire dans toAsset et les fixtures ; lint, typecheck et tests au vert. (4a2a125)
- 06/10/2026 — M4 F-20 (4/4, étape c) : dans apps/admin/src/pages/SceneDetailPage.test.tsx, avec SceneEditor360 mocké (vi.mock) et sans `as unknown as` (construis des assets t… — Deux tests ajoutés (éditeur 360 avec asset READY et alerte panoramaNotReady avec asset non READY), correctement typés et mockés, sans toucher au code de production ; lint, typecheck et tests au vert. (fa64adc)
- 06/10/2026 — M4 F-20 (4/4, étape b) : dans apps/admin/src/pages/SceneDetailPage.tsx (scène existante seulement), ajoute des onglets Radix (composant Tabs existant ou @radix-… — Onglets Informations / Éditeur 360 ajoutés correctement, chargement asset+hotspots, alerte si non READY, langue normalisée sans cast, lint/typecheck/test verts. (149a3f9)
- 06/10/2026 — M4 F-20 (4/4, étape a) : expose le champ `derivatives` dans la réponse d'asset (reprendre `git show agent/20261006-201013-m4-f-20-4-4-dans-apps-admin-src-pages-… — Le champ derivatives est exposé avec un schéma Zod strict, les trois clés fr.json sont ajoutées, openapi est régénéré et lint, typecheck et test sont verts. (76dc19a)
- 06/10/2026 — M4 F-20 (3/4, étape c) : écris apps/admin/src/components/SceneEditor360.test.tsx (Vitest + Testing Library, vi.mock('@xplor/viewer-core') avec un mountSceneEdit… — Le test SceneEditor360.test.tsx couvre les 7 cas demandés de façon fidèle au composant, sans autre fichier modifié, et lint, typecheck et tests sont verts. (460a738)
- 06/10/2026 — M4 F-20 (3/4, étape b) : crée apps/admin/src/components/SceneEditor360.tsx (partir de git show agent/20261006-162703-m4-f-20-3-4-dans-apps-admin-ajoute-la-de:ap… — SceneEditor360 conforme à la tâche (montage/destroy, refs pour callbacks et initialView, setMarkers, Tailwind, clé i18n editor.sceneAriaLabel) ; lint, typecheck et tests au vert. (a8047a7)
- 06/10/2026 — M4 F-20 (3/4, étape a) : dépendances et décisions. Dans apps/admin/package.json, ajoute la dépendance workspace @xplor/viewer-core (workspace:*) et @photo-spher… — Dépendances admin ajoutées en versions conformes et D-111 unique, UTF-8, au bon format; lint et typecheck verts, aucun autre fichier modifié. (0b13938)
- 06/10/2026 — M4 F-20 (2/4) : dans packages/viewer-core/src/scene-editor.ts, ajoute `mountSceneEditor(container, { panorama, markers, initialView: { yaw, pitch, zoom }, onPan… — mountSceneEditor est conforme à la demande (PSV + MarkersPlugin seul, click filtré, select-marker, setMarkers/getView/destroy), les 4 tests demandés passent, lint/typecheck/test verts. (55ef8c2)
- 06/10/2026 — M4 F-20 (1/4, étape c, tests d'abord) : dans packages/viewer-core/src/scene-editor.ts, ajoute et exporte `editorPanorama(asset)`. Elle construit la configuratio… — editorPanorama ajoutée avec tests et erreurs FR, schéma des dérivés mutualisé dans @xplor/shared ; lint et typecheck verts. (d8446fa)
- 06/10/2026 — M4 F-20 (1/4, étape b, tests d'abord) : crée packages/viewer-core/src/scene-editor.ts et scene-editor.test.ts, et exporte `./scene-editor.js` depuis packages/vi… — editorMarkers est correctement implémenté en réutilisant hotspotKind et localize, les tests couvrent les cas demandés, et lint/typecheck/test passent. (7862bc9)
- 06/10/2026 — M4 F-20 (1/4, étape a) : dans packages/viewer-core/src/scene-markers.ts, extrais et exporte une aide `hotspotKind(type: HotspotType)` qui renvoie 'tour-link' |… — hotspotKind extraite et exportée avec un switch exhaustif, toMarkers l'utilise sans changer son comportement, test ajouté, lint, typecheck et tests au vert, périmètre respecté. (7805092)
- 06/10/2026 — M4 bilan d'ouverture : copie le contenu actuel de docs/PROGRESS.md dans docs/archive/PROGRESS-M3b.md, en suivant le modèle de docs/archive/PROGRESS-M3.md. Puis,… — Archive PROGRESS-M3b.md créée et PROGRESS.md réinitialisé pour M4 conformément à la demande, sans autre fichier modifié ; lint, typecheck et test au vert. (972c8ac)