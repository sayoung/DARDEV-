# Démo M8 — Durcissement & pilote

Ce document décrit la procédure détaillée pour exécuter et valider la démo du **Jalon M8 — Durcissement & pilote** (exigences NF-01 à NF-05, F-90, F-91, API-28 et API-30).

---

## Contexte et objectifs

Le jalon M8 finalise la phase de durcissement technique, de sécurisation et de préparation au déploiement pilote de la plateforme Xplor :
1. **F-90 / NF-01 — Sécurisation des accès et 2FA TOTP** : Authentification renforcée pour le rôle administrateur (RFC 6238, clé secrète chiffrée en AES-256-GCM, dérivation Base32, QR code, validation par challenge à 6 chiffres, protection anti-force brute et verrouillage temporaire).
2. **API-28 — Gestion des utilisateurs** : Annuaire complet des comptes, filtrage par rôle, statut et recherche textuelle, modification du profil et des rôles, affectation exclusive aux hôtels, invitations par courriel sécurisé.
3. **F-91 / API-30 — Journalisation et audit des opérations sensibles** : Traçabilité immuable (`AuditLog`) des connexions, publications, modifications de droits et actions kiosques, consultation filtrée réservée à l'administrateur avec occultation stricte des secrets (mots de passe, tokens, secrets TOTP).
4. **NF-02 — Conformité réglementaire loi 09-08 (CNDP)** : Page légale publique (`/v/legal`), mentions légales et politique de confidentialité en 3 langues, absence totale d'adresse IP et de données nominatives dans les événements analytiques (`Event`).
5. **D-142 — Internationalisation intégrale (fr / ar / en) et mode miroir RTL** : Couverture i18n complète à 100 % des interfaces, bascule instantanée sans rechargement, adaptation RTL fluide (`dir="rtl"`, typographies Montserrat / Comfortaa, propriétés CSS logiques).
6. **NF-03, NF-04, NF-05 — Durcissement non fonctionnel et outillage automatisé** : Sonde de disponibilité `/api/health`, tests d'accessibilité WCAG 2.1 AA via `@axe-core/playwright`, audit de vulnérabilités `pnpm audit` (0 faille high/critical), et scénarios de montée en charge k6 sur environnement non productif.
7. **Recette globale et pilote en hôtel partenaire** : Renvoi formel vers le plan de recette de bout en bout (`docs/RECETTE.md`), le modèle de procès-verbal (`docs/PV_RECETTE.md`) et le protocole de déploiement pilote (`docs/PILOTE.md`) confiés au porteur du projet.

---

## Prérequis

1. **Services de développement** : PostgreSQL, Redis, MinIO et Mailpit tournent sur le VPS et sont joints via le tunnel SSH ouvert par le porteur sur `localhost` (ports 5432, 6379, 9000/9001, 1025/8025).
   > [!CAUTION]
   > **RÈGLE IMPÉRATIVE** : **Ne JAMAIS lancer `docker`, `docker compose` ni Docker Desktop en local.**
