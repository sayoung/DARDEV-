# Suivi — Xplor

## Jalon en cours : M5 — Hôtels & kiosque

Exigences : F-50 à F-54, F-60 à F-67, API-01 à 03, API-26/27

Livrable : Démo 2 : kiosque de test enrôlé, fonctionnant réseau coupé

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

DoD M5 remplie : non

Jalon précédent : M4 validé par le porteur ; détail dans docs/archive/PROGRESS-M4.md

## Session en cours

## État des tâches

### En cours
- Aucun.

### Fait

- 14/10/2026 — M5 F-50/API-26 (4/5) Tests d'intégration des hôtels : créer apps/api/test/hotels.int.test.ts en suivant le style de apps/api/test/catalog.int.test.ts (même mise… — Tests d'intégration des hôtels complets et conformes à la demande ; hotelIds chargés en session et 422 brandColor justifiés, lint/typecheck/test OK (test:int non prouvé par les contrôles fournis). (355eecf)
- 14/10/2026 — M5 F-50/API-26 (3/5) Contrôleur et module des hôtels : créer apps/api/src/hotels/hotels.controller.ts (route admin/hotels, @UseGuards(SessionGuard, CsrfGuard),… — Contrôleur et module des hôtels conformes (gardes session+CSRF, écriture ADMIN seul, lecture via service filtré), enregistrés dans AppModule, testés, D-115 consignée ; contrôles verts. (b16c304)
- 14/10/2026 — M5 F-50 (2/5) Service des hôtels : créer apps/api/src/hotels/hotels.service.ts (module à créer plus tard) en suivant le style de apps/api/src/catalog/cities.ser… — Service des hôtels conforme : périmètre par hôtel, 404 sans fuite, suppression logique, vérifications ville/logo en 422, réponse sans hash, tests présents et contrôles verts. (1791329)
- 14/10/2026 — M5 F-50 (1/5) Schémas partagés des hôtels : créer packages/shared/src/hotel.ts et l'exporter depuis packages/shared/src/index.ts. Zod : HotelStarsSchema (FOUR|F… — Schémas Zod des hôtels conformes à la demande (validation, refine des dates, hasMaintenancePin sans hash), exportés depuis index.ts, tests présents et contrôles verts. (8d39ed9)
- 14/10/2026 — M5 Bilan (ouverture du jalon) : tâche de bilan autorisée, seuls fichiers modifiables docs/PROGRESS.md et docs/archive/PROGRESS-M4.md (nouveau). Copier intégrale… — Archive PROGRESS-M4.md créée et en-tête M5 de PROGRESS.md réécrit conformément à la demande, seuls les deux fichiers autorisés modifiés, contrôles au vert. (b0ada82)