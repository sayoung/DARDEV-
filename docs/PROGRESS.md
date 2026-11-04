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

- 04/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.c) — Restituer la seconde moitié du journal `%TEMP%\unit.log` (lignes ceil(N/2)+1 à N, N étant le nombre total de lignes, à rec… — Extraction complète et contrôles fournis réussis ; le dépôt est propre. (dce4ded)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.4.3) — Lecture seule : aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le journal %TEMP%\unit.log exi… — Extraction des lignes 671–733 et mesure du journal effectuées conformément à la demande. (bdb0664)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.4.2) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le journal %TEMP%\unit.log exis… — La plage demandée a été extraite sans relancer les tests ni modifier le dépôt. (e98aa6f)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.4.1) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le journal %TEMP%\unit.log exis… — La commande demandée a été exécutée une seule fois et sa sortie a été restituée. (70ecd52)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.3) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le journal %TEMP%\unit.log existe… — Extraction en lecture seule terminée et contrôles fournis réussis ; le journal contient 1 287 lignes, contrairement aux 1 466 annoncées. (fa8a1b4)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.2) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le journal %TEMP%\unit.log existe… — L’extrait demandé du journal a été affiché intégralement et les contrôles fournis passent. (d6239c9)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.1.c) — Lecture seule : aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test, ne rien analyser ni corriger.… — Comptage confirmé à 1518 et lignes 93 à 184 affichées. (b759249)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.1.b) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Le fichier %TEMP%\unit.log exis… — Les lignes 1 à 92 du journal ont été restituées en deux plages sans relancer les tests. (a596ab7)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.b.1.a) — Lecture seule, aucune modification du dépôt, pas de docker, ne PAS relancer pnpm test. Exécuter en PowerShell : Test-P… — Le journal existe et a été mesuré ; les valeurs obtenues (1518 lignes, 119021 caractères) diffèrent des valeurs attendues indiquées. (ec7f78e)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.a.2) — Mesurer le journal `$env:TEMP\unit.log` produit par la tâche précédente (ne pas relancer `pnpm test` sauf si le fichier… — Mesure effectuée : code 0, 235 fichiers et 2524 tests passés, dépôt propre. (8ce86d3)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.3.a.1) — Lancer `pnpm test` en arrière-plan SANS attendre en direct, sans modifier aucun fichier du dépôt et sans docker. En Powe… — Tâche de vérification terminée sans modification du dépôt; pnpm test est indiqué réussi. (234486e)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.2) — Sorties complètes de `pnpm lint` et `pnpm typecheck`. Ne modifier aucun fichier (ni docs/PROGRESS.md, ni le cas (5), ni Stat… — Tâche conforme : lint et typecheck réussis, aucun fichier modifié. (061c851)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-2.1.a) — Vérification de l'infrastructure avant la preuve du cas (4) de apps/api/test/stats.int.test.ts. Aucun fichier à lire ni à… — Vérification effectuée : les ports PostgreSQL et Redis répondent, mais aucune variante de pnpm n’est disponible. (a766b68)
- 03/11/2026 — M7 F-81/F-82 (1/4, b.2.a.1.c-1) — Cas (4) de stats.int.test.ts. Modifier UNIQUEMENT apps/api/test/stats.int.test.ts, dans le cas (4) « filtre par hôtel (hotelId… — Diff ciblé correct et conforme à la demande, contrôles fournis verts. (93658f7)
- 26/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.b.1) — Modifier UNIQUEMENT apps/admin/src/pages/TourForm.test.tsx (aucune opération git, aucun autre fichier, pas de docker, ne l… — Les quatre mocks /scenes sont présents au bon endroit et les contrôles fournis passent. (c99e57f)
- 25/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.a.2.2.2) — LECTURE SEULE, aucun fichier du dépôt modifié, ni git (hors `git status`), ni docker. Lance le test ciblé et recopie l… — Le test ciblé réussit avec 10 tests passés et le dépôt reste propre. (2885539)
- 25/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.a.2.2.1.3) — LECTURE SEULE. Vérifier que le test apps/admin/src/pages/TourForm.test.tsx est lançable, sans le corriger. Avec des… — Le test TourForm est lançable et ses 10 tests passent. (77e0008)
- 25/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.a.2.2.1.2) — LECTURE SEULE. Créer le journal de diagnostic et vérifier qu'il est ignoré, avec des appels PowerShell SÉPARÉS, un s… — Le fichier de diagnostic existe et est ignoré par Git ; aucun écart n’est visible. (97cfcdd)
- 25/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.a.2.2.1.1) — LECTURE SEULE, aucun fichier suivi modifié, aucune opération git hors `git status`, pas de docker. Détecter pnpm ave… — La vérification demandée est effectuée : pnpm est indisponible et aucun des replis ne fonctionne. (fc5731d)
- 25/10/2026 — M7 F-81/F-82 (1/4, b.2.a.1.b.1.a.2.1) — Contrôle d'environnement SANS édition de fichier du dépôt, sans git ni docker, sans aucun test. Depuis la racine D:\DARD… — Le contrôle d’environnement a été exécuté et ses échecs d’accès à pnpm et à TEMP sont rapportés. (97ba46c)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.c) — Corriger le cas (3) de apps/api/test/stats.int.test.ts (agrégats complets : totaux, séries journalières, histogramme horaire, classe… — Aucune correction n’était nécessaire : le cas (3) passe déjà et le diff est vide. (1423bbe)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.b) — Corriger dans apps/api/test/stats.int.test.ts les cas (1) 401 et (2) 403 s'ils échouent (corriger le test, pas le service, sauf bug… — Les cas (1) et (2) sont déjà couverts et leur réussite est consignée ; aucun fichier n’a été modifié. (624eb5f)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.2.3) — Diagnostic seul, lecture seule, aucun fichier modifié, aucune opération git d'écriture. Pour chaque échec relevé dans $env:TEMP\… — Diagnostic terminé : aucun échec dans les cas (1), (2) ou (3) ; 24 tests réussis. (fe88e1a)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.2.2.2) — Diagnostic seul, lecture seule : lire $env:TEMP\stats-int.log (produit par la sous-tâche précédente ; s'il est absent, vide ou… — Diagnostic du journal terminé ; les cas 2 et 3 réussissent, le cas 1 n’est pas documenté. (655d9b0)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.2.2.1.2) — Contrôler et citer le log $env:TEMP\stats-int.log produit par la sous-tâche précédente. Aucune modification de fichier du dé… — Log vérifié : 24 tests passés, aucun échec ni test sauté, et les alias SQL du diff sont cohérents. (5f839bc)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.2.2.1.1.c) — Lire le log des tests d'intégration stats, en lecture seule (aucune modification, aucune opération git d'écriture, jamais… — La vérification en lecture seule du journal de repli est faite, mais il ne contient ni résultat de test ni code de sortie. (1b7df4c)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.2.2.1.1.a) — Rendre Node accessible et vérifier l'environnement, SANS rien modifier (aucun fichier suivi, aucune opération git d'écritu… — Vérification en lecture seule terminée selon la branche d’arrêt prévue, les deux ports répondent. (d5de9c3)
- 24/10/2026 — M7 F-81/F-82 (1/4, b.1.a.1) — Diagnostic d'environnement SEUL : ne modifier aucun fichier du dépôt (ni docs/PROGRESS.md), aucune opération git d'écriture, jamai… — Le diagnostic demandé est terminé sans modification du dépôt; le tunnel PostgreSQL répond, mais pnpm et Node sont introuvables dans cet environnement. (56c93fd)
- 24/10/2026 — M7 F-81/F-82 (1/4, a) — Reprendre dans apps/api/test/stats.int.test.ts le fichier de la branche non fusionnée agent/20261024-105440-m7-f-81-f-82-1-4-creer-apps-… — Correctif sûr et conforme à la tâche. (9317452)
- 23/10/2026 — M7 F-80 (2/2, b.3) — Câbler le job StatsDaily dans apps/worker/src/main.ts. Prérequis : stats-daily-repository.ts et stats-daily.job.ts sont fusionnés. Calque l… — Câblage StatsDaily et couverture des cas d’arrêt conformes à la tâche. (dd90916)
- 23/10/2026 — M7 F-80 (2/2, b.2) — Reprendre le job horaire StatsDaily. Prérequis : stats-daily-repository.ts est fusionné. Depuis la branche agent/20261023-165242-m7-f-80-2-… — Le job StatsDaily et ses tests répondent aux exigences de la tâche. (236f2b9)
- 23/10/2026 — M7 F-80 (2/2, b.1) — Reprendre le dépôt StatsDaily. Depuis la branche agent/20261023-165242-m7-f-80-2-2-b-reprendre-le-depot-statsda (lecture seule : `git show… — Le dépôt et ses tests répondent à la tâche, sans défaut bloquant relevé. (3fbdb6b)
- 23/10/2026 — M7 F-80 (2/2, a) — Reprendre l'agrégation pure et définir l'attribution des sessions. Lis d'abord docs/DECISIONS.md (grep StatsDaily, session). Récupère depuis… — L’agrégation et ses tests sont cohérents avec la règle demandée et le modèle Prisma, et les contrôles fournis passent. (c24d0e4)
- 21/10/2026 — M7 F-80 : branche la collecte aux parcours web et kiosque (session, visite, scène, point d’intérêt, audio, langue), avec résistance aux erreurs et file IndexedDB. Le test du kiosque hors ligne est adapté à la nouvelle signature.
- 21/10/2026 — M7 F-81/F-82/API-29 : ajoute les requêtes statistiques filtrées par rôle/hôtel, le tableau admin (indicateurs, courbes journalières, histogramme horaire, classements, langues/canaux), l’export CSV UTF-8 BOM/`;`, les schémas partagés et OpenAPI.
- 21/10/2026 — M7 démo : ajoute le générateur déterministe d’une semaine d’événements anonymes et la commande `stats:demo`, protégée par `--confirm-dev` et refusée en production. Non exécutée faute de PostgreSQL local.
- 20/10/2026 — M7 F-80 : dans apps/web/src, crée `stats.ts` et `stats.test.ts`, sans toucher aux autres fichiers. `stats.ts` expose `startWebStats({ apiBase, getLang })`, qui… — stats.ts et stats.test.ts respectent la spec (canal WEB sans jeton, adaptateurs minces au tracker, erreurs avalées, qrShown inutilisé) et lint/typecheck/tests passent. (e501f6e)
- 20/10/2026 — M7 F-80 : dans packages/viewer-core/src, crée `stats-session.ts` et `stats-session.test.ts` : `createStatsSession({ apiBase, channel, getLang, getToken?, storeF… — stats-session.ts assemble correctement store/sender/batcher/tracker avec flush et destroy résilients, écouteur visibilitychange gardé, tests couvrant les cas demandés, contrôles verts. (c58d384)
- 20/10/2026 — M7 F-80 : dans packages/viewer-core/src, crée `stats-tracker.test.ts` (Vitest, sans DOM) pour `createStatsTracker` de `stats-tracker.ts`. Utilise un batcher fac… — Les tests de createStatsTracker couvrent les 6 points demandés avec des doubles conformes à la consigne; lint, typecheck et test passent et PROGRESS.md n'est pas touché. (f603313)
- 20/10/2026 — M7 F-80 : dans packages/viewer-core/src, crée `stats-tracker.ts` et exporte-le depuis `index.ts` (export de `createStatsTracker` et du type `StatsTracker`). Sig… — stats-tracker.ts implémente createStatsTracker conformément à la spécification (validation eventSchema, aucune exception, durées de scène, sessionId renouvelé), exporté depuis index.ts, lint et typech… (1296bbe)