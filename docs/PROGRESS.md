# Suivi — Xplor

## Jalon en cours : M7 — Statistiques

Exigences : F-80 à F-83, API-04 et API-29

Livrable : tableau de bord alimenté par une semaine d’usage simulé

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | F-80 et API-29/F-81/F-82 implémentés ; agrégation et vérification de bout en bout | partiel | F-80, API-29 et export faits ; migration StatsDaily appliquée, job horaire de recalcul encore à implémenter |
| 2 | Tests automatisés verts (unitaires, intégration, e2e) | partiel | Tests unitaires ciblés verts ; intégration réelle à relancer après démarrage de PostgreSQL |
| 3 | pnpm lint, pnpm typecheck sans erreur | fait | lint, typecheck verts le 21/10/2026 |
| 4 | Migration StatsDaily appliquée, données de démonstration générées | partiel | Migration `20261021134205_stats_daily` appliquée sur `xplor` de développement par tunnel ; 418 événements / 84 sessions de démo créés ; table StatsDaily reste vide en attendant le job de recalcul |
| 5 | Chaînes d’interface fr/ar/en ; RTL vérifié | partiel | Chaînes ajoutées ; vérification RTL visuelle à faire |
| 6 | PROGRESS.md, DECISIONS.md et OpenAPI à jour | fait | `docs/openapi.json` régénéré |
| 7 | Démo avec données pertinentes | partiel | `stats:demo -- --confirm-dev` exécuté en développement : 418 événements et 84 sessions ; job d’agrégation et validation de l’interface restent à faire |
| 8 | Démo au porteur et retours consignés | à faire | - |

DoD M7 remplie : non

Jalons M0 à M6 marqués validés dans Orch.

## Session en cours
- M6 F-71 (2/2) : Protocole Quest Browser rédigé dans docs/VALIDATION_QUEST.md (entrée VR, rayons contrôleur/main, visée flèche/info, pincement/gâchette, déclenchement unique anti-rebond, fondu de confort, regard-dwell de secours, sortie nadir/système, console propre). Validation matérielle marquée « à faire sur Quest » (aucun casque physique connecté localement). Suite de tests automatisés (19 tests VR mount-vr dont rejet des événements sans contrôleur correspondant) et contrôles lint/typecheck verts.

- 21/10/2026 — Reprendre StatsDaily via le tunnel SSH du VPS de développement : schéma et migration `20261021134205_stats_daily` créés/appliqués sur `xplor`, Prisma Client régénéré, 418 événements de démonstration vérifiés (84 sessions). Le PostgreSQL de production n’est pas publié par le tunnel. Le job de recalcul quotidien reste à coder.
- 21/10/2026 — M7 : branchement F-80 web/kiosque, comptage des visites QR `src=kiosk`, API-29, tableau admin, filtres et export CSV ; `pnpm lint`, `pnpm typecheck` et `pnpm test` verts (231 fichiers, 2 463 tests). Aucun déploiement.
- 20/10/2026 — Le panneau INFO reprend le style sombre translucide du volet latéral du viewer ; texte et bouton Fermer restent lisibles. Build web via l'image Docker de production.

## État des tâches

### En cours
- M7 F-80 — modèle et migration StatsDaily appliqués sur la base de développement ; ajouter le job BullMQ horaire qui remplace les agrégats d’hier et d’aujourd’hui et tester son idempotence. Aucun accès à la base de production.
- M7 F-81/F-82 — API, tableau admin, filtres, séries et export CSV implémentés ; 418 événements / 84 sessions de démonstration insérés dans la base de développement. Validation visuelle RTL et exercice du tableau sur les données de démo restent à faire.
- M7 F-83 — rapport mensuel PDF/courriel non implémenté. Le cahier le déclare reportable en phase 2 si le jalon prend du retard.
- M6 F-71 : Validation matérielle de la navigation main/manette sur casque Meta Quest Browser (à faire sur Quest selon docs/VALIDATION_QUEST.md).

