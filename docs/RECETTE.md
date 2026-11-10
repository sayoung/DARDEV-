# Plan de Recette Fonctionnelle de Bout en Bout — Projet Xplor

> **Référence :** Cahier des charges Xplor v2.0 — Section 6 (Exigences fonctionnelles), Section 8 (Exigences non fonctionnelles), Section 9 (Planning des jalons M0 à M8) et Section 10 (Definition of Done).  
> **Jalon :** M8 — Durcissement & pilote (Livrable : PV de recette fonctionnelle, rapport de pilote et correctifs).  
> **Date de création :** 10/11/2026.  
> **Statut du document :** Partie 1/2 — Plan de recette initialisé (résultats et statuts marqués « à exécuter » pour la phase d'exécution 2/2).

---

## 1. Cadre et Objectifs de la Recette

Le présent document constitue le **plan de recette fonctionnelle globale et de bout en bout** de la plateforme Xplor à l'issue des jalons de développement **M0 à M8**. Il formalise l'ensemble des scénarios de test transverses nécessaires à la validation de la conformité de la solution avant le déploiement pilote en hôtel partenaire.

### 1.1 Objectifs
- Valider le comportement nominal et les cas d'erreur de bout en bout à travers toutes les composantes du système (`apps/api`, `apps/worker`, `apps/admin`, `apps/web`, `apps/kiosk` et `packages/viewer-core`).
- Vérifier la chaîne complète de valeur : de la configuration administrative et l'ingestion de contenus 360° jusqu'à la consultation sur mobile, borne tactile autonome et casque de réalité virtuelle (WebXR).
- Attester du respect des exigences réglementaires (loi marocaine 09-08 CNDP relative à la protection des données à caractère personnel) et de sécurité applicative (OWASP Top 10, limitation de débit, 2FA, isolation multi-tenant, journal d'audit).
- Préparer le **Procès-Verbal (PV) de recette** pour la validation formelle par le porteur du projet (DARDEV / SMIT).

### 1.2 Règle d'exécution et de notation
Conformément aux directives de recette (Partie 1/2) :
- Tous les scénarios sont initialisés avec la mention stricte **`à exécuter`** dans les colonnes **Résultat obtenu** et **Statut**.
- Aucun résultat n'est inventé ou anticipé.
- L'exécution effective pas à pas, la consignation des preuves tangibles (captures, identifiants générés, temps de réponse) et la validation définitive feront l'objet de la session de recette (Partie 2/2).

---

## 2. Environnement et Prérequis de Test

### 2.1 Architecture des services de démonstration
Les scénarios de recette s'exécutent sur l'environnement de développement et de qualification Xplor :
- **API NestJS (Fastify) :** `http://localhost:3000` (préfixe `/api/v1`)
- **Back-office Admin (React 19 + Vite) :** `http://localhost:5173`
- **Visionneuse Web publique :** `http://localhost:5174`
- **Application Kiosque PWA :** `http://localhost:5175`
- **Services d'infrastructure :**
  - PostgreSQL 16 (port 5432, base de données `xplor`)
  - Redis 7 (port 6379, files BullMQ et sessions)
  - MinIO / S3 (port 9000 API, port 9001 console, bucket `xplor`)
  - Mailpit SMTP / Web (port 1025 SMTP, port 8025 interface de visualisation)

### 2.2 Comptes utilisateurs de test (`pnpm db:seed`)
| Rôle | Adresse e-mail | Mot de passe seed | Périmètre d'accès |
|---|---|---|---|
| **ADMIN** | `admin@xplor.local` | `$SEED_DEFAULT_PASSWORD` | Administration complète, gestion des hôtels, des kiosques, des utilisateurs et journal d'audit. |
| **EDITOR** | `editor@xplor.local` | `$SEED_DEFAULT_PASSWORD` | Gestion du catalogue global de visites, des scènes, des hotspots et de la médiathèque. |
| **HOTEL_MANAGER** | `manager@xplor.local` | `$SEED_DEFAULT_PASSWORD` | Gestion restreinte à son établissement (« Hôtel Démonstration Rabat ») : sélection, kiosques, stats. |
| **PARTNER** | `partner@xplor.local` | `$SEED_DEFAULT_PASSWORD` | Consultation en lecture seule des statistiques agrégées (SMIT / ministères). |

### 2.3 Jeu de données initial
- 3 villes de référence : Rabat, Salé, Kénitra.
- 4 catégories : Monuments, Musées, Parcs & Nature, Plages.
- 1 hôtel de démonstration : « Hôtel Démonstration Rabat » (5 étoiles).
- 1 kiosque pré-configuré : « Hall principal » (statut `PENDING`).
- 3 visites virtuelles liées :
  1. *Kasbah des Oudayas* (3 scènes : La porte, Le jardin andalou, Les remparts).
  2. *Jardin de Salé* (3 scènes : L'entrée, Le bassin, Les orangers).
  3. *Plage de Mehdia* (2 scènes : Le rivage, Les dunes).
- Fichiers de test 360° : Panoramas équirectangulaires JPEG 2:1 (dossier `D:/DARDEV/local/xplor-panoramas-test`).

---

## 3. Tableau Maître des Scénarios de Recette de Bout en Bout

| ID | Exigences couvertes | Étapes | Résultat attendu | Résultat obtenu | Statut | Commentaire |
|---|---|---|---|---|---|---|
| **R-01** | F-90, API-20, NF-01, NF-06 | 1. Accéder au back-office (`http://localhost:5173/`).<br>2. Se connecter avec `admin@xplor.local` et le mot de passe seed.<br>3. Constater l'alerte d'obligation 2FA pour le profil ADMIN.<br>4. Naviguer vers `/account/security` et initier la configuration TOTP (`POST /auth/totp/setup`).<br>5. Saisir le code à 6 chiffres généré par l'application d'authentification et valider (`POST /auth/totp/verify`).<br>6. Se déconnecter via le menu utilisateur.<br>7. Reconnecter l'administrateur : soumettre les identifiants puis saisir le code TOTP demandé.<br>8. Tester la saisie d'un code TOTP erroné (rejet).<br>9. Tester la limitation de débit anti-bruteforce en simulant 6 échecs rapides sur `/auth/login` (HTTP 429).<br>10. Tester le verrouillage temporaire après 10 échecs consécutifs (HTTP 423 `ACCOUNT_LOCKED`). | Authentification nominale fonctionnelle avec cookie sécurisé `xplor_sid` ; obligation 2FA respectée pour le rôle ADMIN (D-138) ; secret TOTP RFC 6238 généré sans dépendance externe (`node:crypto`, D-137) ; challenge TOTP effectif lors des reconnexions ; limitation ThrottlerGuard active (HTTP 429) ; verrouillage automatique 15 min après 10 tentatives erronées (HTTP 423). | à exécuter | à exécuter | Valide la sécurité d'accès, le 2FA TOTP et la résilience aux attaques par force brute (DoD M0, M8 NF-01 / F-90). |
| **R-02** | F-50, F-51, API-26, API-28, NF-01 | 1. Connecté en ADMIN, accéder à la rubrique Hôtels (`/hotels`).<br>2. Cliquer sur « Nouvel hôtel », renseigner les métadonnées (nom, 5 étoiles, ville Rabat, contact, couleur `#1F6F8B`, langues fr/ar/en, contrat location) et enregistrer (`POST /admin/hotels`).<br>3. Ouvrir la sélection de l'établissement (`/hotels/:id/selection`).<br>4. Sélectionner 2 visites dans le catalogue publié, ajuster l'ordre d'affichage, définir la visite mise en avant et les visites du mode veille attract.<br>5. Enregistrer la sélection (`PUT /admin/hotels/:id/selection`) et vérifier l'incrémentation de `Selection.version`.<br>6. Accéder à la gestion des utilisateurs (`/users`) et inviter un nouveau gestionnaire d'hôtel (`POST /admin/users/invitations` avec rôle `HOTEL_MANAGER` et rattachement exclusif au nouvel hôtel).<br>7. Ouvrir le lien d'invitation reçu dans Mailpit (`/invite/:token`), définir un mot de passe robuste (≥ 12 car.) et finaliser l'activation. | Établissement créé avec succès et sélection initialisée ; composition de la sélection enregistrée avec incrémentation atomique de `version` ; invitation envoyée avec jeton temporaire 48 h ; compte gestionnaire activé et correctement rattaché via `UserHotel`. | à exécuter | à exécuter | Valide le cycle d'administration des établissements et délégations hôtelières (DoD M5 F-50/F-51, M8 API-28). |
| **R-03** | F-02, F-05, F-10, F-11, F-12, API-24 | 1. Connecté au back-office, accéder à la Médiathèque (`/media`).<br>2. Tenter le téléversement d'un fichier invalide (ratio ≠ 2:1 ou largeur < 4096 px) : constater le rejet immédiat en HTTP 422 avec message d'erreur explicite indiquant la valeur attendue et reçue.<br>3. Déposer un panorama équirectangulaire valide de haute résolution (ex. 8192×4096 JPEG issu des panoramas de test Poly Haven).<br>4. Vérifier l'obtention de l'URL pré-signée S3 (`POST /admin/assets/upload-url`), l'upload direct vers MinIO et la notification de complétion (`POST /admin/assets/complete`).<br>5. Suivre la transition des statuts (`PENDING` → `PROCESSING` → `READY`) grâce au rafraîchissement automatique de la vue.<br>6. Constater la génération par le worker BullMQ (`sharp`) des 4 dérivés : `preview` (512×256 q70), `web` (4096×2048 q80), `tiles` (grille 16×8 tuiles de 512×512) et `thumb` (400×225 centré).<br>7. Tester l'action « Retraiter » depuis l'interface ou exécuter en ligne de commande `pnpm --filter api cli reprocess --asset=<UUID>` pour vérifier le recalcul idempotent. | Rejet strict des médias non conformes (F-10) ; flux d'upload direct performant sans engorger l'API ; traitement asynchrone BullMQ en < 60 s produisant l'ensemble des dérivés géométriques et tuiles (F-11) ; retraitement CLI opérationnel (F-12). | à exécuter | à exécuter | Valide le pipeline d'ingestion et de tuilage 360° haute performance (DoD M2, script `pnpm demo:m2`). |
| **R-04** | F-01, F-02, F-03, F-04, F-20, F-21, F-22, F-23, F-24, F-25, API-21, API-22, API-23 | 1. Connecté en ÉDITEUR ou ADMIN, accéder aux Visites (`/tours`) et cliquer sur « Nouvelle visite » (`/tours/new`).<br>2. Renseigner les champs multilingues (titres fr/ar/en), sélectionner la ville, la catégorie et la vignette via l'AssetPicker, puis enregistrer en brouillon (`DRAFT`).<br>3. Ajouter 3 scènes à la visite et leur assigner des panoramas équirectangulaires au statut `READY`.<br>4. Définir la première scène comme scène de départ (`set-start`).<br>5. Ouvrir la première scène dans l'« Éditeur 360 » (Photo Sphere Viewer).<br>6. Cliquer sur le panorama pour positionner un hotspot `SCENE_LINK` ciblant la scène 2 : vérifier la capture précise des coordonnées yaw/pitch (< 0.01 rad).<br>7. Régler l'orientation et cliquer sur « Définir la vue actuelle comme vue initiale » ; configurer l'orientation d'arrivée pour la scène cible (F-23).<br>8. Déplacer le hotspot par glisser-déposer, tester l'annulation (Ctrl+Z) et le rétablissement (Ctrl+Y), observer la sauvegarde automatique debouncée (1 s) avec statut « Enregistré » (F-22).<br>9. Ajouter un point d'information enrichi `INFO` (texte descriptif et visuel).<br>10. Consulter la « Carte des liens » (`/tours/:id`) : identifier que la scène 3 est signalée comme orpheline.<br>11. Tenter de publier la visite : constater le refus en HTTP 422 avec la liste des scènes inatteignables affichée dans l'interface (F-03).<br>12. Corriger le graphe en reliant la scène 2 à la scène 3, puis valider la publication : passage au statut `PUBLISHED`.<br>13. Cliquer sur « Tester la visite » (F-24) et vérifier l'ouverture de la visionneuse avec un jeton d'aperçu signé valide 1 h. | Visite créée et enrichie ; interaction 360° précise ; annuler/rétablir et sauvegarde automatique sans perte ; graphe détectant fidèlement les orphelins ; blocage strict de la publication si le graphe est non connexe puis publication réussie ; prévisualisation opérationnelle. | à exécuter | à exécuter | Valide le cœur fonctionnel éditorial et l'algorithme de validation de graphe (DoD M1 et M4, `e2e/m4-editor.spec.ts`). |
| **R-05** | F-30, F-31, F-32, F-33, F-34, F-35, F-40, F-41, F-42, API-11, API-12, NF-05, NF-06 | 1. Sur la visite publiée, activer le partage public (`publicShare: true`).<br>2. Télécharger le QR code SVG généré par le back-office (`GET /admin/tours/:id/qr.svg`).<br>3. Vérifier les balises Open Graph servies par l'API sur `GET /public/share/:shareToken` (titre, description, image).<br>4. Ouvrir l'URL publique (`http://localhost:5174/v/:shareToken`) sur mobile ou en vue responsive.<br>5. Constater le chargement initial : preview flou affiché en < 1 s puis montée en résolution (F-35).<br>6. Naviguer entre les scènes via les flèches `SCENE_LINK` (transition animée 800 ms), via la galerie de miniatures et au gyroscope.<br>7. Tester un lien inter-visites `TOUR_LINK` (« Aller vers Jardin de Salé ») : dialogue de confirmation, ouverture de la visite cible, puis clic sur « Retour » revenant exactement à la visite et la scène de départ (pile d'historique F-32).<br>8. Ouvrir le point `INFO` : affichage du volet latéral sombre translucide avec textes et média ; tester la narration audio de scène et le son d'ambiance.<br>9. Basculer l'interface en arabe via le sélecteur : affichage immédiat en mode miroir RTL (`dir="rtl"`) sans rechargement.<br>10. Depuis l'admin, cliquer sur « Régénérer le lien de partage » : constater l'invalidation immédiate de l'ancien lien (HTTP 404) et la validité du nouveau. | Accès public web conditionné à `publicShare` ; QR code scannable ; Open Graph valide ; navigation fluide avec pile d'historique inter-visites stricte ; contenus multimédias opérationnels ; support RTL arabe parfait (D-142) ; révocation atomique de l'ancien jeton. | à exécuter | à exécuter | Valide la consultation web publique, mobile et le partage social (DoD M3 / M3b, `docs/DEMO_M3.md`). |
| **R-06** | F-52, F-53, F-60, F-61, F-62, F-63, F-64, F-65, F-66, F-67, API-01, API-02, API-03, NF-04 | 1. Dans le back-office ADMIN, générer le code d'enrôlement temporaire à 8 caractères d'un kiosque (`POST /admin/kiosks/:id/enrollment-code`).<br>2. Ouvrir la PWA Kiosque sur `http://localhost:5175/`.<br>3. Saisir le code d'enrôlement : appel `POST /kiosk/enroll`, réception du jeton 256 bits et persistance dans IndexedDB.<br>4. Constater le téléchargement du manifeste de l'hôtel (`GET /kiosk/manifest`) et la mise en cache complète des visites par le Service Worker.<br>5. Couper le réseau (mode Offline dans les DevTools) et recharger la page : vérifier que l'accueil personnalisé (logo, couleur de marque) s'affiche et que les visites 360° sont jouables intégralement sans réseau (F-62).<br>6. Laisser le kiosque inactif pendant le délai configuré (15 s) : observer le basculement en mode veille attract avec rotation lente et invitation tactile (F-63), et fermeture de la session (`SESSION_END`).<br>7. Toucher l'écran pour réveiller le kiosque : création d'une nouvelle session anonyme `sessionId` (F-64).<br>8. Réaliser le geste secret (5 appuis rapides sur l'en-tête en < 3 s) : saisie du PIN de maintenance de l'hôtel (vérifié hors ligne par empreinte salée SHA-256 locale, D-127) et accès à l'écran technique.<br>9. Rétablir le réseau : observer l'envoi du heartbeat périodique (`POST /kiosk/heartbeat`) et le dépilage des événements en attente.<br>10. Dans le back-office, désactiver le kiosque : vérifier l'affichage immédiat sur la borne de l'écran « Service momentanément indisponible » (F-66). | Enrôlement sécurisé unique ; autonomie 100 % hors ligne garantie (NF-04) ; mode veille attract avec réveil tactile fluide ; sessions tracées sans donnée personnelle voyageur ; geste secret et PIN opérationnels même sans réseau ; supervision et désactivation à distance effectives. | à exécuter | à exécuter | Valide la robustesse physique et logicielle de l'application kiosque autonome (DoD M5, `docs/DEMO-M5.md`). |
| **R-07** | F-70, F-71, F-72, F-73 | 1. Accéder à une visite virtuelle depuis un casque VR autonome (Meta Quest Browser) ou un environnement compatible WebXR.<br>2. Vérifier l'affichage du bouton « Vivre en VR » lorsque l'API `navigator.xr.isSessionSupported('immersive-vr')` est disponible (et son absence transparente sans erreur si non supporté, F-73).<br>3. Cliquer sur « Vivre en VR » pour entrer en session WebXR immersive : vérifier la fluidité d'affichage (≥ 72 fps constant, F-72).<br>4. Pointer sur une flèche de navigation `SCENE_LINK` avec le rayon de la manette ou le tracking des mains.<br>5. Actionner la gâchette ou effectuer un pincement index/pouce : constater le déclenchement unique anti-rebond et la transition par fondu au noir confortable (sans à-coup ni rotation artificielle).<br>6. Pointer sur un hotspot `INFO` : vérifier l'ouverture de la fiche descriptive 3D dans l'espace virtuel.<br>7. Tester l'interaction de secours par regard fixe (regard-dwell 2 s) sur un hotspot sans utiliser de manette ni geste de pincement.<br>8. Quitter la session VR via le bouton de sortie ou le menu système : retour propre à l'interface 2D sans erreur console. | Immersion WebXR stéréoscopique fluide ; détection précise des manettes et du tracking des mains ; protection anti-rebond effective ; transitions confortables respectant la cinétose ; regard-dwell opérationnel ; panneau 3D lisible ; sortie propre. | à exécuter | à exécuter | Valide le mode de réalité virtuelle casque autonome (DoD M6, `docs/VALIDATION_QUEST.md`). |
| **R-08** | F-80, F-81, F-82, F-83, API-04, API-29, NF-02, NF-03 | 1. Alimenter le système avec un jeu représentatif d'événements (via `pnpm stats:demo` : 418 événements pour 84 sessions sur 7 jours).<br>2. Tester l'ingestion d'un lot d'événements via `POST /api/v1/events` : vérifier le respect du temps de traitement (< 100 ms pour 200 événements, NF-03) et l'absence totale d'adresse IP dans la table `Event` (loi 09-08 CNDP, NF-02).<br>3. Exécuter le recalcul quotidien des agrégats via `pnpm stats:backfill` et vérifier l'intégrité arithmétique via `pnpm stats:verify`.<br>4. Se connecter en ADMIN sur le back-office et ouvrir le Tableau de bord (`/stats`).<br>5. Contrôler les 7 cartes d'indicateurs (sessions, durée moyenne, visites ouvertes, scènes vues, taux VR, scans QR `src=kiosk`), les graphiques SVG temporels et les classements top 10.<br>6. Manipuler les filtres dynamiques (période, hôtel, visite, canal, langue).<br>7. Télécharger l'export CSV (`/api/v1/admin/stats/export.csv`) : vérifier la présence du BOM UTF-8, le séparateur point-virgule `;` pour Excel, et l'échappement anti-injection de formules (`=`, `+`, `-`, `@`).<br>8. Lancer la prévisualisation du rapport mensuel PDF (`pnpm report:preview`) et vérifier la fidélité de la mise en page A4 portrait aux couleurs de la charte Xplor. | Ingestion par lots performante et anonyme par conception ; calcul fiable des agrégats `StatsDaily` ; visualisation claire sur le tableau de bord avec filtres réactifs ; export CSV compatible Excel sans risque de sécurité ; génération PDF mensuelle conforme. | à exécuter | à exécuter | Valide la chaîne de collecte, d'analyse statistique et de reporting mensuel (DoD M7, `docs/DEMO_M7.md`). |
| **R-09** | F-91, API-30, NF-01 | 1. Connecté en ADMIN, exécuter diverses actions sensibles : connexion réussie, tentative avec mot de passe erroné, publication/dépublication de visite, modification de sélection hôtel, désactivation d'un kiosque, modification des permissions d'un utilisateur.<br>2. Accéder à la rubrique Journal d'Audit du back-office (`/audit`, réservée aux administrateurs).<br>3. Vérifier que chaque événement sensible est consigné avec horodatage, identifiant de l'auteur, action, type d'entité, cible et adresse IP anonymisée.<br>4. Inspecter les diffs JSON : attester de l'absence totale de données confidentielles (mots de passe, hashes, secrets TOTP, jetons d'appareil).<br>5. Tester le filtrage de la liste d'audit par type d'action, utilisateur et intervalle de dates (`GET /admin/audit`).<br>6. Tenter d'accéder à la page d'audit avec un profil non-administrateur (`HOTEL_MANAGER`, `EDITOR`) : vérifier le blocage d'accès strict en HTTP 403 Forbidden. | Traçabilité exhaustive et immuable des opérations d'administration dans `AuditLog` (F-91) ; occultation garantie des secrets cryptographiques (A09:2021) ; consultation ergonomique réservée à l'administrateur. | à exécuter | à exécuter | Valide la surveillance et la journalisation de sécurité (DoD M8 F-91 / API-30, `docs/SECURITE.md`). |
| **R-10** | F-50, F-51, API-26, API-27, API-29, NF-01 | 1. Identifier deux hôtels distincts dans la base : Hôtel A (« Hôtel Démonstration Rabat ») et Hôtel B.<br>2. Se connecter en tant que gestionnaire de l'Hôtel A (`manager@xplor.local`).<br>3. Constater que seules les données de l'Hôtel A sont visibles dans les listes du back-office.<br>4. Tenter d'accéder directement par l'URL à la sélection de l'Hôtel B (`/hotels/:idB/selection`).<br>5. Vérifier que l'interface affiche un écran d'erreur sans divulguer aucune information.<br>6. Émettre des requêtes HTTP directes avec les cookies de session du gestionnaire A :<br>&nbsp;&nbsp;• `GET /api/v1/admin/hotels/:idB` → HTTP 404.<br>&nbsp;&nbsp;• `GET /api/v1/admin/hotels/:idB/selection` → HTTP 404.<br>&nbsp;&nbsp;• `PUT /api/v1/admin/hotels/:idB/selection` → HTTP 404.<br>&nbsp;&nbsp;• `GET /api/v1/admin/stats/summary?hotelId=:idB` → HTTP 404.<br>7. Se connecter avec un compte PARTNER : vérifier que seules les statistiques agrégées globales sont accessibles, sans possibilité de filtrer par établissement (D-04). | Cloisonnement multi-tenant hermétique appliqué par `AccessPolicy` et les requêtes Prisma ; rejet systématique en HTTP 404/403 pour toute tentative d'accès croisé inter-établissements ; respect strict des restrictions accordées aux partenaires. | à exécuter | à exécuter | Valide la règle de contrôle d'accès multi-tenant d'AGENTS.md et OWASP A01:2021 (`DEMO_M7.md` étape 4). |
| **R-11** | F-90, API-20, API-28, NF-01, NF-06 | 1. Sur la page de connexion, cliquer sur « Mot de passe oublié » (`/forgot`).<br>2. Saisir l'e-mail d'un compte existant (`editor@xplor.local`) et valider (`POST /auth/password/forgot`).<br>3. Consulter Mailpit (`http://localhost:8025/`) et cliquer sur le lien de réinitialisation (`/reset/:token`, valable 48 h).<br>4. Tester la saisie d'un mot de passe trop court (< 12 car.) ou trop courant : vérifier le rejet par la politique de sécurité.<br>5. Saisir un mot de passe robuste conforme et valider (`POST /auth/password/reset`).<br>6. Se connecter immédiatement avec le nouveau mot de passe.<br>7. Sur la page de login, tester la protection anti-force brute en saisissant un mot de passe erroné 10 fois de suite : vérifier le verrouillage du compte pendant 15 min (HTTP 423 `ACCOUNT_LOCKED`). | Procédure de réinitialisation de mot de passe par courriel sécurisée (F-90) ; validation stricte de la complexité des mots de passe ; blocage automatique du compte après 10 échecs consécutifs. | à exécuter | à exécuter | Valide le cycle de vie des identifiants et la protection des comptes utilisateurs (DoD M0, M8 F-90). |
| **R-12** | NF-01, NF-02, NF-04, NF-05, NF-08 | 1. Interroger la sonde de santé système `GET /api/health` : vérifier la réponse HTTP 200 avec sondes actives `db`, `redis` et `storage` toutes à `ok` en < 2 000 ms (NF-04).<br>2. Contrôler les en-têtes HTTP de sécurité : vérifier la présence de CSP stricte (`default-src: 'none'`), HSTS, `nosniff` et la restriction CORS aux domaines autorisés (NF-01).<br>3. Consulter les pages publiques (`/v/legal`) : vérifier la présence des mentions légales et de la politique de confidentialité (loi 09-08 CNDP, NF-02).<br>4. Évaluer l'accessibilité du back-office via les tests automatisés Axe (`@axe-core/playwright`, D-141) : constater 0 violation WCAG 2.1 AA sur l'authentification et le tableau de bord.<br>5. Contrôler la navigation complète au clavier (tabulation, focus trap dans les modales, fermeture par Échap).<br>6. Vérifier sur l'application kiosque le respect des tailles cibles tactiles (boutons ≥ 48 px, typographie ≥ 18 px, NF-05). | Sonde `/api/health` 100 % opérationnelle ; en-têtes de sécurité HTTP durcis ; mentions légales conformes ; conformité d'accessibilité WCAG 2.1 AA attestée sans violation Axe ; ergonomie kiosque conforme. | à exécuter | à exécuter | Valide la conformité globale non-fonctionnelle et les exigences d'exploitabilité (DoD M8 NF-01 à NF-05). |

---

## 4. Protocoles Détaillés des Scénarios de Recette

### 4.1 Scénario R-01 : Authentification sécurisée, 2FA TOTP et politique de session
- **Objectif :** Vérifier l'étanchéité du mécanisme d'authentification, l'obligation et le fonctionnement du second facteur TOTP pour le rôle `ADMIN` (D-137, D-138), la gestion des sessions Redis et les protections anti-bruteforce.
- **Acteurs :** Administrateur (`admin@xplor.local`).
- **Prérequis :** API et back-office démarrés, Redis actif, base initialisée avec les comptes seed.
- **Procédure pas à pas :**
  1. Ouvrir le navigateur sur `http://localhost:5173/` (page de connexion).
  2. Renseigner `admin@xplor.local` et le mot de passe seed par défaut, puis cliquer sur « Se connecter ».
  3. Vérifier la réception du cookie de session `xplor_sid` (drapeaux `HttpOnly`, `SameSite=Lax`, et `Secure` en HTTPS) et la redirection vers l'accueil.
  4. Constater le bandeau d'avertissement imposant l'activation du 2FA pour l'administrateur.
  5. Cliquer sur le lien du bandeau menant à `/account/security`.
  6. Cliquer sur « Activer l'authentification à deux facteurs » : l'API appelle `POST /api/v1/auth/totp/setup` et renvoie une clé secrète en Base32 (20 octets aléatoires) et l'URI standard `otpauth://totp/Xplor:admin@xplor.local?secret=...`.
  7. Calculer ou générer le code TOTP à 6 chiffres via une application d'authentification (ou script de test RFC 6238) et valider via `POST /api/v1/auth/totp/verify`.
  8. Constater le message de succès et le statut « 2FA activé ».
  9. Se déconnecter via le bouton de déconnexion de l'en-tête (`POST /api/v1/auth/logout`).
  10. Tenter une reconnexion : après soumission des identifiants e-mail/mot de passe, vérifier que l'API renvoie un statut intermédiaire avec `pending2fa: true` et que l'interface affiche l'écran de saisie du code à 6 chiffres.
  11. Saisir un code erroné (ex. `000000`) : vérifier le rejet avec message d'erreur clair.
  12. Saisir le code TOTP synchronisé : vérifier l'accès effectif au tableau de bord.
  13. Tester la limitation de débit ThrottlerGuard : soumettre 6 requêtes d'authentification erronées en moins d'une minute sur `/api/v1/auth/login` → constater la réponse HTTP 429 `Too Many Requests`.
  14. Poursuivre les tentatives erronées jusqu'à 10 échecs : constater le verrouillage temporaire du compte (HTTP 423 `ACCOUNT_LOCKED`) pendant 15 minutes.
- **Résultat attendu :** Isolation complète des sessions, 2FA fonctionnel sans faille de contournement, code invalide rejeté, limitation de débit et verrouillage anti-bruteforce effectifs.

### 4.2 Scénario R-02 : Gestion des hôtels, sélection et gestionnaires
- **Objectif :** Valider la création d'un établissement hôtelier, la sélection de visites catalogue ordonnées et la délégation d'accès à un gestionnaire d'hôtel.
- **Acteurs :** Administrateur (`admin@xplor.local`), Gestionnaire invité.
- **Prérequis :** Compte administrateur connecté, au moins 2 visites publiées disponibles au catalogue.
- **Procédure pas à pas :**
  1. Accéder à l'écran `/hotels` et cliquer sur « Nouvel hôtel ».
  2. Renseigner les champs du formulaire :
     - Nom : « Hôtel Mamounia Palace »
     - Étoiles : 5 étoiles (`FIVE`)
     - Ville : Rabat
     - Adresse : « Boulevard Mohamed VI, Rabat »
     - Téléphone : `+212537112233`
     - E-mail : `mamounia@xplor.local`
     - Couleur de marque : `#1F6F8B`
     - Langues supportées : `fr`, `ar`, `en`
     - Type de contrat : Location (`RENTAL`)
  3. Enregistrer l'hôtel (`POST /api/v1/admin/hotels`) : constater sa présence dans la liste avec son badge de contrat.
  4. Cliquer sur l'action « Gérer la sélection » (`/hotels/:id/selection`).
  5. Rechercher des visites dans le catalogue, ajouter la visite « Kasbah des Oudayas » et la visite « Jardin de Salé ».
  6. Définir « Kasbah des Oudayas » comme visite mise en avant (`featuredTourId`) et l'ajouter à la liste du mode veille (`attractTourIds`).
  7. Réordonner les visites par glisser-déposer et sauvegarder (`PUT /api/v1/admin/hotels/:id/selection`).
  8. Vérifier que la version de sélection est incrémentée (`Selection.version = 2`).
  9. Accéder à `/users` et cliquer sur « Inviter un utilisateur ».
  10. Saisir l'adresse e-mail `gestionnaire.mamounia@xplor.local`, sélectionner le rôle `HOTEL_MANAGER`, cocher l'établissement « Hôtel Mamounia Palace » et envoyer l'invitation (`POST /api/v1/admin/users/invitations`).
  11. Ouvrir Mailpit (`http://localhost:8025/`), ouvrir le courriel d'invitation et cliquer sur le lien `/invite/:token`.
  12. Définir un mot de passe sécurisé respectant les contraintes (≥ 12 caractères) et valider : connexion automatique avec le profil gestionnaire d'hôtel.
- **Résultat attendu :** Entité hôtel correctement enregistrée en base ; sélection persistée et versionnée ; gestionnaire invité avec jeton sécurisé, mot de passe défini et rattachement `UserHotel` opérationnel.

### 4.3 Scénario R-03 : Pipeline d'ingestion des médias 360 et dérivés
- **Objectif :** Valider les contrôles de conformité à l'upload, l'architecture asynchrone BullMQ + sharp et la génération des dérivés haute fidélité.
- **Acteurs :** Éditeur ou Administrateur.
- **Prérequis :** MinIO démarré, worker BullMQ actif, panoramas de test disponibles dans `D:/DARDEV/local/xplor-panoramas-test`.
- **Procédure pas à pas :**
  1. Se rendre dans la Médiathèque (`/media`).
  2. Téléverser un fichier non équirectangulaire ou de dimensions insuffisantes (ex. 1024×768 ou 200×100 px) :
     - Vérifier que l'API renvoie HTTP 422 avec le code d'erreur `INVALID_FORMAT` ou `INVALID_DIMENSIONS`.
     - Vérifier que le message utilisateur en français précise les valeurs attendues (ratio 2:1 ±1 %, largeur ≥ 4096 px) et reçues.
  3. Téléverser un panorama de test valide 8192×4096 JPEG.
  4. Observer l'appel `POST /api/v1/admin/assets/upload-url` recevant l'URL pré-signée et le jeton de sécurité HMAC.
  5. Observer l'upload binaire direct vers le stockage (`PUT` MinIO) et l'appel de complétion `POST /api/v1/admin/assets/complete`.
  6. Vérifier que l'asset apparaît dans la liste avec le statut `PENDING` puis `PROCESSING`.
  7. Observer la notification ou le rafraîchissement automatique de la liste (toutes les 3 s) : passage au statut `READY` en moins de 60 secondes.
  8. Vérifier sur le stockage S3/MinIO la création effective des dérivés sous `panoramas/{assetId}/{hash}/` :
     - `preview.jpg` (512×256, q70)
     - `web.jpg` (4096×2048, q80)
     - `thumb.jpg` (400×225)
     - Tuiles équirectangulaires découpées en 16×8 fichiers 512×512 JPEG sous `/tiles/`.
  9. Lancer la commande de retraitement CLI :
     ```bash
     pnpm --filter api cli reprocess --asset=<UUID_ASSET>
     ```
  10. Vérifier que le worker prend en charge la réexécution sans erreur et confirme l'état `READY`.
- **Résultat attendu :** Rejet immédiat des images non conformes (F-10) ; traitement asynchrone robuste par le worker ; génération conforme des 4 dérivés et des tuiles (F-11) ; commande CLI de retraitement opérationnelle (F-12).

### 4.4 Scénario R-04 : Édition visuelle d'une visite et validation de graphe
- **Objectif :** Vérifier la création d'une visite, le placement et l'édition de hotspots 360°, la détection des orphelins et le blocage de publication.
- **Acteurs :** Éditeur (`editor@xplor.local`).
- **Prérequis :** Au moins 3 panoramas au statut `READY` dans la médiathèque.
- **Procédure pas à pas :**
  1. Accéder à `/tours/new` et créer une visite :
     - Titre fr : « Visite Recette Oudayas »
     - Titre ar : « جولة الأوداية للاستلام »
     - Titre en : « Oudayas Acceptance Tour »
     - Ville : Rabat ; Catégorie : Monuments
     - Sélectionner une vignette via l'AssetPicker.
  2. Enregistrer la visite en brouillon (`DRAFT`).
  3. Ajouter 3 scènes : « Scène 1 Entrée », « Scène 2 Cour », « Scène 3 Belvédère », chacune rattachée à un panorama `READY`.
  4. Définir « Scène 1 Entrée » comme scène de départ (`set-start`).
  5. Ouvrir la Scène 1 et cliquer sur l'onglet « Éditeur 360 ».
  6. Cliquer sur une arche du panorama pour créer un hotspot :
     - Sélectionner le type `SCENE_LINK`.
     - Choisir la scène cible : « Scène 2 Cour ».
     - Renseigner le libellé multilingue.
     - Constater que les coordonnées angulaires yaw/pitch enregistrées correspondent exactement au point cliqué (< 0.01 rad).
  7. Orienter la vue vers l'arche et cliquer sur « Définir la vue actuelle comme vue initiale » (F-23).
  8. Cliquer sur « Définir l'orientation d'arrivée » pour calibrer l'orientation d'entrée dans la Scène 2.
  9. Déplacer le hotspot par glisser-déposer sur le panorama ; effectuer Ctrl+Z (annuler) et Ctrl+Y (rétablir) : vérifier la réactivité du repère visuel.
  10. Observer l'indicateur de sauvegarde automatique debouncée (1 s) affichant « Enregistré » sans action manuelle.
  11. Ajouter un hotspot de type `INFO` avec un titre et un paragraphe explicatif.
  12. Consulter la « Carte des liens » (`/tours/:id`) : vérifier que la « Scène 3 Belvédère » apparaît distinctement comme orpheline (aucun lien entrant).
  13. Cliquer sur le bouton « Publier » : constater le refus en HTTP 422 avec le message `TOUR_UNREACHABLE_SCENES` et la liste des scènes inatteignables.
  14. Revenir dans l'éditeur sur la Scène 2, placer un lien `SCENE_LINK` vers la Scène 3.
  15. Cliquer à nouveau sur « Publier » : la visite passe au statut `PUBLISHED`.
  16. Cliquer sur « Tester la visite » (F-24) : vérifier que la visionneuse s'ouvre dans un nouvel onglet avec le jeton d'aperçu signé valide 1 h.
- **Résultat attendu :** Éditeur 360 fluide et ergonomique ; persistance angulaire précise ; annuler/rétablir fonctionnel ; intégrité de publication strictement garantie par la validation de graphe (F-03).

### 4.5 Scénario R-05 : Partage public QR, visionneuse mobile et navigation inter-visites
- **Objectif :** Valider l'accès anonyme via URL publique, l'affichage mobile, la pile d'historique inter-visites et le support RTL arabe.
- **Acteurs :** Visiteur mobile / Touriste.
- **Prérequis :** Une visite publiée avec `publicShare: true` et contenant un lien inter-visites `TOUR_LINK`.
- **Procédure pas à pas :**
  1. Dans le back-office, vérifier l'activation de l'interrupteur « Partage public » sur la visite publiée.
  2. Télécharger le fichier QR code vectoriel SVG généré (`GET /admin/tours/:id/qr.svg`).
  3. Lancer une requête `GET /api/v1/public/share/:shareToken` et vérifier la présence des balises `<meta property="og:title">`, `og:description` et `og:image`.
  4. Ouvrir l'URL publique `http://localhost:5174/v/:shareToken` sur un navigateur configuré en émulation mobile (iPhone ou Android).
  5. Constater l'apparition quasi-instantanée du preview flou (< 1 s) puis le chargement net de la scène de départ (F-35).
  6. Naviguer en cliquant sur une flèche `SCENE_LINK` : vérifier la transition par fondu doux (~800 ms) et le respect de l'orientation d'arrivée.
  7. Cliquer sur un hotspot `TOUR_LINK` (« Explorer Kasbah des Oudayas ») :
     - Vérifier l'apparition de la modale de confirmation.
     - Valider : constater le chargement de la visite cible à sa scène de départ.
     - Cliquer sur le bouton « Retour » de la visionneuse : vérifier le retour exact à la visite et la scène d'origine (pile d'historique F-32).
  8. Cliquer sur un hotspot `INFO` : constater l'ouverture du panneau latéral sombre translucide avec textes et illustrations.
  9. Lancer la narration audio : vérifier les boutons lecture/pause et l'affichage des sous-titres synchronisés.
  10. Changer la langue vers l'arabe via le sélecteur : constater le basculement immédiat en `dir="rtl"`, le miroir complet des contrôles et des textes, sans rechargement de page.
  11. Dans le back-office, cliquer sur « Régénérer le lien de partage » (F-42) : recharger l'ancienne URL publique et constater le refus immédiat en HTTP 404.
- **Résultat attendu :** Consultation mobile rapide et réactive ; balises Open Graph conformes ; navigation inter-visites avec historique exact ; volet d'info lisible ; support RTL arabe parfait (D-142) ; révocation immédiate de l'ancien jeton.

### 4.6 Scénario R-06 : Enrôlement kiosque, PWA et fonctionnement autonome hors ligne
- **Objectif :** Valider la procédure d'enrôlement d'une borne tactile, la synchronisation du cache PWA, l'autonomie réseau coupé, le mode veille et le déverrouillage PIN.
- **Acteurs :** Installateur technique, Visiteur d'hôtel.
- **Prérequis :** Kiosque créé en base (statut `PENDING`), sélection d'hôtel configurée, application kiosque accessible sur `http://localhost:5175/`.
- **Procédure pas à pas :**
  1. Dans le back-office, ouvrir le kiosque et générer son code d'enrôlement (`POST /admin/kiosks/:id/enrollment-code`).
  2. Ouvrir la PWA Kiosque sur `http://localhost:5175/` : l'écran d'enrôlement s'affiche.
  3. Saisir le code à 8 caractères et valider : l'application appelle `POST /api/v1/kiosk/enroll`, stocke le jeton 256 bits dans IndexedDB et charge le manifeste.
  4. L'écran d'accueil s'affiche aux couleurs de l'hôtel (couleur `#1F6F8B`, logo, sélection de visites).
  5. Laisser le Service Worker télécharger les médias et visites en tâche de fond jusqu'à synchronisation complète.
  6. Déconnecter le réseau (mode Offline dans les DevTools) et rafraîchir la page : vérifier que l'accueil s'affiche et que les visites 360° se lancent et se naviguent intégralement depuis le cache local (F-62).
  7. Laisser le kiosque inactif pendant 15 secondes :
     - Constater le retour automatique à l'accueil puis le passage en mode attract (boucle de veille lente avec rotation des visites configurées et message « Touchez l'écran pour explorer », F-63).
     - Vérifier la clôture de la session précédente (`SESSION_END`).
  8. Toucher l'écran : vérifier le réveil instantané sur l'accueil et la génération d'un nouvel identifiant de session anonyme `sessionId` (F-64).
  9. Effectuer le geste caché (5 tapotements rapides sur l'en-tête en moins de 3 s) :
     - La boîte de dialogue de saisie du PIN s'ouvre.
     - Saisir le code PIN de l'hôtel (validé hors ligne grâce au hash local salé SHA-256, D-127).
     - Accéder à l'écran technique de maintenance : vérifier les indicateurs de statut, version, et espace disque libre.
  10. Rétablir la connexion réseau : vérifier l'émission automatique du heartbeat (`POST /kiosk/heartbeat`) et le dépilage de la file d'événements.
  11. Dans le back-office, désactiver le kiosque (`POST /admin/kiosks/:id/disable`) : vérifier que la borne bascule instantanément sur l'écran UNAVAILABLE « Service momentanément indisponible » (F-66).
- **Résultat attendu :** Enrôlement simple et sécurisé ; autonomie 100 % hors ligne confirmée (NF-04) ; veille attract et réveil tactile robustes ; maintenance protégée par geste caché et PIN ; supervision et désactivation distantes fonctionnelles.

### 4.7 Scénario R-07 : Immersion en Réalité Virtuelle (Casque VR WebXR)
- **Objectif :** Valider l'entrée en réalité virtuelle WebXR, le pointage manette/mains, le filtrage anti-rebond, le confort visuel et le mode regard-dwell.
- **Acteurs :** Utilisateur avec casque VR autonome (Meta Quest 3 / Meta Quest Browser ou émulateur WebXR API).
- **Prérequis :** Visite 360° publiée accessible en ligne ou en réseau local.
- **Procédure pas à pas :**
  1. Ouvrir la visite sur le casque VR dans Meta Quest Browser.
  2. Constater la présence du bouton « Vivre en VR » dans l'interface (vérifier qu'il est masqué sans erreur sur un navigateur sans support WebXR, F-73).
  3. Cliquer sur « Vivre en VR » : constater le passage fluide en session stéréoscopique immersive à 72 fps (F-72).
  4. Vérifier la visibilité du rayon de pointage attaché au contrôleur (ou au rayon émanant de l'index en tracking des mains nues).
  5. Pointer sur une flèche de navigation `SCENE_LINK` : le marqueur réagit au survol.
  6. Actionner la gâchette (ou réaliser un pincement index/pouce en mode mains) : constater le déclenchement unique avec protection anti-rebond et la transition par fondu au noir doux sans à-coup de caméra.
  7. Pointer sur un point d'information `INFO` : vérifier l'ouverture d'un panneau textuel 3D suspendu dans l'espace virtuel, parfaitement lisible.
  8. Tester l'interaction mains libres de secours (regard-dwell) : maintenir le regard fixe (réticule central) sur un hotspot pendant 2 secondes sans appuyer sur aucune touche : constater l'activation automatique de l'action.
  9. Cliquer sur le bouton de sortie VR ou actionner le bouton système du casque : vérifier le retour instantané et propre à la vue 2D sans plantage.
- **Résultat attendu :** Immersion WebXR stable et performante ; contrôleurs physiques et reconnaissance des mains réactifs ; protection anti-rebond effective ; transitions confortables pour la cinétose ; regard-dwell effectif ; sortie propre sans erreur console.

### 4.8 Scénario R-08 : Collecte analytique, agrégation et export CSV
- **Objectif :** Valider la chaîne analytique : ingestion par lots anonyme, calcul des agrégats `StatsDaily`, tableau de bord décisionnel et export CSV comptable.
- **Acteurs :** Administrateur (`admin@xplor.local`), Gestionnaire d'hôtel.
- **Prérequis :** Données simulées d'une semaine d'activité insérées en base (`pnpm stats:demo`).
- **Procédure pas à pas :**
  1. Exécuter l'ingestion d'un lot de 200 événements via `POST /api/v1/events` (Bearer kiosque ou anonyme web) : mesurer le temps de réponse (< 100 ms, NF-03).
  2. Inspecter la table `Event` en base de données : confirmer formellement l'absence de toute colonne ou donnée d'adresse IP (anonymat absolu imposé par la loi marocaine 09-08 CNDP, NF-02).
  3. Lancer le calcul des agrégats quotidiens :
     ```bash
     pnpm stats:backfill
     pnpm stats:verify
     ```
  4. Se connecter au back-office et ouvrir la page Statistiques (`/stats`).
  5. Contrôler l'exactitude des 7 cartes de synthèse : total des sessions, durée moyenne, visites ouvertes, scènes vues, taux d'utilisation VR, scans QR (`src=kiosk`).
  6. Vérifier la cohérence des graphiques SVG chronologiques et de la distribution par tranche horaire.
  7. Tester les filtres dynamiques : filtrer sur l'hôtel de démonstration, sur une visite spécifique, sur le canal `KIOSK`, et sur la langue française.
  8. Cliquer sur « Exporter en CSV » (`GET /api/v1/admin/stats/export.csv`) :
     - Vérifier la présence du BOM UTF-8 (`\uFEFF`) en début de fichier.
     - Vérifier que le séparateur utilisé est le point-virgule `;` pour ouverture directe dans Excel sans assistant d'import.
     - Vérifier que toute valeur débutant par `=`, `+`, `-` ou `@` est préfixée d'une apostrophe pour neutraliser toute tentative d'injection de formule (CSV Injection).
  9. Lancer la commande de prévisualisation du rapport mensuel PDF :
     ```bash
     pnpm report:preview
     ```
  10. Ouvrir le PDF généré dans `$env:TEMP` : vérifier le respect strict de la charte Xplor (bandeau violet `#6958A5`, tableau des visites populaires, indicateurs clés du mois).
- **Résultat attendu :** Ingestion performante et respectueuse de la vie privée (zéro IP) ; calcul d'agrégats idempotent ; tableau de bord décisionnel complet et réactif ; export CSV sécurisé et lisible sous Excel ; rapport PDF mensuel fidèle à la charte.

### 4.9 Scénario R-09 : Journal d'audit et traçabilité des opérations sensibles
- **Objectif :** Valider l'enregistrement systématique des opérations critiques dans `AuditLog`, le masquage des secrets et la consultation réservée à l'administrateur.
- **Acteurs :** Administrateur (`admin@xplor.local`), Gestionnaire (`manager@xplor.local`).
- **Prérequis :** API et back-office démarrés, compte administrateur connecté.
- **Procédure pas à pas :**
  1. Effectuer successivement les opérations suivantes dans le back-office :
     - Se connecter en ADMIN, puis simuler un échec de connexion avec un mauvais mot de passe.
     - Publier une visite virtuelle, puis la dépublier.
     - Modifier la sélection de visites d'un hôtel.
     - Créer un kiosque, puis le désactiver.
     - Modifier le rôle ou les droits d'un utilisateur.
  2. Ouvrir la page Journal d'Audit (`/audit`, API-30).
  3. Vérifier que chaque opération ci-dessus fait l'objet d'une ligne d'audit détaillée :
     - Horodatage ISO 8601 précis.
     - Identifiant et e-mail de l'auteur.
     - Action catégorisée (`USER_LOGIN`, `USER_LOGIN_FAILED`, `TOUR_PUBLISH`, `TOUR_UNPUBLISH`, `SELECTION_UPDATE`, `KIOSK_DISABLE`, `USER_UPDATE`).
     - Type d'entité et identifiant de la cible.
     - Adresse IP cliente anonymisée.
  4. Cliquer pour afficher le diff JSON détaillé d'une ligne :
     - Confirmer formellement qu'aucun mot de passe en clair, hash (`passwordHash`), secret TOTP (`totpSecret`) ou jeton de sécurité (`tokenHash`, `token`) ne figure dans les diffs.
  5. Tester le formulaire de filtrage du journal : filtrer par action (`TOUR_PUBLISH`), par utilisateur et par date.
  6. Se connecter avec le profil `HOTEL_MANAGER` et tenter d'accéder à `/audit` ou d'appeler `GET /api/v1/admin/audit` : constater le refus immédiat avec code HTTP 403 Forbidden.
- **Résultat attendu :** Traçabilité exhaustive des actions sensibles ; occultation stricte des données confidentielles (A09:2021) ; consultation ergonomique et filtrable réservée au seul rôle `ADMIN`.

### 4.10 Scénario R-10 : Cloisonnement strict et isolation multi-tenant
- **Objectif :** Prouver l'étanchéité absolue entre établissements hôteliers : un gestionnaire de l'Hôtel A ne peut accéder à aucune ressource de l'Hôtel B.
- **Acteurs :** Gestionnaire Hôtel A (`manager@xplor.local`), Gestionnaire Hôtel B, Partenaire (`partner@xplor.local`).
- **Prérequis :** Deux hôtels configurés en base avec sélections et kiosques distincts.
- **Procédure pas à pas :**
  1. Récupérer l'identifiant UUID de l'Hôtel B (`hotelB_id`).
  2. Se connecter sur le back-office avec le compte de l'Hôtel A (`manager@xplor.local`).
  3. Constater que la sélection et les kiosques affichés correspondent exclusivement à l'Hôtel A.
  4. Tenter d'ouvrir directement l'URL de la sélection de l'Hôtel B dans le navigateur :
     `http://localhost:5173/hotels/{hotelB_id}/selection`
  5. Constater que la vue affiche un écran d'erreur d'autorisation ou ressource introuvable sans exposer aucune donnée.
  6. Tester directement les appels API avec les cookies de session du gestionnaire A :
     - `GET /api/v1/admin/hotels/{hotelB_id}` → HTTP 404 Not Found.
     - `GET /api/v1/admin/hotels/{hotelB_id}/selection` → HTTP 404 Not Found.
     - `PUT /api/v1/admin/hotels/{hotelB_id}/selection` → HTTP 404 Not Found.
     - `GET /api/v1/admin/stats/summary?hotelId={hotelB_id}` → HTTP 404 Not Found.
  7. Se connecter avec le profil Partenaire (`partner@xplor.local`) :
     - Ouvrir la rubrique Statistiques : vérifier que les indicateurs affichés sont strictement globaux et agrégés.
     - Vérifier qu'aucun sélecteur d'hôtel individuel n'est proposé et que toute tentative d'interrogation filtrée par `hotelId` est rejetée ou ignorée conformément à la décision D-04.
- **Résultat attendu :** Isolation multi-tenant sans faille garantie par `AccessPolicy` et les filtres Prisma systématiques ; réponses 404 étanches ne divulguant même pas l'existence des identifiants tiers ; restriction partenaire respectée.

### 4.11 Scénario R-11 : Cycle de vie des identifiants et réinitialisation de mot de passe
- **Objectif :** Valider le flux sécurisé de récupération de compte par courriel, le contrôle de robustesse des mots de passe et la protection anti-force brute.
- **Acteurs :** Utilisateur enregistré (`editor@xplor.local`).
- **Prérequis :** Serveur Mailpit actif sur le port 1025/8025.
- **Procédure pas à pas :**
  1. Sur l'écran de connexion du back-office, cliquer sur « Mot de passe oublié » (`/forgot`).
  2. Renseigner `editor@xplor.local` et soumettre la demande : constater le message d'information neutre (ne confirmant ni n'infirmant l'existence du compte).
  3. Ouvrir l'interface Mailpit (`http://localhost:8025/`) et localiser le courriel de réinitialisation reçu.
  4. Vérifier que le message contient un lien unique avec jeton sécurisé temporaire (durée de validité 48 h).
  5. Cliquer sur le lien ouvrant la page `/reset/:token`.
  6. Tenter de soumettre un mot de passe non conforme :
     - Moins de 12 caractères (ex. `Azerty123!`).
     - Mot de passe issu des dictionnaires courants (ex. `Password123456!`).
     - Vérifier le rejet immédiat avec les règles d'exigence affichées.
  7. Saisir un mot de passe conforme et robuste, confirmer et valider : message de succès.
  8. Se connecter avec le nouveau mot de passe : connexion immédiate validée.
  9. Sur l'écran de connexion, tester la protection anti-force brute : soumettre 10 fois de suite un mot de passe erroné pour ce compte.
  10. À la 10e tentative, vérifier que le compte est verrouillé (code HTTP 423 `ACCOUNT_LOCKED`) pendant 15 minutes, bloquant toute nouvelle tentative même avec le mot de passe correct.
- **Résultat attendu :** Procédure de réinitialisation sécurisée par e-mail sans fuite d'information ; validation stricte de la complexité des mots de passe ; verrouillage temporaire effectif contre les attaques automatisées.

### 4.12 Scénario R-12 : Disponibilité, sécurité HTTP et accessibilité WCAG 2.1 AA
- **Objectif :** Valider la sonde de disponibilité système `/api/health`, le durcissement des en-têtes HTTP de sécurité et la conformité d'accessibilité WCAG 2.1 AA.
- **Acteurs :** Auditeur technique / Équipe exploitation.
- **Prérequis :** Ensemble des conteneurs et services démarrés.
- **Procédure pas à pas :**
  1. Interroger le point de contrôle de santé :
     ```bash
     curl -i http://localhost:3000/api/health
     ```
     - Vérifier le code HTTP 200 OK.
     - Vérifier le corps JSON détaillant l'état `ok` des 3 sondes actives : `db` (PostgreSQL), `redis` (Redis 7), `storage` (MinIO/S3).
     - Vérifier le temps de réponse global (< 2 000 ms, NF-04).
  2. Inspecter les en-têtes HTTP retournés par l'API :
     - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';`
     - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
     - `X-Content-Type-Options: nosniff`
     - `Access-Control-Allow-Origin` strictement limité aux sous-domaines Xplor autorisés.
  3. Consulter la page publique `/v/legal` : vérifier la présence des mentions légales et de la politique de traitement des données conforme à la loi 09-08 CNDP.
  4. Lancer la suite de tests automatisés d'accessibilité Playwright Axe (`e2e/back-office.spec.ts` et `e2e/m3-viewer.spec.ts`, D-141) :
     - Vérifier qu'aucune violation WCAG 2.1 AA n'est détectée sur la mire de connexion, le tableau de bord et la visionneuse publique.
  5. Tester manuellement la navigation au clavier : tabulation logique visible, piégeage du focus dans les modales, fermeture par la touche Échap.
  6. Sur l'application kiosque (`apps/kiosk`), vérifier le respect des gabarits tactiles minimaux : zones de contact ≥ 48 px et typographie d'interface ≥ 18 px (NF-05).
- **Résultat attendu :** Sonde `/api/health` opérationnelle ; en-têtes de sécurité conformes aux recommandations OWASP ; mentions légales conformes CNDP ; conformité d'accessibilité WCAG 2.1 AA attestée par Axe ; ergonomie tactile kiosque validée.

---

## 5. Matrice de Couverture des Exigences et Jalons

| Jalon | Intitulé | Exigences couvertes | Scénarios de recette associés |
|---|---|---|---|
| **M0** | Socle technique | NF-06, NF-08, NF-09, F-90 (sans 2FA) | **R-01, R-11, R-12** |
| **M1** | Modèle de données & CRUD | F-01, F-02, F-03, F-04, F-05, API-21, API-22, API-23, API-25 | **R-02, R-04, R-05** |
| **M2** | Pipeline médias 360° | F-10, F-11, F-12, API-24 | **R-03** |
| **M3** | Visionneuse web & partage | F-30 à F-35, F-40 à F-42, API-10, API-11, API-12 | **R-05** |
| **M3b** | Déploiement en ligne bêta | NF-01 (partiel), NF-10 (partiel) | **R-05, R-12** |
| **M4** | Éditeur visuel 360° | F-20, F-21, F-22, F-23, F-24, F-25 | **R-04** |
| **M5** | Hôtels, sélections & kiosque | F-50 à F-54, F-60 à F-67, API-01, API-02, API-03, API-26, API-27 | **R-02, R-06, R-10** |
| **M6** | Mode casque VR WebXR | F-70, F-71, F-72, F-73 | **R-07** |
| **M7** | Statistiques & reporting | F-80, F-81, F-82, F-83, API-29 | **R-08, R-10** |
| **M8** | Durcissement, audit & pilote | NF-01 à NF-05, F-90 (2FA), F-91, API-28, API-30 | **R-01, R-08, R-09, R-10, R-11, R-12** |

---

## 6. Modalités de Clôture et Validation du PV de Recette (Partie 2/2)

Lors de la session d'exécution de la recette (Partie 2/2) :
1. Chaque scénario R-01 à R-12 sera déroulé pas à pas conformément au protocole.
2. Pour chaque ligne du tableau maître (Section 3) :
   - La colonne **Résultat obtenu** sera complétée avec le constat réel et les preuves d'exécution (identifiants d'objets créés, logs de confirmation, codes HTTP observés, captures d'écran).
   - La colonne **Statut** passera de `à exécuter` à `CONFORME` (ou `NON CONFORME` / `RÉSERVE` le cas échéant).
3. Tout écart ou anomalie identifié fera l'objet d'une fiche d'incident avec son niveau de sévérité (Bloquant, Majeur, Mineur) et sera consigné dans `docs/DECISIONS.md` et `docs/PROGRESS.md`.
4. Le livrable final constituera le **Procès-Verbal (PV) de recette fonctionnelle** officiel permettant la validation du jalon M8 par le porteur du projet et le lancement du déploiement pilote en hôtel partenaire.
