# Suivi — Xplor

## Jalon en cours : M3 — Visionneuse

Exigences : F-30 à F-35, F-40 à F-42, API-10, API-11, API-12

Livrable : Démo 1 : visite réelle de Rabat consultable sur mobile via QR

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

DoD M3 remplie : non

Jalon précédent : M2 validé par le porteur ; détail dans docs/archive/PROGRESS-M2.md

## État des tâches

### En cours
- Aucun.

### Fait

- 04/10/2026 — M3 API-10 / F-41 (décision de report, documentation seule) : dans docs/DECISIONS.md, ajouter une entrée D-xx datée du 04/10/2026. Elle indique que (1) API-10 `G… — Entrée D-104 conforme (date, décision en deux points, alternative, à valider), seul DECISIONS.md modifié, contrôles verts. (1328618)
- 04/10/2026 — M3 F-34 (apps/web, position dans Infos pratiques) : dans apps/web/src/viewer-controller.ts, handlePracticalInfo doit aussi gérer la position : si graph.location… — Lien carte OSM dans Infos pratiques via mapLinkHtml pur et testé, bouton activé si location présente, clé fr.json ajoutée, contrôles verts. (8cf8bc2)
- 04/10/2026 — M3 F-34 (apps/web, bouton gyroscope) : ajouter la clé `viewer.gyroscope` (« Gyroscope ») dans packages/i18n fr.json seulement (D-82). Dans apps/web/src/controls… — Bouton gyroscope facultatif et masqué par défaut, affiché selon gyroscopeSupported() après chaque montage, clic relié à toggleGyroscope(), avec tests ; la clé viewer.gyroscope existait déjà dans fr.js… (f50a0ac)
- 04/10/2026 — M3 F-34 (viewer-core, gyroscope) : ajouter `@photo-sphere-viewer/gyroscope-plugin` en version exacte 5.15.1 aux dependencies de packages/viewer-core (et d'apps/… — Plugin gyroscope 5.15.1 ajouté (viewer-core et apps/web), enregistré dans mount-viewer avec gyroscopeSupported/toggleGyroscope typés conformément aux définitions, D-103 consignée, lint/typecheck/test… (a00623d)
- 04/10/2026 — M3 F-35 (viewer-core, branchement de l'adaptateur de tuiles) : dans packages/viewer-core/src/mount-viewer.ts, passer au Viewer `adapter: EquirectangularTilesAda… — L'adaptateur EquirectangularTilesAdapter est branché correctement et sans cast dans mount-viewer.ts, avec showErrorTile, et les contrôles sont verts. (50e8ed3)
- 04/10/2026 — M3 F-35 (viewer-core, panorama en tuiles, logique pure) : ajouter `@photo-sphere-viewer/equirectangular-tiles-adapter` en version exacte 5.15.1 (même version qu… — Dépendance 5.15.1 ajoutée, D-102 consigné, TourNode.panorama converti en objet tuilé avec tests mis à jour, lint/typecheck/test verts, PROGRESS.md intact. (af4d738)
- 04/10/2026 — M3 F-35 (viewer-core, préchargement) : dans packages/viewer-core/src/tour-config.ts, ajouter à l'objet renvoyé par tourPluginOptions l'option `preload: true` du… — `preload: true` ajouté à tourPluginOptions (option valide du VirtualTourPlugin 5.15.1, type boolean | fonction) avec assertion de test ; seuls les deux fichiers demandés sont modifiés et les contrôles… (90ea9fb)
- 04/10/2026 — M3 F-41 (admin, QR code, interface) : dans apps/admin/src/pages/TourPublicationPanel.tsx, quand la visite est PUBLISHED avec publicShare true et un shareToken,… — Lien public et QR SVG affichés pour une visite publiée et partagée, avec téléchargement du fichier xplor-<token>.svg, chaînes fr dans i18n, tests ajoutés, lint/typecheck/test verts. (8dbd9e8)
- 04/10/2026 — M3 F-41 (admin, QR code, logique pure) : ajouter la dépendance `qrcode` (+ `@types/qrcode` en devDependencies) à apps/admin et l'inscrire dans docs/DECISIONS.md… — qrcode ajouté, shareUrl/tourQrSvg corrects et testés, D-101 inscrit, contrôles verts ; défauts de forme mineurs seulement. (d13b9a4)
- 04/10/2026 — M3 F-34 (apps/web, sélecteur de langue) : créer apps/web/src/lang-switcher.ts, sans framework, exportant `createLangSwitcher(doc: Document, current: Lang, label… — Sélecteur de langue conforme à la demande (composant, branchement navigate injectable, clé fr seule, CSS logique, tests happy-dom) et contrôles verts. (540c92e)
- 04/10/2026 — M3 F-30/F-31 (apps/web, branchement du contrôleur dans main.ts) : réécrire apps/web/src/app.ts pour que `startViewer` utilise `createViewerController` : conserv… — startViewer utilise createViewerController avec langue, jeton, erreurs et labels conservés, mount/destroy corrects, erreur de montage affichée en loadError, tests adaptés et contrôles verts. (ab5a574)
- 04/10/2026 — M3 F-33 (apps/web, contrôleur : narration et ambiance) : dans apps/web/src/viewer-controller.ts, intégrer `createSceneAudioPlayer` (apps/web/src/scene-audio-pla… — Le lecteur audio est bien intégré au contrôleur (apply à chaque scène, destroy à chaque remplacement de visite et sur le contrôleur) et le test demandé est présent ; lint, typecheck et test sont verts… (1887020)
- 04/10/2026 — M3 F-34 (apps/web, contrôleur : Infos pratiques) : dans apps/web/src/viewer-controller.ts, implémenter `handlePracticalInfo` : si `navigator.current()?.graph.pr… — handlePracticalInfo ouvre le panneau avec le texte échappé et découpé en paragraphes via textToHtml, avec tests (dont <script>) et contrôles verts. (8babe8a)
- 04/10/2026 — M3 F-33 (apps/web, contrôleur : hotspots INFO/MEDIA/URL) : dans apps/web/src/viewer-controller.ts, étendre `onHotspotClick` pour les hotspots qui ne sont pas de… — Hotspots INFO/MEDIA/URL délégués à handleHotspotClick avec openUrl injectable et close ajouté aux libellés, TOUR_LINK inchangé, trois tests ajoutés, lint/typecheck/test verts. (021511d)
- 04/10/2026 — M3 API-12 (2/2, route HTML) : ajouter dans apps/api/src/viewer/viewer.service.ts `getShareMeta(shareToken, lang)` réutilisant getPublicGraph (même 404) et renvo… — Route HTML de partage /public/share/:shareToken, getShareMeta, PUBLIC_WEB_URL, OpenAPI et tests unitaires conformes à la demande ; lint, typecheck et tests verts. (3c6da94)
- 04/10/2026 — M3 API-12 (1/2, rendu HTML Open Graph, logique pure) : créer apps/api/src/viewer/share-html.ts avec `renderShareHtml(meta: { title: string; summary: string; cov… — renderShareHtml est conforme : balises Open Graph, échappement HTML correct, dir via @xplor/i18n, tests pertinents et contrôles verts, sans fichier superflu. (bc02142)
- 04/10/2026 — M3 F-33 (apps/web, narration et ambiance) : créer apps/web/src/scene-audio-player.ts, sans framework, exportant `createSceneAudioPlayer(doc: Document, labels: {… — Lecteur audio de scène conforme à la demande : ambiance en boucle à volume réduit, narration à la demande, arrêt au changement de scène, styles logiques, tests et contrôles verts. (12b7c50)
- 04/10/2026 — M3 F-31/F-32 (apps/web, contrôleur de la visionneuse) : créer apps/web/src/viewer-controller.ts exportant `createViewerController(doc, deps)` qui assemble les b… — Le contrôleur assemble correctement navigator, controls et confirm-dialog, les 4 scénarios demandés sont testés et lint, typecheck et test sont verts. (313eae3)
- 04/10/2026 — M3 F-31 (viewer-core, navigation programmatique) : dans packages/viewer-core/src/mount-viewer.ts, ajouter à l'objet renvoyé par mountViewer une méthode `goToSce… — goToScene ajouté à mountViewer via tourPlugin.setCurrentNode, typé, changement minimal, lint/typecheck/test verts. (eab1ae5)
- 04/10/2026 — M3 F-33 (apps/web, branchement des hotspots) : créer apps/web/src/hotspot-ui.ts exportant `handleHotspotClick(doc: Document, graph: TourGraph, sceneId: string,… — handleHotspotClick conforme à la demande (dispatch info/media/url/tour, cas inconnus sans effet), tests présents pour chaque type, contrôles verts, périmètre respecté. (a0865b5)
- 04/10/2026 — M3 F-31 (apps/web, barre de contrôles, DOM) : créer apps/web/src/controls.ts, qui exporte `createControls(doc: Document, labels: { previous: string; next: strin… — createControls, styles en propriétés logiques et tests conformes à la tâche, contrôles verts, main.ts et PROGRESS.md non touchés ; réserves mineures (repli anglais 'Controls', glyphes non inversés en… (65d3657)
- 04/10/2026 — M3 F-32 (apps/web, confirmation avant TOUR_LINK, DOM) : créer apps/web/src/confirm-dialog.ts, qui exporte `confirmGoTo(doc: Document, targetTitle: string, label… — confirm-dialog.ts, ses styles à propriétés logiques et ses tests sont conformes à la demande ; lint, typecheck et test sont verts. (09b0215)
- 04/10/2026 — M3 F-33 (apps/web, lecteur MEDIA, styles) : ajouter à la fin de apps/web/src/style.css les styles de #media-overlay, uniquement avec des propriétés logiques (in… — Styles #media-overlay ajoutés en propriétés logiques uniquement, conformes à la demande (z-index 200 > 100, cibles 44px, focus visible, positionnement cohérent avec l'ordre DOM), contrôles verts, aucu… (918ede0)
- 04/10/2026 — M3 F-33 (apps/web, lecteur MEDIA, navigation) : dans apps/web/src/media-overlay.ts (déjà créé), ajouter les boutons Précédent et Suivant (type=button, textConte… — Navigation précédent/suivant correcte et testée (boutons conditionnels, disabled aux extrémités, un seul média dans le DOM, pause au changement et à la fermeture) ; seuls écarts mineurs dans les tests… (1966408)
- 04/10/2026 — M3 F-33 (apps/web, lecteur MEDIA, module) : créer apps/web/src/media-overlay.ts, sans framework, sur le modèle de apps/web/src/info-panel.ts (même style de ferm… — openMediaOverlay respecte la spécification (filtrage, premier média, fermeture idempotente par bouton et Échap, pause avant retrait, fermeture de la précédente), tests présents et contrôles verts, san… (9ca6505)
- 04/10/2026 — M3 F-33 (apps/web, panneau INFO, styles) : dans apps/web/src/style.css, ajouter les styles de `#info-panel` (panneau latéral créé par apps/web/src/info-panel.ts… — Styles de #info-panel ajoutés dans apps/web/src/style.css avec uniquement des propriétés logiques, conformes à la demande ; lint, typecheck et test verts. (426f0ad)
- 04/10/2026 — M3 F-33 (apps/web, panneau INFO, tests) : créer apps/web/src/info-panel.test.ts (Vitest, environnement happy-dom déjà configuré) pour `openInfoPanel` de apps/we… — Les neuf cas demandés sont couverts, le texte du bouton passe par labels.close (vrai défaut corrigé), et lint, typecheck et test sont verts ; la preuve du retrait de l'écouteur Échap reste faible. (d3fb357)
- 04/10/2026 — M3 F-33 (apps/web, panneau INFO, composant) : créer apps/web/src/info-panel.ts, sans framework, qui exporte `openInfoPanel(doc: Document, content: { title: stri… — Composant info-panel conforme à la spécification, avec tests et contrôles verts ; seule réserve : le texte du bouton « Fermer » est codé en dur au lieu de venir de labels.close (à corriger au branchem… (4db52a6)
- 04/10/2026 — M3 F-42 (back-office, bouton de régénération) : dans apps/admin/src/pages/TourPublicationPanel.tsx, ajouter un bouton shadcn variant outline « Régénérer le lien… — Bouton de régénération du lien de partage conforme (window.confirm comme les suppressions existantes, POST via requestJson, i18n fr, 2 tests) ; contrôles verts, défauts de forme mineurs seulement. (2e7e24c)
- 04/10/2026 — M3 F-42 (API, tests d'intégration de la régénération) : la route `POST /api/v1/admin/tours/:id/share-token` existe dans develop. Dans apps/api/test/tours-public… — Trois tests d'intégration (401, 404, régénération avec invalidation de l'ancien jeton) ajoutés au bon endroit, dans le style du fichier ; lint, typecheck et test sont verts d'après l'orchestrateur. (a20f790)
- 04/10/2026 — M3 F-42 (API, route de régénération, code et OpenAPI) : reprendre depuis la branche agent/20261004-025655-m3-f-42-api-route-de-regeneration-dans-a (lecture seul… — Route POST /admin/tours/{id}/share-token ajoutée au contrôleur et à l'OpenAPI, conforme à la demande, openapi.json régénéré avec uniquement cette route, contrôles verts. (2f2a9f7)
- 04/10/2026 — M3 F-42 (API, service de régénération du jeton) : 1) Extraire la fonction locale createShareToken et la constante SHARE_TOKEN_BYTES d'apps/api/src/catalog/tours… — Extraction de createShareToken et ajout de regenerateShareToken conformes à la demande, avec tests unitaires pertinents et contrôles verts. (a1febb2)
- 04/10/2026 — M3 F-40 (seed, visite partageable de démonstration) : vérifier dans apps/api/src/seed/seed-tours.ts qu'au moins une visite du seed est PUBLISHED avec publicShar… — La visite demo-rabat est publiée et partageable avec scènes, SCENE_LINK et dérivés alignés sur le worker. Le seed reste idempotent, le schéma shareToken est assoupli de façon cohérente et lint, typech… (062440b)
- 04/10/2026 — M3 F-40 (apps/web, branchement réel) : dans apps/web/src/main.ts, importer les quatre feuilles CSS de Photo Sphere Viewer (liste dans le commentaire de packages… — Branchement réel de apps/web (CSS PSV, startViewer avec fetchTourGraph/mountViewer, style plein écran), code mort mount.ts supprimé et resolveLang déplacé dans route.ts avec son test ; contrôles verts… (ce81bde)
- 04/10/2026 — M3 F-40 (apps/web, amorce de la visionneuse, logique testable) : créer apps/web/src/app.ts, qui exporte `startViewer(doc: Document, location: { pathname: string… — startViewer et ses tests respectent la spécification, et lint, typecheck et test passent ; seul défaut : l'erreur levée par mount reste masquée car le statut est déjà caché (mineur, à corriger plus ta… (d19685c)
- 04/10/2026 — M3 F-40 (apps/web, dépendances et proxy) : dans apps/web/package.json, ajouter aux dependencies `@xplor/viewer-core` (workspace:*) ainsi que @photo-sphere-viewe… — Dépendances PSV et viewer-core ajoutées à apps/web, proxy /api configuré, D-100 complétée, sans autre changement ; lint, typecheck et test OK. (c6e3231)
- 04/10/2026 — M3 F-33 (viewer-core, action d'un hotspot, logique pure) : créer packages/viewer-core/src/hotspot-action.ts, qui exporte le type `HotspotAction` = { kind: 'info… — hotspotAction et son test sont conformes à la tâche (un cas par type + id inconnu, export ajouté, aucun paquet ni PROGRESS.md touchés), contrôles verts. (036d1d0)
- 04/10/2026 — M3 F-33 (viewer-core, clic sur un marqueur) : dans packages/viewer-core/src/mount-viewer.ts, ajouter à `opts` une option `onHotspotClick?: (hotspotId: string) =… — onHotspotClick est branché sur l'événement typé 'select-marker' du MarkersPlugin, avec marker.id (id du hotspot), sans any ni cast, et uniquement dans mount-viewer.ts ; lint, typecheck et test passent… (e1f9ed5)
- 04/10/2026 — M3 F-30 (viewer-core, montage de Photo Sphere Viewer, adaptateur DOM) : dans packages/viewer-core, créer src/mount-viewer.ts qui exporte `mountViewer(container:… — mountViewer monte Photo Sphere Viewer avec les trois plugins, pose les marqueurs et notifie le changement de scène avec des API typées, et lint/typecheck/test passent. (33f92c0)
- 04/10/2026 — M3 F-40 (apps/web, extraction du jeton de partage, logique pure) : dans apps/web, créer src/route.ts qui exporte `parseShareToken(pathname: string): string | nu… — parseShareToken respecte la règle de jeton de l'API (1 à 22 caractères [A-Za-z0-9_-]), les tests couvrent tous les cas demandés, apps/web est collecté par vitest, et le périmètre de la tâche est respe… (d28a9fe)

### Bloqué
- M1 critère 2, CI distante non confirmée (run GitHub Actions à fournir par le porteur)

### Risques
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.
