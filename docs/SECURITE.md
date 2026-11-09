# Synthèse de Sécurité OWASP Top 10 (2021) — Projet Xplor

> **Référence :** Cahier des charges Xplor v2.0 — Exigence non fonctionnelle **NF-01 Sécurité** et jalon **M8 — Durcissement & pilote**.  
> **Dernière mise à jour :** 09/11/2026.

Ce document dresse l'état des mesures de sécurité mises en œuvre sur la plateforme Xplor au regard des 10 catégories de l'**OWASP Top 10 (2021)**. Chaque mesure est étayée par ses preuves dans le code source et les suites de tests automatisées (localisées via Grep). Lorsque les exigences de NF-01 ne sont pas intégralement couvertes dans le code actuel, un écart explicite (« écart : … ») est consigné.

---

## 1. Tableau de synthèse OWASP Top 10 (2021)

| Catégorie OWASP | Intitulé | Mesures en place dans Xplor | Preuve Code (chemins trouvés avec Grep) | Preuve Test (chemins trouvés avec Grep) | Statut |
|---|---|---|---|---|---|
| **A01:2021** | **Broken Access Control** (Rupture du contrôle d'accès) | • Matrice RBAC centralisée `AccessPolicy` pour rôles `ADMIN`, `HOTEL_MANAGER`, `EDITOR`, `PARTNER`.<br>• Protection des routes back-office par `SessionGuard` et `CsrfGuard`.<br>• Isolation multi-tenant stricte : un gestionnaire ou partenaire de l'hôtel A ne peut ni voir ni modifier les ressources de l'hôtel B.<br>• Accès aux visites publiques restreint au jeton `shareToken` aléatoire avec `publicShare: true`. | • `apps/api/src/auth/access-policy.ts`<br>• `apps/api/src/auth/session.guard.ts`<br>• `apps/api/src/auth/csrf.guard.ts`<br>• `apps/api/src/hotels/hotels.service.ts`<br>• `apps/api/src/hotels/hotel-managers.service.ts`<br>• `apps/api/src/hotels/selection.service.ts`<br>• `apps/api/src/catalog/assets.service.ts`<br>• `apps/api/src/viewer/public-tours.service.ts` | • `apps/api/src/auth/access-policy.test.ts`<br>• `apps/api/src/auth/session.guard.test.ts`<br>• `apps/api/src/auth/csrf.guard.test.ts`<br>• `apps/api/src/hotels/hotels.service.test.ts`<br>• `apps/api/src/hotels/hotel-managers.service.test.ts`<br>• `apps/api/src/hotels/selection.service.test.ts`<br>• `apps/api/src/catalog/assets.service.test.ts`<br>• `apps/api/src/viewer/public-tours.service.test.ts` | Conforme |
| **A02:2021** | **Cryptographic Failures** (Défaillances cryptographiques) | • Mots de passe hachés en Argon2id (`@node-rs/argon2`, profil OWASP : 19 MiB mémoire, 2 passes, 1 thread).<br>• Hash fictif `DUMMY_PASSWORD_HASH` à temps constant contre l'énumération par timing attacks.<br>• Jetons kiosque aléatoires 256 bits (`randomBytes(32)` base64url) stockés uniquement sous forme d'empreinte SHA-256 (`tokenHash`), révocables (`tokenHash: null`).<br>• Code PIN de maintenance haché en Argon2id.<br>• Aucun secret ni jeton dans les réponses d'API, manifestes ou journaux d'audit.<br>• HTTPS/TLS 1.3 avec HSTS en production via Caddy. | • `apps/api/src/auth/password.service.ts`<br>• `apps/api/src/auth/dummy-password.ts`<br>• `apps/api/src/kiosks/kiosk-secrets.ts`<br>• `apps/api/src/kiosks/kiosks.service.ts`<br>• `apps/api/src/kiosks/manifest-builder.ts`<br>• `deploy/caddy/Caddyfile` | • `apps/api/src/auth/password.service.test.ts`<br>• `apps/api/src/auth/auth.service.test.ts`<br>• `apps/api/src/kiosks/kiosk-secrets.test.ts`<br>• `apps/api/src/kiosks/kiosks.service.test.ts`<br>• `apps/api/src/kiosks/manifest-builder.test.ts` | Conforme |
| **A03:2021** | **Injection** (Injections SQL, XSS, etc.) | • Neutralisation des injections SQL par Prisma ORM avec requêtes typées et paramétrées.<br>• Requêtes brutes partition/stats/santé construites exclusivement avec templates tagués `Prisma.sql` / `$executeRaw` sans concaténation.<br>• Validation systématique des entrées API par schémas Zod partagés (`packages/shared`).<br>• Rendu React et DOM sécurisé : (1) apps/admin/src/pages/TourPublicationPanel.tsx:225 utilise dangerouslySetInnerHTML pour afficher un SVG de QR code généré en interne (pas de contenu utilisateur) ; (2) apps/web/src/info-panel.ts:29 fait innerHTML = bodyHtml, où le contenu est d'abord passé par escapeHtml défini dans apps/web/src/text-html.ts (voir aussi apps/web/src/share-html.ts).<br>• **écart :** aucun assainissement HTML des descriptions (type sanitize-html ou DOMPurify) n'est implémenté côté API (exigence NF-01 et spécification section 5.2 Tour `description : Texte riche (HTML filtré, voir NF-01)`) ; les descriptions sont validées en tant que `LocalizedText` (texte brut/JSON) et le rendu les échappe via le mécanisme `escapeHtml` (testé dans `apps/web/src/text-html.test.ts`), mais le filtrage HTML strict côté API reste à développer. | • `apps/api/src/events/events-partition.service.ts`<br>• `apps/api/src/events/stats.service.ts`<br>• `apps/api/src/health/health.probes.ts`<br>• `packages/shared/src/catalog.ts`<br>• `packages/shared/src/auth.ts`<br>• `packages/shared/src/hotel.ts`<br>• `apps/admin/src/pages/TourPublicationPanel.tsx`<br>• `apps/web/src/info-panel.ts`<br>• `apps/web/src/text-html.ts` | • `apps/api/src/events/events-partition.service.test.ts`<br>• `apps/api/src/events/stats.service.test.ts`<br>• `apps/api/src/health/health.probes.test.ts`<br>• `packages/shared/src/catalog.test.ts`<br>• `packages/shared/src/auth.test.ts`<br>• `packages/shared/src/hotel.test.ts`<br>• `apps/web/src/text-html.test.ts` | Écart identifié (assainissement HTML) |
| **A04:2021** | **Insecure Design** (Conception non sécurisée) | • Conformité loi marocaine 09-08 (CNDP) et *Privacy by Design* : zéro donnée personnelle voyageur collectée.<br>• Aucune adresse IP persistée dans la table `Event` d'analytique.<br>• Limitation de débit anonyme via empreinte SHA-256 éphémère dans Redis avec expiration TTL sans stockage de l'IP brute.<br>• Architecture Zero-Trust pour les kiosques avec authentification par jeton porteur (`KioskTokenGuard`).<br>• Validation des bornes temporelles des événements ingérés (rejet au-delà de 24 h dans le futur). | • `apps/api/src/events/events-rate-limit.ts`<br>• `apps/api/src/events/events-ingest.service.ts`<br>• `apps/api/src/kiosks/kiosk-token.guard.ts`<br>• `apps/api/src/auth/access-policy.ts` | • `apps/api/src/events/events-rate-limit.test.ts`<br>• `apps/api/src/events/events-ingest.service.test.ts`<br>• `apps/api/src/kiosks/kiosk-token.guard.test.ts`<br>• `apps/api/src/auth/access-policy.test.ts` | Conforme |
| **A05:2021** | **Security Misconfiguration** (Mauvaise configuration de sécurité) | • En-têtes HTTP configurés via `@fastify/helmet` et `@fastify/cors` dans `registerHttpSecurity` :<br>&nbsp;&nbsp;- CSP stricte : `default-src: ["'none'"]`, `frame-ancestors: ["'none'"]`, aucun `'unsafe-inline'`.<br>&nbsp;&nbsp;- HSTS : `max-age=15552000; includeSubDomains`.<br>&nbsp;&nbsp;- `x-content-type-options: nosniff`.<br>&nbsp;&nbsp;- CORS restreint aux origines Xplor (`https://admin.xplor.ma`, etc.).<br>• Zéro secret dans le dépôt : `.env` et `.env.*` ignorés dans `.gitignore` ; `.env.example` et `.env.production.example` fournis avec valeurs d'exemple.<br>• Démarrage protégé par validation stricte des variables d'environnement Zod (`apps/api/src/config/env.ts`).<br>• Caddyfile durci en production (`deploy/caddy/Caddyfile`). | • `apps/api/src/http-security.ts`<br>• `apps/api/src/config/env.ts`<br>• `.gitignore`<br>• `deploy/caddy/Caddyfile` | • `apps/api/src/http-security.test.ts`<br>• `apps/api/src/config/env.test.ts` | Conforme |
| **A06:2021** | **Vulnerable and Outdated Components** (Composants vulnérables et obsolètes) | • Contrôle automatisé des vulnérabilités de dépendances par `pnpm audit --audit-level=high` dans la CI GitHub Actions (`.github/workflows/ci.yml`).<br>• Arborescence de dépendances verrouillée via `pnpm-lock.yaml`.<br>• Dépendances nouvelles consignées et motivées dans `docs/DECISIONS.md`.<br>• Overrides de sécurité ciblés dans `package.json` sous `pnpm.overrides` (décisions D-60 et D-140). | • `.github/workflows/ci.yml`<br>• `package.json`<br>• `docs/DECISIONS.md` | • Étape `Audit` du workflow GitHub Actions (`.github/workflows/ci.yml`)<br>• Commande locale `pnpm audit --audit-level=high` (code retour 0) | Conforme |
| **A07:2021** | **Identification and Authentication Failures** (Défaillances d'identification et d'authentification) | • Hachage des mots de passe en Argon2id (`apps/api/src/auth/password.service.ts`).<br>• Authentification à deux facteurs TOTP (RFC 6238) avec activation, vérification, challenge au login et obligation stricte pour le rôle `ADMIN` (`AdminTwoFactorGuard`).<br>• Protection anti-bruteforce via `@nestjs/throttler` (5 requêtes / minute) sur `/auth/login`, `/auth/login-2fa`, `/auth/forgot`, `/auth/accept-invitation` (renvoie HTTP 429).<br>• Limitation de débit sur le PIN kiosque (5/min) et l'enrôlement (10/min) (`apps/api/src/kiosks/kiosk-device.controller.ts`).<br>• Sessions Redis sécurisées par cookies signés `HttpOnly`, `SameSite`, `Secure` et protection CSRF par jeton (`CsrfGuard`). | • `apps/api/src/auth/password.service.ts`<br>• `apps/api/src/auth/two-factor.service.ts`<br>• `apps/api/src/auth/auth.controller.ts`<br>• `apps/api/src/auth/session-cookie.ts`<br>• `apps/api/src/auth/session.guard.ts`<br>• `apps/api/src/auth/csrf.guard.ts`<br>• `apps/api/src/kiosks/kiosk-device.controller.ts` | • `apps/api/src/auth/password.service.test.ts`<br>• `apps/api/src/auth/two-factor.service.test.ts`<br>• `apps/api/src/auth/auth.controller.test.ts`<br>• `apps/api/src/auth/session-cookie.test.ts`<br>• `apps/api/src/auth/session.guard.test.ts`<br>• `apps/api/src/auth/csrf.guard.test.ts`<br>• `apps/api/src/kiosks/kiosk-device.controller.test.ts` | Conforme |
| **A08:2021** | **Software and Data Integrity Failures** (Manque d'intégrité du logiciel et des données) | • Téléversements directs sécurisés par signature cryptographique HMAC SHA-256 de l'URL (`signUploadToken`, `verifyUploadToken` avec `timingSafeEqual`).<br>• Vérification des uploads par signature binaire : lecture de l'en-tête (octets 0-65535) via `getRange` et `readImageDimensions` (`image-size`) dans `assets.service.ts`, rejet en 422 avec le code `INVALID_FORMAT` (« Dimensions illisibles ») si la signature ou les dimensions sont illisibles.<br>• Authentification d'appareil kiosque basée sur l'empreinte SHA-256 du jeton 256 bits.<br>• Intégrité des données entrantes garantie par les schémas Zod partagés (`packages/shared`).<br>• Décodage et contrôle géométrique des panoramas via `sharp` dans le worker.<br>• **écart :** le type détecté n'est pas comparé à image/jpeg (`dimensions.type` n'est pas contrôlé dans `assets.service.ts`, seul le MIME déclaré `head.contentType ?? asset.mimeType` passe par `validatePanoramaUpload`). | • `apps/api/src/catalog/jpeg-dimensions.ts`<br>• `apps/api/src/catalog/assets.service.ts`<br>• `apps/api/src/storage/storage.utils.ts`<br>• `apps/api/src/storage/storage.controller.ts`<br>• `apps/api/src/kiosks/kiosk-secrets.ts`<br>• `packages/shared/src/panorama-rules.ts`<br>• `apps/worker/src/derivatives/panorama.derivatives.ts` | • `apps/api/src/catalog/jpeg-dimensions.test.ts`<br>• `apps/api/src/catalog/assets.service.test.ts`<br>• `apps/api/src/storage/storage.controller.test.ts`<br>• `apps/api/src/kiosks/kiosk-secrets.test.ts`<br>• `packages/shared/src/panorama-rules.test.ts`<br>• `apps/worker/src/derivatives/panorama.derivatives.test.ts` | Écart identifié (type détecté non comparé à image/jpeg) |
| **A09:2021** | **Security Logging and Monitoring Failures** (Défaillances de journalisation et de surveillance) | • Modèle `AuditLog` (F-91) persistant en base PostgreSQL chaque action sensible (connexions, rôles, publications, sélections hôtel, kiosques).<br>• Occultation des données sensibles : `passwordHash`, `token` et `tokenHash` strictement exclus des diffs d'audit.<br>• Endpoint d'interrogation du journal d'audit `GET /admin/audit` (API-30) protégé pour rôle `ADMIN`.<br>• Surveillance de santé système `GET /api/health` (NF-04) sondant PostgreSQL, Redis et stockage MinIO avec délai maximal de 2 000 ms.<br>• Rotation des journaux Docker en production (`docker-compose.prod.yml`, ancre `x-logging`, 10 Mo x 3 fichiers, décision D-139). | • `apps/api/prisma/schema.prisma`<br>• `apps/api/src/audit/audit.service.ts`<br>• `apps/api/src/audit/audit-recorder.ts`<br>• `apps/api/src/audit/audit-query.service.ts`<br>• `apps/api/src/audit/audit.controller.ts`<br>• `apps/api/src/health/health.probes.ts`<br>• `apps/api/src/health/health.controller.ts`<br>• `docker-compose.prod.yml` | • `apps/api/src/audit/audit.service.test.ts`<br>• `apps/api/src/audit/audit-query.service.test.ts`<br>• `apps/api/src/audit/audit.controller.test.ts`<br>• `apps/api/src/kiosks/kiosks.service.test.ts`<br>• `apps/api/src/health/health.probes.test.ts`<br>• `apps/api/src/health/health.controller.test.ts` | Conforme |
| **A10:2021** | **Server-Side Request Forgery** (SSRF) | • Confinement strict des requêtes sortantes de l'API et du worker : aucune URL fournie par l'utilisateur n'est requêtée.<br>• Communication S3/MinIO bornée au point de terminaison interne configuré statiquement via `STORAGE_ENDPOINT` / `STORAGE_BUCKET`.<br>• Envoi de courriels restreint au serveur SMTP configuré statiquement (`apps/api/src/mail/mail.service.ts`).<br>• Aucun moteur de webhook ni appel réseau dynamique vers des cibles externes. | • `apps/api/src/storage/storage.service.ts`<br>• `apps/api/src/mail/mail.service.ts`<br>• `apps/api/src/config/env.ts` | • `apps/api/src/storage/storage.service.test.ts`<br>• `apps/api/src/mail/mail.service.test.ts`<br>• `apps/api/src/config/env.test.ts` | Conforme |

---

## 2. Détail des mesures et preuves techniques par catégorie

### A01:2021 — Broken Access Control (Contrôle d'accès)

#### Mesures en place
1. **Contrôle d'accès basé sur les rôles (RBAC) :** La classe `AccessPolicy` centralise les règles d'autorisation pour chaque rôle de la plateforme :
   - `ADMIN` : accès global à toutes les ressources, configuration des kiosques, journal d'audit et gestion des utilisateurs.
   - `HOTEL_MANAGER` : gestion limitée aux visites, sélections et kiosques rattachés à son hôtel.
   - `EDITOR` : création et édition du catalogue de visites globales sans accès aux données des hôtels.
   - `PARTNER` : consultation restreinte aux visites attribuées.
2. **Isolation multi-tenant hôtel A / hôtel B :** Tous les services applicatifs (`HotelsService`, `HotelManagersService`, `SelectionService`, `AssetsService`) filtrent systématiquement par identifiant d'hôtel (`hotelId`). Un gestionnaire associé à l'hôtel A reçoit un code HTTP `404 Not Found` s'il tente d'accéder à l'hôtel B.
3. **Protection des routes d'administration :**
   - `SessionGuard` vérifie l'existence et la validité de la session Redis associée au cookie.
   - `CsrfGuard` valide le jeton anti-CSRF transmis dans l'en-tête `x-csrf-token` pour toute méthode mutante (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Visites publiques :** L'accès anonyme aux visites virtuelles exige un jeton unique `shareToken` et le drapeau `publicShare: true`.

#### Preuves Code & Tests
- `apps/api/src/auth/access-policy.ts` (lignes 1-120)  
  *Test :* `apps/api/src/auth/access-policy.test.ts`  
  - `it("un gestionnaire de l'hôtel A ne voit pas l'hôtel B")`
  - `it("un partenaire de l'hôtel A ne voit pas l'hôtel B")`
- `apps/api/src/hotels/hotels.service.ts`  
  *Test :* `apps/api/src/hotels/hotels.service.test.ts`  
  - `it("gestionnaire de l’hôtel A ne voit pas l’hôtel B (list et get)")`
- `apps/api/src/hotels/hotel-managers.service.ts`  
  *Test :* `apps/api/src/hotels/hotel-managers.service.test.ts`  
  - `it("un gestionnaire de l’hôtel A reçoit 404 sur list de l’hôtel B")`
- `apps/api/src/hotels/selection.service.ts`  
  *Test :* `apps/api/src/hotels/selection.service.test.ts`  
  - `it("un gestionnaire de l’hôtel A reçoit 404 sur get de l’hôtel B")`
- `apps/api/src/catalog/assets.service.ts`  
  *Test :* `apps/api/src/catalog/assets.service.test.ts`  
  - `it("un gestionnaire de l'hôtel A ne voit pas les visites de l'hôtel B")`
- `apps/api/src/auth/session.guard.ts` & `apps/api/src/auth/csrf.guard.ts`  
  *Tests :* `apps/api/src/auth/session.guard.test.ts` et `apps/api/src/auth/csrf.guard.test.ts`

---

### A02:2021 — Cryptographic Failures (Défaillances cryptographiques)

#### Mesures en place
1. **Hachage Argon2id :** Hachage des mots de passe utilisateurs via `@node-rs/argon2` avec l'algorithme `Argon2id` et les paramètres recommandés par l'OWASP (mémoire : 19 456 Kio (~19 MiB), 2 passes temporelles, 1 fil d'exécution).
2. **Mitigation de l'énumération d'utilisateurs à temps constant :** `dummy-password.ts` fournit une constante `DUMMY_PASSWORD_HASH` hachée avec les mêmes paramètres. Si l'identifiant n'existe pas en base, une vérification réelle est exécutée sur ce faux hash afin de garantir un temps de réponse identique et d'empêcher les attaques temporelles.
3. **Jetons kiosque 256 bits hachés et révocables :**
   - `generateDeviceToken()` génère 32 octets aléatoires cryptographiques (`crypto.randomBytes(32)`), encodés en `base64url` (256 bits d'entropie).
   - Le jeton en clair n'est affiché qu'une seule fois lors de l'enrôlement.
   - La base de données ne stocke que l'empreinte SHA-256 hexadécimale via `hashDeviceToken(token)`.
   - La révocation est immédiate en positionnant `tokenHash: null`.
4. **PIN de maintenance d'hôtel :** Haché avec Argon2id en base et vérifié via `argon2Verify(hotel.maintenancePinHash, pin)`.
5. **Non-divulgation des données sensibles :** Les schémas Zod d'API, le constructeur de manifeste de kiosque (`manifest-builder.ts`) et les diffs d'audit excluent formellement `token`, `tokenHash` et `passwordHash`.

#### Preuves Code & Tests
- `apps/api/src/auth/password.service.ts` & `apps/api/src/auth/dummy-password.ts`  
  *Tests :* `apps/api/src/auth/password.service.test.ts` ("hache en argon2id puis vérifie") et `apps/api/src/auth/auth.service.test.ts` (vérification dummy)
- `apps/api/src/kiosks/kiosk-secrets.ts` (lignes 1-25)  
  *Tests :* `apps/api/src/kiosks/kiosk-secrets.test.ts`  
  - `it("génère des jetons aléatoires de 256 bits encodés en base64url")`
  - `it("calcule une empreinte SHA-256 déterministe distincte du jeton")`
- `apps/api/src/kiosks/kiosks.service.ts`  
  *Tests :* `apps/api/src/kiosks/kiosks.service.test.ts`  
  - PIN Argon2id validé / refusé (lignes 790-805)
  - Diff d'audit sans `token` ni `tokenHash` (lignes 896-926)
- `apps/api/src/kiosks/manifest-builder.ts`  
  *Test :* `apps/api/src/kiosks/manifest-builder.test.ts` (`expect(manifest.kiosk).not.toHaveProperty('tokenHash')`)

---

### A03:2021 — Injection (Injections SQL, XSS, etc.)

#### Mesures en place
1. **Injections SQL :**
   - Prisma ORM paramètre toutes les requêtes de manipulation de données (`findUnique`, `findMany`, `create`, `update`, etc.).
   - Pour les requêtes brutes requises par les partitions d'événements, les statistiques ou les sondes de santé, l'API utilise strictement les templates tagués `Prisma.sql` et `$executeRaw`/`$queryRaw` garantissant la séparation de la commande SQL et des paramètres.
2. **Validation stricte des DTOs :** Les entrées HTTP sont filtrées via les schémas Zod partagés (`packages/shared`), rejetant les structures inattendues et empêchant les attaques par pollution de prototype ou injection de paramètres.
3. **Prévention XSS front-end :**
   - Back-office (`apps/admin`) : composant React 19 échappant automatiquement tout contenu textuel injecté dans le JSX ; (1) apps/admin/src/pages/TourPublicationPanel.tsx:225 utilise dangerouslySetInnerHTML pour afficher un SVG de QR code généré en interne (pas de contenu utilisateur).
   - Visionneuse (`apps/web`, `packages/viewer-core`) : interface sans framework manipulant les éléments principalement via les APIs DOM sûres (`textContent`, `setAttribute`) ; (2) apps/web/src/info-panel.ts:29 fait innerHTML = bodyHtml, où le contenu est d'abord passé par escapeHtml défini dans apps/web/src/text-html.ts (voir aussi apps/web/src/share-html.ts).
4. **Écart identifié sur NF-01 :**
   > [!WARNING]
   > **Écart NF-01 (Assainissement HTML) :** Aucun assainissement HTML des descriptions (type `sanitize-html` ou `DOMPurify`) n'est implémenté côté API. L'exigence NF-01 (« HTML utilisateur assaini ») et la spécification section 5.2 Tour (`description : Texte riche (HTML filtré, voir NF-01)`) ne disposent pas encore de filtre actif à l'enregistrement. Actuellement, les descriptions sont stockées en texte JSON brut (`LocalizedText`) et le rendu est sécurisé par le mécanisme d'échappement `escapeHtml` (défini dans `apps/web/src/text-html.ts`, couvert par le test existant `apps/web/src/text-html.test.ts`) : (1) apps/admin/src/pages/TourPublicationPanel.tsx:225 utilise dangerouslySetInnerHTML pour afficher un SVG de QR code généré en interne (pas de contenu utilisateur) ; (2) apps/web/src/info-panel.ts:29 fait innerHTML = bodyHtml, où le contenu est d'abord passé par escapeHtml défini dans apps/web/src/text-html.ts (voir aussi apps/web/src/share-html.ts). La sanitisation HTML stricte côté backend reste un écart à traiter.

#### Preuves Code & Tests
- `apps/api/src/events/events-partition.service.ts` : `this.prisma.$executeRaw`SELECT create_event_partition(${date}::date)``  
  *Test :* `apps/api/src/events/events-partition.service.test.ts`
- `apps/api/src/events/stats.service.ts` : requêtes `$queryRaw` paramétrées avec `Prisma.sql`  
  *Test :* `apps/api/src/events/stats.service.test.ts`
- `apps/api/src/health/health.probes.ts` : `this.prisma.$queryRaw`SELECT 1``  
  *Test :* `apps/api/src/health/health.probes.test.ts`
- `packages/shared/src/catalog.ts` & `packages/shared/src/auth.ts`  
  *Tests :* `packages/shared/src/catalog.test.ts` et `packages/shared/src/auth.test.ts`
- `apps/admin/src/pages/TourPublicationPanel.tsx:225` (`dangerouslySetInnerHTML` pour SVG de QR code interne)
- `apps/web/src/info-panel.ts:29` (`innerHTML = bodyHtml`)
- `apps/web/src/text-html.ts` (`escapeHtml`)  
  *Test :* `apps/web/src/text-html.test.ts` (`it("escapes HTML characters")`)

---

### A04:2021 — Insecure Design (Conception non sécurisée)

#### Mesures en place
1. **Respect strict de la loi marocaine 09-08 (CNDP) :**
   - Aucune donnée à caractère personnel (nom, prénom, courriel, téléphone, etc.) de voyageur n'est collectée sur les kiosques ou la visionneuse web.
   - Les événements d'analytique (`Event`) n'enregistrent jamais l'adresse IP des visiteurs.
2. **Limitation de débit anonyme respectueuse de la vie privée :**
   - `EventsRateLimitService` calcule une empreinte SHA-256 éphémère de l'adresse IP cliente pour constituer la clé Redis (`anon_events:rate:<sha256>`).
   - L'adresse IP brute n'est jamais journalisée ni stockée en base de données.
   - Les clés expirent automatiquement dans Redis après la fenêtre de temps configurée (30 secondes).
3. **Zero-Trust Kiosque :**
   - Chaque kiosque doit s'enrôler avec un code éphémère et s'authentifier par jeton porteur dédié (`KioskTokenGuard`).
   - Le statut du kiosque (`ACTIVE`, `SUSPENDED`) est vérifié à chaque interaction avec l'API.
4. **Validation temporelle :** Rejet des événements horodatés à plus de 24 heures dans le futur pour éviter l'empoisonnement des statistiques d'usage.

#### Preuves Code & Tests
- `apps/api/src/events/events-rate-limit.ts` (lignes 1-80)  
  *Test :* `apps/api/src/events/events-rate-limit.test.ts`  
  - `it("utilise un hash SHA-256 de l'IP sans la persister")`
  - `it("expireCalls avec EVENTS_ANON_RATE_LIMIT_WINDOW_SECONDS")`
- `apps/api/src/events/events-ingest.service.ts`  
  *Test :* `apps/api/src/events/events-ingest.service.test.ts`  
  - `it("rejette un événement situé à plus de 24 h dans le futur")`
- `apps/api/src/kiosks/kiosk-token.guard.ts`  
  *Test :* `apps/api/src/kiosks/kiosk-token.guard.test.ts`
- `apps/api/src/auth/access-policy.ts`  
  *Test :* `apps/api/src/auth/access-policy.test.ts`

---

### A05:2021 — Security Misconfiguration (Mauvaise configuration)

#### Mesures en place
1. **En-têtes HTTP de sécurité (`http-security.ts`) :**
   - Configuration centralisée via `@fastify/helmet` et `@fastify/cors`.
   - **Content-Security-Policy (CSP) :** politique stricte par défaut `default-src: ["'none'"]` et `frame-ancestors: ["'none'"]`, sans directive permissive `'unsafe-inline'`.
   - **HSTS :** `Strict-Transport-Security: max-age=15552000; includeSubDomains` (180 jours avec sous-domaines).
   - **MIME Sniffing :** `X-Content-Type-Options: nosniff` systématiquement présent.
   - **CORS :** restreint explicitement aux origines déclarées (domaines Xplor officiels tels que `https://admin.xplor.ma`, `https://v.xplor.ma`) avec `credentials: true`. Les origines tierces inconnues ne reçoivent aucun en-tête d'autorisation.
2. **Absence de secrets dans le dépôt :**
   - Le fichier `.gitignore` ignore `.env` et `.env.*`, à l'exception des modèles `.env.example` et `.env.production.example`.
   - Les gabarits d'environnement ne contiennent aucun mot de passe ou jeton de production.
3. **Validation de l'environnement au démarrage :**
   - `apps/api/src/config/env.ts` applique un schéma Zod validant tous les paramètres obligatoires (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.).
   - En cas de variable manquante ou mal formatée, le processus s'arrête immédiatement (*fail-fast*).
4. **Configuration de production Caddy :**
   - `deploy/caddy/Caddyfile` force HTTPS avec TLS 1.3 et applique les en-têtes de sécurité sur tous les sous-domaines (`api.xplor.ma`, `admin.xplor.ma`, `v.xplor.ma`).

#### Preuves Code & Tests
- `apps/api/src/http-security.ts` (lignes 1-25)  
  *Test :* `apps/api/src/http-security.test.ts`  
  - `it("(1) inclut strict-transport-security avec max-age")`
  - `it("(2) inclut content-security-policy stricte sans unsafe-inline (default-src 'none'...)")`
  - `it("(3) inclut x-content-type-options: nosniff")`
  - `it("(4) une requête avec Origin: https://admin.xplor.ma reçoit access-control-allow-origin égal à cette origine")`
  - `it("(5) une requête avec Origin: https://evil.example ne reçoit pas d'access-control-allow-origin")`
- `apps/api/src/config/env.ts`  
  *Test :* `apps/api/src/config/env.test.ts` (validation Zod et arrêt immédiat si configuration invalide)
- `.gitignore` (lignes 4-7)
- `deploy/caddy/Caddyfile`

---

### A06:2021 — Vulnerable and Outdated Components (Composants vulnérables)

#### Mesures en place
1. **Audit automatisé dans la CI :**
   - Le pipeline d'intégration continue GitHub Actions (`.github/workflows/ci.yml`) intègre une étape bloquante :
     ```yaml
     - name: Audit
       run: pnpm audit --audit-level=high
     ```
   - Tout paquet présentant une vulnérabilité de sévérité `high` ou `critical` bloque la fusion sur `develop` et `main`.
2. **Verrouillage strict des versions :**
   - `pnpm-lock.yaml` garantit la reproductibilité absolue des dépendances sur toutes les machines et environnements.
3. **Traçabilité des dépendances :**
   - Règle stricte dans `AGENTS.md` : chaque nouvelle dépendance npm doit être documentée dans `docs/DECISIONS.md` avec sa justification et sa licence.
4. **Gestion des correctifs de vulnérabilités amont :**
   - Overrides de sécurité configurés dans la section `pnpm.overrides` du fichier `package.json` racine.
   - Décisions de sécurité documentées : **D-60** (overrides initiaux) et **D-140** (résolution ciblée des vulnérabilités de transition M8).

#### Preuves Code & Tests
- `.github/workflows/ci.yml` (lignes 235-236)
- `package.json` (bloc `pnpm.overrides`)
- `docs/DECISIONS.md` (sections `D-60` et `D-140`)
- *Vérification opérationnelle :* `pnpm audit --audit-level=high` s'exécute avec succès (code de retour 0).

---

### A07:2021 — Identification and Authentication Failures (Identification et authentification)

#### Mesures en place
1. **Algorithme de mot de passe robuste :** Utilisation d'Argon2id conforme aux exigences de l'OWASP Password Storage Cheat Sheet.
2. **Authentification multifacteur (2FA TOTP) :**
   - Implémentation basée sur le standard RFC 6238 via `two-factor.service.ts`.
   - Secrets chiffrés et validation de jetons à 6 chiffres avec tolérance de dérive temporelle de ±1 pas (30 secondes).
   - Activation obligatoire pour le rôle `ADMIN` vérifiée par `AdminTwoFactorGuard` (`apps/api/src/auth/admin-two-factor.guard.ts`) et alertes d'activation dans le back-office (`AccountSecurityPage.tsx`).
3. **Limitation de débit (@nestjs/throttler) :**
   - Décorateur `@Throttle(FIVE_PER_MINUTE)` et garde `ThrottlerGuard` appliqués aux routes sensibles :
     - `/auth/login` (5 tentatives / min)
     - `/auth/login-2fa` (5 tentatives / min)
     - `/auth/forgot` (5 demandes / min)
     - `/auth/accept-invitation` (5 tentatives / min)
   - Renvoie automatiquement une erreur HTTP `429 Too Many Requests` au 6e échec.
   - Limitation sur les kiosques : enrôlement limité à 10 requêtes / min, vérification de PIN limitée à 5 requêtes / min.
4. **Gestion de session et CSRF :**
   - Identifiants de session cryptographiques opaques générés côté serveur et stockés dans Redis avec délai d'expiration (TTL).
   - Cookies transmis avec `HttpOnly`, `SameSite=Lax` (ou `None` en environnement cross-origin HTTPS) et `Secure`.
   - Protection CSRF obligatoire sur toutes les routes authentifiées via `CsrfGuard`.

#### Preuves Code & Tests
- `apps/api/src/auth/password.service.ts`  
  *Test :* `apps/api/src/auth/password.service.test.ts`
- `apps/api/src/auth/two-factor.service.ts`  
  *Test :* `apps/api/src/auth/two-factor.service.test.ts`
- `apps/api/src/auth/auth.controller.ts` (décorateurs `@Throttle` et `@UseGuards(ThrottlerGuard)`)  
  *Test :* `apps/api/src/auth/auth.controller.test.ts`  
  - `describe('Limitation de débit sur /auth/login (NF-01)')`
  - `it("bloque la 6e requête avec 429 après 5 échecs consécutifs avec de mauvais identifiants")`
  - `it("répond 202 pour forgot, limité à 5 par minute")`
  - `it("protège accept-invitation par ThrottlerGuard (5/min)")`
- `apps/api/src/auth/session-cookie.ts` & `apps/api/src/auth/session.guard.ts`  
  *Tests :* `apps/api/src/auth/session-cookie.test.ts` et `apps/api/src/auth/session.guard.test.ts`
- `apps/api/src/kiosks/kiosk-device.controller.ts`  
  *Test :* `apps/api/src/kiosks/kiosk-device.controller.test.ts` (contrôle des limites Throttler à 10/min et 5/min)

---

### A08:2021 — Software and Data Integrity Failures (Intégrité des données)

#### Mesures en place
1. **Signature cryptographique des URLs de téléversement :**
   - Les téléversements directs de médias (panoramas 360°, vignettes) sont signés par HMAC SHA-256 via `signUploadToken` (`storage.utils.ts`).
   - Le point de terminaison de téléversement valide la signature à l'aide de `crypto.timingSafeEqual` (`verifyUploadToken`) pour éviter les attaques temporelles. Toute altération du jeton entraîne un rejet immédiat `403 Forbidden`.
2. **Vérification des téléversements par signature binaire et validation géométrique :**
   - La vérification des téléversements par signature binaire existe : lors de la finalisation du téléversement (`complete` dans `apps/api/src/catalog/assets.service.ts`), le serveur récupère les 65 536 premiers octets du média via `this.storage.getRange(asset.originalKey, 0, 65535)` et les transmet à `readImageDimensions` (`apps/api/src/catalog/jpeg-dimensions.ts`).
   - La fonction `readImageDimensions` inspecte les signatures binaires d'en-tête (via `image-size`) et extrait la largeur, la hauteur ainsi que le type d'image détecté (`dimensions.type`).
   - Lorsque les dimensions ou la signature sont illisibles (`dimensions === null`), l'API répond immédiatement par une erreur HTTP 422 avec le code `INVALID_FORMAT` (`message: 'Dimensions illisibles'`).
   - Les dimensions et le ratio d'aspect équirectangulaire sont validés par `validatePanoramaUpload` (`packages/shared/src/panorama-rules.ts`).
3. **Intégrité des appareils kiosques :**
   - Comparaison d'empreintes SHA-256 déterministes pour authentifier l'appareil sans stocker le jeton révocable original.
4. **Validation et traitement des médias par le Worker :**
   - Le worker (`apps/worker`) valide les dimensions minimales (4096 px), le ratio d'aspect équirectangulaire (2:1 ±1 %) et le format via `sharp`. Si le fichier est altéré ou non décodable, le job échoue et la scène n'est pas publiée.
5. **Écart identifié sur NF-01 :**
   > [!WARNING]
   > **Écart NF-01 (Type détecté non comparé à image/jpeg) :** `dimensions.type` n'est pas contrôlé dans `assets.service.ts`, seul le MIME déclaré (`head.contentType ?? asset.mimeType`) passe par `validatePanoramaUpload`. Il existe un seul écart : le type détecté n'est pas comparé à image/jpeg.

#### Preuves Code & Tests
- `apps/api/src/catalog/jpeg-dimensions.ts` (`readImageDimensions`)  
  *Test :* `apps/api/src/catalog/jpeg-dimensions.test.ts`  
  - `it("lit les dimensions d'un vrai JPEG")` (vérification de `{ width: 4096, height: 2048, type: 'jpg' }` sur les 65 536 premiers octets)
  - `it("renvoie null pour un buffer invalide (aléatoire)")`
  - `it("renvoie null pour un buffer vide ou trop court")`
- `apps/api/src/catalog/assets.service.ts` (`getRange 0-65535` vers `readImageDimensions`, réponse 422 avec le code `INVALID_FORMAT` quand les dimensions sont illisibles)  
  *Test :* `apps/api/src/catalog/assets.service.test.ts`  
  - `describe("createUploadUrl")` : `it("refuse d’emblée un panorama qui n’est pas un JPEG")` (ligne 461, rejet 422 avec code `INVALID_FORMAT` testant le MIME déclaré `image/png`, pas la lecture de signature)
  - `describe("complete")` : `it("met en file un panorama 4096x2048 conforme")`
  - *(le chemin de `complete` avec réponse HTTP 422 `INVALID_FORMAT` pour « Dimensions illisibles » lorsque `dimensions === null` n'a pas de test dédié dans `assets.service.test.ts` ; le renvoi de `null` par `readImageDimensions` pour un buffer corrompu ou vide est couvert par `apps/api/src/catalog/jpeg-dimensions.test.ts`)*
- `apps/api/src/storage/storage.utils.ts` (lignes 1-45) & `apps/api/src/storage/storage.controller.ts`  
  *Test :* `apps/api/src/storage/storage.controller.test.ts`  
  - `it("devrait échouer avec une signature falsifiée")` (vérification du code 403 Forbidden)
- `apps/api/src/kiosks/kiosk-secrets.ts`  
  *Test :* `apps/api/src/kiosks/kiosk-secrets.test.ts`
- `packages/shared/src/panorama-rules.ts` (`validatePanoramaUpload`)  
  *Test :* `packages/shared/src/panorama-rules.test.ts`
- `apps/worker/src/derivatives/panorama.derivatives.ts`  
  *Test :* `apps/worker/src/derivatives/panorama.derivatives.test.ts`

---

### A09:2021 — Security Logging and Monitoring Failures (Journalisation et surveillance)

#### Mesures en place
1. **Journal d'audit applicatif F-91 (`AuditLog`) :**
   - Modèle Prisma dédié `AuditLog` dans PostgreSQL enregistrant les opérations sensibles :
     - Connexions et déconnexions.
     - Créations, modifications et désactivations d'utilisateurs.
     - Attribution et révocation de rôles.
     - Publication et dépublication de visites virtuelles.
     - Modifications des sélections d'hôtels.
     - Enrôlement, suspension et révocation de kiosques.
   - Les informations consignées comprennent l'identifiant de l'acteur (`userId` ou `kioskId`), l'action, l'entité concernée (`entityType`, `entityId`), l'adresse IP et un diff structuré en JSON.
2. **Sanitisation stricte des journaux :**
   - Les mots de passe en clair, les hashs de mot de passe (`passwordHash`) et les empreintes de jetons (`token`, `tokenHash`) sont formellement filtrés avant écriture du diff JSON d'audit.
3. **Endpoint d'interrogation d'audit (API-30) :**
   - Point de terminaison `GET /admin/audit` réservé aux administrateurs avec filtres par action, type d'entité, intervalle de dates et pagination.
4. **Sonde de surveillance système NF-04 (`/api/health`) :**
   - Endpoint `GET /api/health` exécutant des sondes actives sur :
     - La base de données PostgreSQL (`SELECT 1`).
     - Le cache Redis (`PING`).
     - Le stockage d'objets MinIO / S3 (`headBucket`).
   - Timeout strict de 2 000 ms ; renvoie HTTP 200 en cas de succès et HTTP 503 en cas d'indisponibilité d'un composant critique.
5. **Rotation des journaux de production :**
   - Définition de l'ancre `x-logging` dans `docker-compose.prod.yml` appliquant le pilote `json-file` avec taille maximale de 10 Mo et rotation sur 3 fichiers (décision D-139).

#### Preuves Code & Tests
- `apps/api/prisma/schema.prisma` (modèle `AuditLog`, lignes 467-483)
- `apps/api/src/audit/audit.service.ts` & `apps/api/src/audit/audit-recorder.ts`  
  *Test :* `apps/api/src/audit/audit.service.test.ts`
- `apps/api/src/audit/audit-query.service.ts` & `apps/api/src/audit/audit.controller.ts`  
  *Tests :* `apps/api/src/audit/audit-query.service.test.ts` et `apps/api/src/audit/audit.controller.test.ts`
- `apps/api/src/kiosks/kiosks.service.ts`  
  *Test :* `apps/api/src/kiosks/kiosks.service.test.ts` (lignes 896-926 : vérification que `token` et `tokenHash` n'apparaissent pas dans le diff d'audit)
- `apps/api/src/health/health.probes.ts` & `apps/api/src/health/health.controller.ts`  
  *Tests :* `apps/api/src/health/health.probes.test.ts` et `apps/api/src/health/health.controller.test.ts`
- `docker-compose.prod.yml` (ancre `x-logging`)

---

### A10:2021 — Server-Side Request Forgery (SSRF)

#### Mesures en place
1. **Absence d'appels HTTP arbitraires initiés par le serveur :**
   - Aucun endpoint de la plateforme Xplor n'accepte d'URL externe fournie par l'utilisateur pour en télécharger le contenu ou l'analyser.
   - Les médias sont soit importés via des scripts d'administration locaux pré-approuvés, soit téléversés directement par le client vers le bucket S3 via des URLs présignées signées par HMAC.
2. **Bornage strict des services externes :**
   - Les communications avec le service de stockage d'objets MinIO / S3 sont cantonnées au client AWS S3 SDK configuré avec les variables d'environnement système statiques (`STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`).
   - L'envoi de courriels (invitations, réinitialisation de mot de passe) transite exclusivement par le transporteur SMTP statique (`apps/api/src/mail/mail.service.ts`).
3. **Réseau interne isolé en production :**
   - Les conteneurs de services (Postgres, Redis, MinIO) résident sur un réseau Docker interne privé non exposé directement sur l'Internet public ; seul le reverse proxy Caddy écoute sur les ports 80/443.

#### Preuves Code & Tests
- `apps/api/src/storage/storage.service.ts` (configuration statique S3 SDK)  
  *Test :* `apps/api/src/storage/storage.service.test.ts`
- `apps/api/src/mail/mail.service.ts` (configuration statique SMTP)  
  *Test :* `apps/api/src/mail/mail.service.test.ts`
- `apps/api/src/config/env.ts` (validation Zod des endpoints d'infrastructure)  
  *Test :* `apps/api/src/config/env.test.ts`

---

## 3. Synthèse des écarts identifiés par rapport à NF-01

Conformément à la règle de transparence du projet Xplor et à l'état réel du code audité au jalon M8, les deux écarts suivants sont consignés :

1. **Assainissement HTML des descriptions (A03 / NF-01) :**
   - *Exigence NF-01 :* « HTML utilisateur assaini ».
   - *Constat dans le code :* Les descriptions de visites sont acceptées comme structures `LocalizedText` (texte brut/JSON) sans passer par un module de nettoyage/sanitisation HTML dédié (ex. `sanitize-html` ou `DOMPurify`). Concernant le rendu front-end : (1) apps/admin/src/pages/TourPublicationPanel.tsx:225 utilise dangerouslySetInnerHTML pour afficher un SVG de QR code généré en interne (pas de contenu utilisateur) ; (2) apps/web/src/info-panel.ts:29 fait innerHTML = bodyHtml, où le contenu est d'abord passé par escapeHtml défini dans apps/web/src/text-html.ts (voir aussi apps/web/src/share-html.ts), ce mécanisme d'échappement `escapeHtml` étant couvert par le test existant `apps/web/src/text-html.test.ts`. Un assainissement strict des chaînes riches en amont dans l'API reste à implémenter.
2. **Contrôle du type MIME détecté par signature binaire (A08 / NF-01) :**
   - *Exigence NF-01 :* « uploads vérifiés par signature ».
   - *Constat dans le code :* La vérification des téléversements par signature binaire existe : `assets.service.ts` inspecte les 65 536 premiers octets (`getRange 0-65535`) via `readImageDimensions` (`jpeg-dimensions.ts`), rejetant en HTTP 422 avec le code `INVALID_FORMAT` (« Dimensions illisibles ») tout fichier dont la signature binaire ou les dimensions sont illisibles. En revanche, `dimensions.type` n'est pas contrôlé dans `assets.service.ts`, seul le MIME déclaré (`head.contentType ?? asset.mimeType`) passe par `validatePanoramaUpload`. Il subsiste un seul **écart : le type détecté n'est pas comparé à image/jpeg**.