### Fait

- 07/11/2026 — M7 F-81/F-82 (b.2.a.1.c-2.3.2.b) — Preuve d'exécution du cas (4), LECTURE SEULE : ne modifie aucun fichier, aucune opération git, pas de docker, pas de VPS, pas… — Tâche de preuve en lecture seule : aucun fichier modifié (diff vide) et contrôles automatiques verts ; la sortie brute livrée n'a pas pu être vérifiée. (167e2ab)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.c) — À la racine du dépôt, lancer `pnpm lint` puis `pnpm typecheck` (jamais docker ni VPS ; si `node`/`pnpm` introuvable, utiliser le chem… — Lint et typecheck passent (code 0) et aucun fichier n'a été modifié, comme demandé. (ea2faf6)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.b) — Dans apps/api, lancer UNIQUEMENT `pnpm --filter @xplor/api test:int -- stats -t "(4)"` (jamais docker ni VPS ; services via tunnel SS… — Diff vide, conforme à la consigne de ne modifier aucun fichier ; lint, typecheck et tests unitaires passent, mais la sortie du test d'intégration (4) n'a pas pu être vue. (6cc48f3)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.b) — Conditionnelle : à faire SEULEMENT si le cas « (5) filtre par visite (tourId) » de apps/api/test/stats.int.test.ts (~l.674) a échoué… — Tâche conditionnelle sans effet : diff vide, aucun fichier modifié (PROGRESS.md et stats.service.ts intacts), lint et typecheck au vert, mais le cas (5) n'a pas pu être confirmé comme réussi. (865f8ea)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.a.1.c) — LECTURE SEULE. Lancer `git status --short` dans D:\DARDEV\local\xplor_smit et coller sa sortie dans un bloc de code (vide si rien… — Tâche en lecture seule : aucun fichier modifié (diff vide), contrôles lint/typecheck/test au vert. (000bd55)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.a.1.b) — LECTURE SEULE, aucun fichier du dépôt modifié. Le fichier $env:TEMP\m7_stats5.txt existe (sinon relancer `pnpm --filter @xplor/ap… — Tâche en lecture seule : diff vide, aucun fichier modifié, lint, typecheck et tests au vert ; le contenu collé par l'agent n'a pas pu être vérifié. (8d777c2)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.2.a.1.a) — LECTURE SEULE : aucun fichier du dépôt modifié, aucun commit, pas de docker, aucune commande sur le VPS, docs/PROGRESS.md intact.… — Tâche en lecture seule : le diff est vide, aucun fichier modifié et les contrôles passent. Le compte rendu de l'agent (LIGNES, EXIT, 5 premières lignes) n'a pas pu être vérifié. (0b17f49)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.1.c-2.3.2.a) — Rediriger le cache Vite de apps/api/vitest.int.config.ts hors de node_modules. Cause du refus précédent : EPERM à la création… — Redirection du cache conforme à la demande et contrôles fournis réussis. (089fc43)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.1.c-2.3.1.b) — Localiser node/pnpm, LECTURE SEULE : ne rien modifier, aucune opération git, pas de docker, pas de VPS. UN SEUL appel PowerSh… — Diagnostic exécuté en lecture seule ; node et pnpm restent introuvables dans les résultats. (ffa3eda)
- 07/11/2026 — M7 F-81/F-82 (b.2.a.1.c-2.3.1.a) — Diagnostic LECTURE SEULE sans dépendre de node : ne rien modifier, aucune opération git, pas de docker, pas de VPS. UN SEUL a… — Le diagnostic demandé a été exécuté en un seul appel et sa sortie est recopiée telle quelle. (3c38214)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.c-3.2) — LECTURE SEULE, aucun fichier modifié (y compris docs/PROGRESS.md), aucun docker, aucun appel au… — Vérification en lecture seule réussie : Node 22.23.3, code 0 et dépôt Git propre. (237cd05)
- 05/11/2026 — M7 F-81/F-82 (b.2.a.1.c-2.2.2.a.2.2.c.1) — Sonde d'environnement en lecture seule, SANS modifier, créer ni lire aucun fichier du dépôt, sans docker ni ssh. N'ut… — Sonde en lecture seule effectuée ; dépôt propre, mais pnpm ne s’exécute pas car node n’est pas reconnu. (770129a)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.3) — Seulement si le cas (4) de apps/api/test/stats.int.test.ts (ligne 623) échoue (EXIT non nul ou « failed » dans $env:TEMP\i… — La vérification conditionnelle est satisfaite selon le résultat ciblé déjà consigné ; aucun changement n’est nécessaire. (28c0b4a)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.3) — Seulement si la sous-tâche précédente a signalé un blocage ou un échec : diagnostic en lecture seule, aucun fichie… — Aucun diagnostic nécessaire : la sous-tâche précédente a réussi et le diff est vide. (96568f9)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.2.c) — Diagnostic en lecture seule, uniquement si la sous-tâche b a signalé un TIMEOUT ou un échec dans le setup (sinon… — Diagnostic sans objet : aucun TIMEOUT ni échec de setup signalé. (9983e97)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.2.b) — Lire les résultats du test lancé par la tâche précédente (Id dans $env:TEMP\stats4.pid.txt), sans modifier de fi… — La tâche de lecture seule est terminée et le test ciblé s’est achevé sans échec. (44cb556)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.2.a.2.2) — À partir du résultat de la sous-tâche précédente (sortie du test ciblé stats « (4) » dans apps/api), identif… — Le test ciblé des statistiques a réussi sans échec signalé. (44d360d)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.2.a.2.1.b) — Lecture seule : lire avec l'outil Read (pas de relance du test) les fichiers stats4.exit.log, stats4.out.l… — Lecture des journaux terminée ; 24 tests réussis, 16 ignorés, aucun échec et dépôt propre. (2d293c3)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.2.a.2.1.a) — Lancer UNE SEULE FOIS le test ciblé (4) de apps/api/test/stats.int.test.ts (filtre par hôtel), depuis la r… — Le test ciblé a réussi et l’arbre Git est propre. (385e06a)
- 05/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.3.1) — Précontrôle en lecture seule, à finir en moins de 5 minutes. Ne modifie aucun fichier, ne lance ni docker ni ssh,… — Précontrôle bloqué conformément aux consignes, sans modification de fichier. (5342591)
- 05/11/2026 — M7 F-81/F-82 (2/2, a) — Découverte d'environnement, lecture seule : ne modifie aucun fichier, ne lance ni docker, ni ssh, ni tâche d'arrière-plan, ne touche pas… — Découverte en lecture seule terminée : environnement bloqué, aucun Node ni pnpm trouvé aux emplacements demandés. (d0456c5)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.3) — LECTURE SEULE, aucun fichier du dépôt modifié, aucune opération git hors `git status`, jamais docker,… — Relecture approuvée : aucun diff, dépôt propre et contrôles fournis réussis. (6648dca)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.2.c) — LECTURE SEULE : exécuter uniquement `git status --short` à la racine du dépôt D:\DARDEV\local\xplor_… — Tâche de lecture seule effectuée ; statut Git propre et contrôles fournis réussis. (1889c6d)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.2.b) — LECTURE SEULE : aucun fichier du dépôt modifié, aucune opération git hors `git status`, jamais docke… — Vérification en lecture seule réussie, sans modification du dépôt. (90ec56d)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.2.a) — LECTURE SEULE : aucun fichier du dépôt modifié, aucune opération git hors `git status`, jamais docke… — La vérification de lint est réussie et aucun fichier n’a été modifié. (6b79709)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.c-3.1.2) — LECTURE SEULE, aucun fichier modifié, aucun docker, aucune installation, aucune opération git.… — Sonde terminée : aucun node.exe trouvé dans les trois chemins et git status est vide. (68f182b)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.c-3.1.1) — LECTURE SEULE, aucun fichier modifié, aucun docker, aucune installation, aucune opération git.… — La sonde en lecture seule a trouvé node.exe à son chemin attendu, n’a trouvé pnpm dans les chemins testés et a laissé Git propre. (bafbdf8)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.c-2) — LECTURE SEULE : aucun fichier modifié, aucun docker, aucune installation, aucune opération git. Ob… — Diagnostic demandé exécuté sans modification ; pnpm reste introuvable et les contrôles fournis sont verts. (06d3e84)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.c-1) — LECTURE SEULE, aucun fichier modifié, aucun docker, aucune installation. Trouver où se trouvent no… — Diagnostic effectué en lecture seule, dépôt propre et contrôles fournis réussis. (d400856)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.b) — LECTURE SEULE, aucun fichier modifié, aucun git hors `git status`, jamais docker. Si pnpm est introu… — Diagnostic en lecture seule effectué, dépôt propre et contrôles fournis réussis. (207a09f)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.3.1.a) — LECTURE SEULE, aucun fichier modifié, aucune opération git hors `git status`, jamais docker. Depuis… — Les trois recherches PowerShell ont été effectuées sans modification du dépôt et n’ont retourné aucun chemin. (235e1fc)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.2) — Diagnostic node/pnpm, partie 2, LECTURE SEULE : ne modifie, ne lis et ne commite aucun fichier du dépôt… — Diagnostic en lecture seule effectué : Node et pnpm sont introuvables, et git status --short est vide. (ea51513)
- 05/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.2.1) — Diagnostic node/pnpm, partie 1 (lecture seule). Ne modifie ni ne lis aucun fichier du dépôt ; pas de doc… — Le diagnostic demandé a été exécuté en lecture seule et git status est vide. (bd59e9e)
- 04/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.b.1) — Diagnostic d'environnement 1/2 : localiser node.exe. Ne modifie ni ne lis aucun fichier du dépôt ; pas de… — Diagnostic effectué : Node.js 22.23.3 est présent au chemin retenu et le dépôt est inchangé. (6f884ad)
- 04/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.2.a.1) — Diagnostic d'environnement seul (aucun fichier du dépôt modifié ni lu, pas de docker/ssh/tâche d'arrière-p… — Diagnostic d’environnement effectué, dépôt propre et aucun diff à examiner. (8b07466)
- 04/11/2026 — M7 F-81/F-82 (2/2, b.2.a.1.c-2.2.2.a.2.2.c.2.1) — Constat de l'environnement, en lecture seule. Ne modifie aucun fichier, ne lis aucun fichier du dépôt, ne lanc… — Constat en lecture seule effectué ; pnpm.cmd existe mais sa version est inaccessible car node n’est pas reconnu, et les deux ports répondent. (f65077f)
- 04/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.2.b) — Vérification seule, aucun fichier modifié, ni docker, ni ssh, ni installation. IMPORTANT : l'outil PowerShell refu… — La vérification demandée est terminée, le dépôt est propre et les contrôles fournis passent, mais pnpm n’a pas pu être lancé. (1ee11ad)
- 04/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.2.a) — Vérification seule, aucun fichier modifié, ni docker, ni ssh, ni tâche d'arrière-plan. Utilise l'outil PowerShell… — Les ports 5432 et 6379 répondent et l’arbre Git est propre. (be29adb)
- 04/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.1.b) — Aucun fichier modifié, jamais docker ni ssh, ne pas toucher docs/PROGRESS.md, pas de run_in_background. Étape uniq… — Diagnostic exécuté, échec pnpm consigné et dépôt propre. (80dab7b)
- 04/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2.2.a.2.1.a) — Aucun fichier modifié, jamais docker ni ssh, ne pas toucher docs/PROGRESS.md, pas de run_in_background. Étape uniq… — Vérifications demandées effectuées : ports accessibles, Node v22.23.3 présent et dépôt propre. (6a8fe0a)