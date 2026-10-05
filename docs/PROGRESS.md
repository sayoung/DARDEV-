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

- 05/10/2026 — M3b NF-10 (docker-compose.prod.yml) : crée `docker-compose.prod.yml` à la racine, avec le nom de projet `name: xplor-prod`. Services : postgres:16-alpine (volum… — docker-compose.prod.yml conforme à la tâche : isolation de la prod, seul caddy publie des ports, healthchecks et restart corrects, variables cohérentes avec .env.production.example. (0200ce9)
- 05/10/2026 — M3b NF-10 (.env.production.example) : crée `.env.production.example` à la racine. Il ne contient aucun secret réel : chaque valeur sensible vaut `CHANGER_MOI`.… — Le fichier .env.production.example couvre toutes les variables requises par env.ts de l'API et par le worker, sans secret réel, et .gitignore ignore .env.production mais pas l'exemple. (4006147)
- 05/10/2026 — M3b NF-10 / NF-01 (Caddyfile de production) : écris `deploy/caddy/Caddyfile`. Option globale : `email {$ACME_EMAIL}`. Le bloc `(securite)` est un snippet réutil… — Caddyfile de production conforme à la demande (snippet sécurité, 5 sites, encode, SPA fallback, proxy /api) et décision D-107 consignée avec à valider : oui ; contrôles verts. (2d18ee4)
- 05/10/2026 — M3b NF-10 (image Caddy avec les fronts) : crée `deploy/caddy/Dockerfile` multi-étapes, avec la racine du dépôt comme contexte. Étape build (node:22-bookworm-sli… — Dockerfile multi-étapes et Caddyfile placeholder conformes à la demande, périmètre respecté, contrôles verts. (cabc9b1)
- 05/10/2026 — M3b NF-10 (build de production des fronts, diagnostic et correction minimale) : sans docker, lance `pnpm --filter "@xplor/admin..." run build`, puis `pnpm --fil… — viewer-core suit le modèle de @xplor/shared (tsconfig.build, script build, exports development/default), les URL localhost figées sont remplacées, le repli VITE_PUBLIC_WEB_URL est préservé et lint/typ… (6820556)
- 05/10/2026 — M3b NF-10 (worker/Dockerfile) : crée `apps/worker/Dockerfile` multi-étapes, calqué sur `apps/api/Dockerfile`, avec la racine du dépôt comme contexte. Étape buil… — apps/worker/Dockerfile multi-étapes conforme à la consigne et cohérent avec celui de l'API, seul fichier modifié, contrôles lint/typecheck/test OK. (bf66744)
- 04/10/2026 — M3b NF-10 (apps/api/Dockerfile) : crée `apps/api/Dockerfile` multi-étapes, contexte de build = racine du dépôt. Étape build (`node:22-bookworm-slim`) : `corepac… — Dockerfile multi-étapes conforme (build, deploy --prod, contrôles de fichiers, prisma generate épinglé 6.19.3, utilisateur node), contrôles verts, lockfile et PROGRESS intacts. (aa518a9)
- 04/10/2026 — M3b NF-10 (.dockerignore) : crée `.dockerignore` à la racine du dépôt avec des motifs récursifs : `**/node_modules`, `**/dist`, `**/.env*` (en gardant `!**/.env… — .dockerignore créé avec tous les motifs récursifs demandés et les exceptions .env.example / .env.production.example dans le bon ordre, sans exclure les fichiers essentiels ni modifier d'autres fichier… (6a8ed3c)
- 04/10/2026 — M3b NF-10 (i18n compilable pour la prod) : `@xplor/i18n` (packages/i18n/package.json) exporte aujourd'hui `./src/index.ts` et n'a aucun script `build`, donc `no… — i18n compilable via tsconfig.build.json, script build, exports default vers dist avec condition development, prebuild API mis à jour, calqué sur @xplor/shared ; contrôles OK. (3115bfb)
- 04/10/2026 — M3b NF-01 (branchement dans main.ts) : dans apps/api/src/main.ts, importe `registerHttpSecurity` depuis './http-security.js' et, juste après `await app.register… — registerHttpSecurity est branché dans main.ts après fastifyCookie, la CSP n'est pas modifiée, le test /html est ajouté et les contrôles sont verts. (fa32c88)
- 04/10/2026 — M3b NF-01 (module http-security, test d'abord) : crée apps/api/src/http-security.ts qui exporte `async function registerHttpSecurity(app: FastifyInstance, corsO… — Module http-security conforme à la spec (CORS credentials, HSTS, CSP stricte) avec tests Vitest couvrant les trois cas demandés, contrôles verts, périmètre respecté. (887c780)
- 04/10/2026 — M3b NF-01 (paquets CORS/helmet) : ajoute `@fastify/cors` et `@fastify/helmet` aux dépendances de apps/api (`pnpm --filter api add @fastify/cors @fastify/helmet`… — Les paquets @fastify/cors et @fastify/helmet sont ajoutés avec le lockfile à jour, l'entrée D-106 est complète au format D-105, et lint, typecheck et test passent. (4add2f4)
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
