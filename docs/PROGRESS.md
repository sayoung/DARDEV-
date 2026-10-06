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

- 06/10/2026 — M4 F-20 (1/4, étape c, tests d'abord) : dans packages/viewer-core/src/scene-editor.ts, ajoute et exporte `editorPanorama(asset)`. Elle construit la configuratio… — editorPanorama ajoutée avec tests et erreurs FR, schéma des dérivés mutualisé dans @xplor/shared ; lint et typecheck verts. (d8446fa)
- 06/10/2026 — M4 F-20 (1/4, étape b, tests d'abord) : crée packages/viewer-core/src/scene-editor.ts et scene-editor.test.ts, et exporte `./scene-editor.js` depuis packages/vi… — editorMarkers est correctement implémenté en réutilisant hotspotKind et localize, les tests couvrent les cas demandés, et lint/typecheck/test passent. (7862bc9)
- 06/10/2026 — M4 F-20 (1/4, étape a) : dans packages/viewer-core/src/scene-markers.ts, extrais et exporte une aide `hotspotKind(type: HotspotType)` qui renvoie 'tour-link' |… — hotspotKind extraite et exportée avec un switch exhaustif, toMarkers l'utilise sans changer son comportement, test ajouté, lint, typecheck et tests au vert, périmètre respecté. (7805092)
- 06/10/2026 — M4 bilan d'ouverture : copie le contenu actuel de docs/PROGRESS.md dans docs/archive/PROGRESS-M3b.md, en suivant le modèle de docs/archive/PROGRESS-M3.md. Puis,… — Archive PROGRESS-M3b.md créée et PROGRESS.md réinitialisé pour M4 conformément à la demande, sans autre fichier modifié ; lint, typecheck et test au vert. (972c8ac)