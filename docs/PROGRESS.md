# Suivi — Xplor

## Jalon en cours : M3b — Mise en ligne bêta

Exigences : NF-10 (partiel), NF-01 (partiel)

Livrable : Démo 1 en ligne : la visite s'ouvre sur mobile depuis le QR (https://v.xplor.ma/v/…), back-office sur https://admin.xplor.ma

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

DoD M3b remplie : non

Jalon précédent : M3 validé par le porteur ; détail dans docs/archive/PROGRESS-M3.md

## État des tâches

### En cours
- Aucun.

### Fait

- 04/10/2026 — Récupération du travail non commité — Ajout de @fastify/cors et @fastify/helmet avec lockfile cohérent et décision D-106 (raison, licence, alternatives) conforme à AGENTS.md ; contrôles OK. (7f7c7b6)
- 04/10/2026 — M3b NF-01 (configuration CORS, test d'abord) : dans apps/api/src/config/env.ts, ajoute la variable `API_CORS_ORIGINS` (chaîne d'origines séparées par des virgul… — API_CORS_ORIGINS est ajoutée avec défaut en développement, découpage, validation d'URL et exigence en production, avec les tests et .env.example ; lint, typecheck et test passent. (08cb121)
- 04/10/2026 — M3b NF-10 (build de production du worker) : sans docker, lance `pnpm --filter @xplor/worker build` et vérifie le fichier d'entrée produit dans apps/worker/dist.… — Le script start (node dist/main.js) correspond à l'entrée réellement produite par la build, dist est ignoré par git, PROGRESS.md n'est pas modifié et les contrôles passent. (e5a0bea)
- 04/10/2026 — M3b NF-10 (preuve de démarrage de la build de production). Sans docker : lance `pnpm --filter @xplor/api build`, puis `node apps/api/dist/main.js` en arrière-pl… — Aucun changement nécessaire (DEPLOY.md absent, diff vide, lint/typecheck/test OK) ; la preuve du 200 sur /api/health est à fournir dans le rapport de l'agent, je ne l'ai pas vérifiée. (84a56fa)
- 04/10/2026 — M3b NF-10 (scripts de démarrage et build ordonné). Dans apps/api/package.json, ajoute `"start": "node dist/main.js"` et `"start:prod": "node dist/main.js"` seul… — Scripts start/start:prod vers dist/main.js (chemin confirmé par la configuration) et prebuild qui construit @xplor/shared avant prisma generate, sans autre modification ; lint et typecheck OK. (75e5b93)
- 04/10/2026 — M3b NF-10 (rendre @xplor/shared exécutable par Node en production). Si le diagnostic montre que `@xplor/shared` est chargé depuis `src/*.ts`, corrige le minimum… — shared obtient un build tsc vers dist, des exports avec la condition development vers src et default vers dist, des scripts tsx adaptés ; imports déjà en .js, dist ignoré, contrôles verts. (5f2215f)
- 04/10/2026 — M3b NF-10 (diagnostic du build API, aucune modification de fichier suivi). Sans docker ni modification de code : lance `pnpm --filter @xplor/api build` sur deve… — Diagnostic sans modification de fichier : diff vide, contrôles verts, aucune règle violée ; le constat (3 à 6 lignes) est dans la réponse de l'agent, non vérifiable ici. (3ad7874)
- 04/10/2026 — M3b (bilan/archivage, documentation seule, aucun code) : déplace dans docs/archive/PROGRESS-M3.md (nouveau fichier) tout le bloc « Jalon en cours : M3 » (tablea… — Archivage M3 et nouvel en-tête M3b conformes à la demande ; PROGRESS.md fait 1,5 Ko, seuls les deux fichiers de docs sont modifiés, lint/typecheck/test OK. (67d4529)

### Bloqué
- M1 critère 2, CI distante non confirmée (run GitHub Actions à fournir par le porteur)

### Risques
- Fichiers de déploiement non testables localement (docker interdit aux agents) : validation au premier déploiement par le porteur
- Problème de virtualisation pour Docker sous WSL2 (moteur instable).
- eslint 9 et test.workspace.ts dépréciés.
- Avis audit sous le seuil CI (Vitest, fastify).
- Tests verts en local uniquement, CI non confirmée.