2. **Base de données à jour** : Les migrations Prisma doivent être appliquées et le seed initial chargé :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** : Vérifier que le fichier `.env` racine est configuré (voir `.env.example`).
4. **Démarrage des applications de développement** :
   ```powershell
   pnpm dev
   ```
   *(ou démarrez séparément l'API `pnpm --filter @xplor/api dev`, le back-office `pnpm --filter @xplor/admin dev` et la visionneuse web `pnpm --filter @xplor/web dev`)*

   Points d'accès locaux :
   - **API NestJS (Fastify)** : http://localhost:3000 (préfixe `/api/v1`, santé sur `/api/health`)
   - **Back-office Administrateur** : http://localhost:5173
   - **Visionneuse Web publique** : http://localhost:5174
   - **Serveur de messagerie Mailpit** : http://localhost:8025

---

## Étape 1 : Connexion administrateur avec 2FA TOTP (F-90, NF-01)

### 1.1 Connexion initiale et détection de l'absence de 2FA
1. Ouvrez votre navigateur sur http://localhost:5173.
2. Saisissez les identifiants administrateur du seed :
   - **E-mail** : `admin@xplor.local`
   - **Mot de passe** : `xplor-seed-dev-2026` (ou la valeur de `SEED_DEFAULT_PASSWORD` définie dans `.env`)
3. Cliquez sur le bouton de connexion :
   - L'API valide les identifiants et dépose le cookie sécurisé `xplor_sid`.
   - À la première connexion (avant configuration TOTP), un bandeau d'alerte en tête du tableau de bord signale que le compte administrateur requiert l'activation de l'authentification à deux facteurs.
   - Dans le menu latéral de navigation, accédez à la rubrique **Sécurité du compte** (URL `/account/security`).

### 1.2 Activation du 2FA TOTP
1. Sur la page `/account/security`, constatez le statut désactivé du 2FA.
2. Cliquez sur le bouton d'activation :
   - L'API exécute `POST /api/v1/auth/2fa/setup`.
   - Un secret cryptographique aléatoire de 20 octets (encodé en Base32) est généré et stocké de manière chiffrée (AES-256-GCM) dans la colonne `totpSecret` de la table `User`.
   - L'interface affiche le QR code scannable (`otpauth://totp/...`) ainsi que la clé secrète en texte pour saisie manuelle.
3. Avec une application d'authentification (Google Authenticator, Microsoft Authenticator ou tout générateur TOTP RFC 6238) :
   - Scannez le QR code ou renseignez la clé secrète.
   - Saisissez le code à 6 chiffres généré dans le champ prévu à cet effet.
4. Cliquez sur le bouton de validation :
   - L'API appelle `POST /api/v1/auth/2fa/confirm`.
   - Le statut passe immédiatement à activé, un message de confirmation s'affiche, et le bandeau d'alerte disparaît.

### 1.3 Déconnexion et reconnexion avec challenge TOTP
1. Déconnectez-vous via l'action de déconnexion de l'en-tête (`POST /api/v1/auth/logout`).
2. Tentez une nouvelle connexion avec `admin@xplor.local` et `xplor-seed-dev-2026` :
   - L'appel `POST /api/v1/auth/login` répond avec `{ "twoFactorRequired": true }` et établit un cookie de session temporaire restreint (`pending2fa: true`).
   - L'interface bascule sur l'écran de challenge TOTP.
3. Saisissez le code à 6 chiffres actif dans votre application TOTP et validez :
   - L'appel `POST /api/v1/auth/login/2fa` valide le code, détruit la session temporaire, et établit la session complète `xplor_sid`.
   - Vous êtes redirigé vers le tableau de bord avec les pleins droits administrateur.

### 1.4 Rejet des codes erronés et limitation anti-bruteforce
1. Déconnectez-vous à nouveau et revenez sur l'écran du challenge TOTP.
2. Saisissez un code faux (ex. `000000`) et validez :
   - L'API rejette la requête avec un code HTTP 401 `INVALID_CREDENTIALS`.
   - L'interface affiche l'alerte indiquant que le code est invalide.
3. Les soumissions excessives en un temps court sont limitées par le guard `ThrottlerGuard` avec le code HTTP 429 `Too Many Requests`.
4. Après des échecs répétés consécutifs, le compte est temporairement verrouillé (code HTTP 423 `ACCOUNT_LOCKED`), protégeant l'administrateur contre les attaques par force brute.

### 1.5 Désactivation du 2FA
1. Reconnectez-vous avec un code valide.
2. Sur la page `/account/security`, la section affiche le formulaire de désactivation.
3. Saisissez votre code TOTP actuel à 6 chiffres et cliquez sur le bouton de validation :
   - L'API exécute `POST /api/v1/auth/2fa/disable`.
   - Le secret TOTP est supprimé de la base et le statut repasse à désactivé.
*(Pour la suite de la démo, réactivez le 2FA afin de maintenir un environnement durci conforme aux critères M8).*

---

## Étape 2 : Gestion des utilisateurs (API-28)

L'administration des utilisateurs est strictement réservée au rôle `ADMIN` (`canManageUsers`).

### 2.1 Consultation et filtrage de l'annuaire (`/users`)
1. Dans la barre latérale de navigation, cliquez sur **Utilisateurs** (URL `/users`).
2. Observez le tableau des comptes :
   - Colonnes : Nom, E-mail, Rôle, Statut (Actif / Inactif), 2FA, Dernière connexion, Hôtels rattachés.
   - Les comptes initiaux du seed y figurent (`admin@xplor.local`, `editor@xplor.local`, `manager@xplor.local`, `partner@xplor.local`).
3. Testez les filtres dynamiques :
   - **Rôle** : sélectionnez `Gestionnaire d'hôtel` → la liste ne conserve que `manager@xplor.local`.
   - **Statut** : filtrez sur `Actifs uniquement` ou `Inactifs uniquement`.
   - **Recherche textuelle** : saisissez `Rabat` ou `editor` dans le champ de recherche et validez → filtrage immédiat via le paramètre `q`.
   - **Pagination** : contrôlez le fonctionnement des boutons `Précédent` et `Suivant` (`page` / `pageSize`).

### 2.2 Consultation et modification d'une fiche utilisateur (`/users/:id`)
1. Cliquez sur le nom d'un utilisateur (ex. `manager@xplor.local`) pour ouvrir sa fiche détaillée (`/users/:id`).
2. Observez les informations modifiables :
   - Nom complet (`name`).
   - Rôle (`role` : Administrateur, Éditeur, Gestionnaire d'hôtel, Partenaire).
   - Statut actif (`active`).
   - Langue d'interface (`uiLang` : Français, Arabe, Anglais).
   - Établissements rattachés (sélection d'hôtels pour les gestionnaires et partenaires).
3. Modifiez un champ (par exemple le nom ou la langue d'interface), puis cliquez sur le bouton d'enregistrement :
   - L'API traite la mise à jour via `PATCH /api/v1/admin/users/:id`.
   - Si les hôtels rattachés sont modifiés, l'API enregistre les associations via `PUT /api/v1/admin/users/:id/hotels`.
   - Un message confirme le succès de l'enregistrement.

### 2.3 Vérification des gardes-fous et règles de sécurité
1. **Auto-modification d'un administrateur** :
   - Ouvrez votre propre fiche administrateur (`admin@xplor.local`).
   - Tentez de modifier votre propre rôle.
   - L'API rejette l'opération avec un code HTTP 403 Forbidden et le message d'erreur exact :
     > « Un administrateur ne peut pas modifier son propre rôle »
2. **Protection du dernier administrateur actif** :
   - Tentez de désactiver ou rétrograder le dernier administrateur actif de la plateforme.
   - L'API rejette l'opération avec un code HTTP 409 Conflict et le message d'erreur exact :
     > « Impossible de désactiver ou rétrograder le dernier administrateur actif »

### 2.4 Invitation d'un nouvel utilisateur par courriel
1. L'API expose le point d'entrée sécurisé `POST /api/v1/admin/users/invitations` (`UsersController.invite`).
2. Lors de l'envoi d'une invitation (avec nom, e-mail, rôle et langue) :
   - Un jeton cryptographique aléatoire à usage unique est généré (valable 48 heures).
   - Un courriel transactionnel multilingue est expédié vers Mailpit avec le lien direct d'activation : `http://localhost:5173/invite/<jeton>`.
3. Ouvrez Mailpit (http://localhost:8025), visualisez le message reçu et suivez le lien :
   - La page d'activation `/invite/:token` s'ouvre (`SetPasswordPage`).
   - Renseignez un mot de passe conforme (≥ 12 caractères) et validez via le bouton de validation (`POST /api/v1/auth/invite/accept`).
   - Le compte est activé et l'utilisateur peut se connecter immédiatement.

---

## Étape 3 : Journal d'audit filtré (F-91, API-30)

Le journal d'audit (`AuditLog`) garantit la traçabilité complète et infalsifiable des événements sensibles.

### 3.1 Consultation du journal d'audit (`/audit`)
1. Dans le menu latéral de navigation, cliquez sur **Journal d'audit** (URL `/audit`).
2. Observez la liste chronologique des entrées d'audit générées lors des étapes précédentes :
   - `auth.login` : connexions réussies de l'administrateur.
   - `auth.login_failed` : tentatives de mot de passe ou de code TOTP erronés.
   - `user.role_change` : modifications de rôle ou de permissions opérées sur les utilisateurs.
   - Autres actions auditées : `tour.publish`, `tour.unpublish`, `entity.delete`, `kiosk.create`, `kiosk.disable`, `selection.update`.
3. Chaque ligne présente :
   - La date et heure de l'événement.
   - Le badge de l'action (`AUDIT_ACTIONS`).
   - L'identifiant de l'utilisateur initiateur (`userId`).
   - L'entité ciblée (`entityType` et `entityId`).
   - L'adresse IP de l'appelant (`ip`).
   - Le bloc de détail (`diff`) présentant les modifications au format JSON.

### 3.2 Garantie d'occultation des données confidentielles (OWASP A09:2021)
Inspectez les blocs de détail (`diff`) affichés dans le journal :
- Aucun mot de passe en clair, aucun hash d'empreinte, aucun jeton de session opaque ni aucun secret TOTP n'est jamais consigné dans la base d'audit.
- Pour les échecs d'authentification (`auth.login_failed`), seule la raison technique (`reason`) est enregistrée.

### 3.3 Manipulation des filtres d'audit
Testez la réactivité du formulaire de filtrage de l'audit (`GET /api/v1/admin/audit`) :
1. **Filtre Action** : sélectionnez une action (ex. `auth.login_failed`) → seules les tentatives de connexion correspondantes apparaissent.
2. **Filtre Type d'entité** : saisissez `User` → seules les actions relatives aux utilisateurs sont listées.
3. **Filtres temporels** : renseignez les dates `Du` et `Au` pour restreindre la période.
4. **Pagination** : naviguez entre les pages de résultats.

### 3.4 Contrôle d'accès strict
1. Déconnectez-vous et connectez-vous avec un compte Éditeur (`editor@xplor.local`) ou Gestionnaire d'hôtel (`manager@xplor.local`).
2. Constatez que la rubrique **Journal d'audit** n'apparaît pas dans le menu latéral.
3. Tentez d'accéder directement à l'URL http://localhost:5173/audit ou d'émettre une requête `GET /api/v1/admin/audit` :
   - L'accès refusé au journal d'audit est un **403** sans message (`ForbiddenException()` sans corps de texte, `apps/api/src/audit/audit.controller.ts:149`).

---

## Étape 4 : Page légale publique et conformité loi 09-08 CNDP (NF-02)

L'exigence **NF-02** impose le respect de la loi marocaine 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.

### 4.1 Consultation de la page légale publique (`/v/legal`)
1. Ouvrez votre navigateur sur l'application publique web :
   - http://localhost:5174/v/legal
2. Vérifiez que la page s'affiche sans authentification et sans composant lourd (rendu rapide en TypeScript sans framework).
3. Observez les 4 sections obligatoires de mentions légales :
   - **Éditeur du service** : raison sociale, immatriculation et coordonnées de l'éditeur DARDEV / SMIT.
   - **Hébergement** : localisation de l'infrastructure d'hébergement.
   - **Protection des données personnelles (loi 09-08 CNDP)** : mention explicite certifiant qu'aucune donnée à caractère personnel de voyageur n'est collectée, traitée ou cédée.
   - **Contact & réclamations** : formulaire et coordonnées de contact.

### 4.2 Garantie technique d'absence d'adresse IP dans les statistiques
Pour attester techniquement de la conformité au niveau des données :
- Le schéma Prisma (`apps/api/prisma/schema.prisma`) du modèle `Event` ne comporte **aucun champ d'adresse IP** ni aucun identifiant nominatif de voyageur.
- Les événements statistiques sont agrégés de façon anonyme (`StatsDaily`).

### 4.3 Bouton retour contextuel et lien depuis la visite de démonstration
1. Ouvrez la visite virtuelle de démonstration publiée :
   - http://localhost:5174/v/demo-rabat
2. Dans la visionneuse, cliquez sur le lien des mentions légales :
   - La page légale s'ouvre avec le paramètre de provenance : `/v/legal?from=/v/demo-rabat`.
   - Un bouton de retour vers la visite s'affiche en tête de page légale.
3. Cliquez sur le bouton de retour : vous revenez directement sur la visite 360° `/v/demo-rabat`.
4. *(Sécurité anti-redirection ouverte)* : Vérifiez qu'un paramètre externe non sécurisé (ex. `?from=https://evil.example`) est automatiquement ignoré et ne produit aucun bouton retour.

---

## Étape 5 : Internationalisation intégrale (fr / ar / en) et mode miroir RTL (D-142)

Conformément à la décision **D-142**, les 3 langues officielles (`fr`, `ar`, `en`) sont supportées et le mode miroir arabe (RTL) est pleinement opérationnel.

### 5.1 Bascule multilingue sur le back-office
1. Connectez-vous sur http://localhost:5173.
2. Dans l'en-tête, repérez le sélecteur de langue : **FR**, **العربية**, **EN**.
3. Cliquez sur **العربية** :
   - L'attribut racine `document.documentElement` passe à `lang="ar"` et `dir="rtl"`.
   - La barre latérale violette se positionne sur le **côté droit** de l'écran grâce à l'usage des propriétés CSS logiques (`margin-inline-start`, etc.).
   - L'ensemble des libellés du menu et des écrans s'affiche en arabe :
     - *Accueil* → `الرئيسية`
     - *Visites virtuelles* → `الجولات الافتراضية`
     - *Hôtels* → `الفنادق`
     - *Kiosques* → `الأكشاك`
     - *Statistiques* → `الإحصائيات`
     - *Utilisateurs* → `المستخدمون`
     - *Journal d'audit* → `سجل التدقيق`
     - *Sécurité du compte* → `أمان الحساب`
   - Les typographies **Montserrat** et **Comfortaa** assurent le rendu des caractères arabes.
   - Aucun défilement horizontal non désiré (`overflow-x`) n'apparaît.
4. Cliquez sur **EN** puis **FR** pour constater le retour immédiat en mode `dir="ltr"`.

### 5.2 Bascule multilingue et RTL sur la visionneuse web
1. Ouvrez la visionneuse publique sur http://localhost:5174/v/demo-rabat?lang=ar (ou la page légale http://localhost:5174/v/legal?lang=ar).
2. Observez l'affichage complet en arabe de la page légale et des commandes de la visionneuse :
   - Alignement textuel à droite (`direction: rtl`).
   - Volet des lieux et points d'intérêt repositionné en cohérence RTL.
   - Respect des contrastes de couleur de la charte Xplor.

---

## Étape 6 : Commandes automatisées de validation (Axe, RTL, audit et k6)

Cette étape rassemble les commandes de validation automatique du durcissement technique.

### 6.1 Tests d'accessibilité WCAG 2.1 AA et tests e2e RTL
Exécutez la suite de tests Playwright dédiée à l'accessibilité et au rendu RTL :
```powershell
pnpm test:e2e e2e/back-office.spec.ts
pnpm test:e2e e2e/m3-viewer.spec.ts
```
*(ou l'ensemble des scénarios e2e : `pnpm test:e2e`)*

- **Couverture Axe (`@axe-core/playwright`, D-141)** :
  - Page de connexion administrateur (`login`).
  - Tableau de bord complet après connexion (`dashboard`).
  - Visionneuse 360° publique (avec exclusion du canvas WebGL non textuel).
  - Page publique des mentions légales (`/v/legal`).
  - **Critère de succès** : 0 violation d'accessibilité WCAG 2.1 AA détectée.
- **Couverture RTL** :
  - Contrôle de la présence de `dir="rtl"` et `lang="ar"`.
  - Positionnement de la barre latérale à droite.
  - Absence de défilement horizontal.

### 6.2 Audit de sécurité des dépendances (pnpm audit)
Vérifiez l'absence de vulnérabilités critiques dans l'arborescence des paquets npm :
```powershell
pnpm audit --prod --audit-level high
pnpm audit --audit-level high
```
- **Critère attendu** : Code de retour `0` (zéro vulnérabilité de niveau `high` ou `critical`).
- Les vulnérabilités résolues sont verrouillées via `pnpm.overrides` dans `package.json` (décisions D-60 et D-140).

### 6.3 Campagne de tests de performance de charge (k6)
> [!CAUTION]
> **Interdiction formelle de lancer ces tests sur l'environnement de production (`api.xplor.ma`, `admin.xplor.ma`, `v.xplor.ma`) sans autorisation préalable.** Ces tests génèrent une charge importante et doivent être exécutés exclusivement en local ou sur un environnement de test dédié.

Selon le protocole documenté dans [`perf/README.md`](../perf/README.md) et la fiche de suivi [`docs/PERFORMANCE.md`](PERFORMANCE.md) :

1. **Test du manifeste public (`perf/k6/manifest.js`)** :
   ```powershell
   k6 run -e BASE_URL=http://localhost:3000 -e SHARE_TOKEN=demo-rabat perf/k6/manifest.js
   ```
   - **Seuils d'acceptation NF-03** : 95 % des requêtes de manifeste public en moins de 200 ms (`p(95)<200`), taux d'erreur HTTP inférieur à 1 % (`rate<0.01`).
2. **Test d'ingestion massive d'événements (`perf/k6/events.js`)** :
   ```powershell
   k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=mon-jeton-kiosque-local perf/k6/events.js
   ```
   - **Seuils d'acceptation NF-03** : lots de 200 événements traités en moins de 100 ms (`p(95)<100`), taux d'erreur HTTP inférieur à 1 % (`rate<0.01`).
3. **Test des consultations du back-office (`perf/k6/admin-api.js`)** :
   ```powershell
   k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=admin@xplor.local -e ADMIN_PASSWORD=xplor-seed-dev-2026 perf/k6/admin-api.js
   ```
   - **Seuils d'acceptation NF-03** : requêtes de consultation des listes en moins de 300 ms (`p(95)<300`), taux d'erreur HTTP inférieur à 1 % (`rate<0.01`).
   - **Authentification unique** : connexion effectuée une seule fois dans la fonction `setup()` pour respecter le limiteur `ThrottlerGuard`.

---

## Étape 7 : Recette globale et déploiement pilote menés par le porteur

Les opérations formelles de recette contractuelle et de déploiement physique du matériel sur site sont ordonnancées et conduites par le porteur du projet (DARDEV / SMIT) selon les trois documents de référence :

1. **Plan de Recette Fonctionnelle de Bout en Bout** : 👉 [`docs/RECETTE.md`](RECETTE.md)
   - Contient la grille détaillée des **12 scénarios de test transverses (R-01 à R-12)** couvrant la totalité des exigences du cahier des charges (M0 à M8).
2. **Procès-Verbal de Recette Fonctionnelle** : 👉 [`docs/PV_RECETTE.md`](PV_RECETTE.md)
   - Modèle officiel d'attestation de recette avec identification de session, émargement des participants, synthèse des constats et registre des anomalies.
3. **Plan de Déploiement et d'Évaluation du Pilote en Hôtel** : 👉 [`docs/PILOTE.md`](PILOTE.md)
   - Plan-cadre opérationnel d'installation de la borne tactile (spécifications mécaniques, player embarqué, mode kiosque verrouillé), protocole de test en conditions réelles dans l'hôtel partenaire et grille d'évaluation du retour d'expérience voyageur.

---

## Synthèse des points de contrôle pour la recette

| # | Point de contrôle | Résultat attendu | Validé |
|---|---|---|:---:|
| 1 | Connexion admin avec 2FA TOTP (F-90, NF-01) | Activation via QR code RFC 6238, secret chiffré, challenge à la reconnexion, rejet des codes faux, limitations anti-force brute (429/423) | [ ] |
| 2 | Gestion des utilisateurs (API-28) | Annuaire filtrable (/users), fiche utilisateur (/users/:id), gardes-fous auto-modification (403) et dernier admin (409), invitations | [ ] |
| 3 | Journal d'audit filtré (F-91, API-30) | Traçabilité immuable (/audit), filtres combinés, occultation des secrets (OWASP A09), accès réservé à l'administrateur (403) | [ ] |
| 4 | Page légale publique (NF-02) | Page publique (/v/legal) en 3 langues, 4 sections obligatoires, absence d'IP dans Event, retour vers visite de démonstration (demo-rabat) | [ ] |
| 5 | Multilingue et mode miroir RTL (D-142) | Bascule instantanée fr/ar/en, adaptation RTL (dir="rtl", barre latérale à droite, propriétés CSS logiques, pas de débordement) | [ ] |
| 6 | Commandes automatisées de validation | Suites Playwright e2e (Axe 0 violation, RTL conforme), pnpm audit (0 high/critical), scripts k6 selon perf/README.md hors production | [ ] |
| 7 | Cadre recette et pilote | Référentiels formels établis pour le porteur : docs/RECETTE.md, docs/PV_RECETTE.md et docs/PILOTE.md | [ ] |
