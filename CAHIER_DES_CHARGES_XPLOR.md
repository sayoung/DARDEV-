# Cahier des charges — Plateforme Xplor (Phase 1)

> **Destinataire :** agent IA de développement (et équipe DARDEV).
> **Version :** 2.0 — 29/09/2026 (pile technique : Node.js / TypeScript, remplace la v1.0 Drupal)
> **Porteur :** Mourad DARDARI — DARDEV, Rabat
> **Statut :** référence de développement. Toute décision qui s'écarte de ce document est consignée dans `docs/DECISIONS.md`.

---

## 0. Comment l'agent doit utiliser ce document

1. Lire ce document **en entier** avant tout code, puis lire `AGENTS.md` (règles de travail).
2. Travailler **jalon par jalon** (section 9), dans l'ordre. Ne jamais commencer le jalon N+1 tant que la *Definition of Done* du jalon N n'est pas remplie.
3. Chaque exigence porte un identifiant (`F-xx`, `NF-xx`, `API-xx`). Les commits, tests et le fichier `docs/PROGRESS.md` référencent ces identifiants.
4. Les sections marquées **[HYPOTHÈSE]** sont des choix par défaut : les appliquer, mais les lister dans `docs/DECISIONS.md` pour validation par le porteur.
5. En cas d'ambiguïté bloquante : choisir l'option la plus simple et réversible, la documenter, continuer. Ne jamais inventer d'exigence métier non décrite ici.

---

## 1. Contexte

**Xplor** installe des kiosques de réalité virtuelle dans les halls d'hôtels 4★, 5★ et de luxe (région Rabat-Salé-Kénitra au lancement). Les clients y découvrent en immersion les attractions locales (monuments, médinas, plages, gastronomie…) avant de les visiter réellement.

La **plateforme Xplor** est l'espace en ligne qui permet de :
- créer et gérer les **visites virtuelles 360°** (panoramas, scènes, points d'intérêt) ;
- **naviguer entre les scènes et entre les visites** (hotspots de navigation) ;
- piloter les **kiosques** installés dans les hôtels (contenus, langues, mises à jour à distance) ;
- mesurer l'usage (**statistiques** anonymes) pour les hôtels et les partenaires (SMIT, ministères).

Budget de la phase 1 (développement de la plateforme) : 150 000 MAD. Durée de la phase 1 : **9 mois**, en parallèle de la production des contenus VR.

---

## 2. Périmètre

### 2.1 Inclus en phase 1
| Bloc | Description |
|---|---|
| Back-office | Application web d'administration : visites, scènes, hotspots, catégories, villes, hôtels, kiosques, utilisateurs |
| Pipeline médias 360 | Import de panoramas équirectangulaires, validation, génération de dérivés et de tuiles |
| Éditeur visuel | Placement des hotspots à la souris directement sur le panorama |
| Visionneuse web | Lecteur 360° avec navigation entre scènes et entre visites, audio, fiches info |
| Application kiosque | Web app plein écran (PWA), fonctionnement hors-ligne, mode veille (« attract loop ») |
| Mode casque VR | Lecture immersive via WebXR sur casque autonome |
| Partage | Lien public et QR code par visite pour la revoir sur mobile |
| Statistiques | Collecte d'événements anonymes, tableau de bord, export CSV |
| Multilingue | Français (par défaut), arabe (RTL), anglais |

### 2.2 Exclu de la phase 1
Paiement en ligne, réservation d'excursions, application mobile native, comptes clients finaux, recommandations par IA, vidéos 360° en streaming adaptatif, marketplace de contenus tiers. Ces points sont prévus en phase 2 ou plus tard et **ne doivent pas être développés**.

---

## 3. Acteurs et rôles

| Rôle (`Role` enum) | Qui | Droits principaux |
|---|---|---|
| `ADMIN` | DARDEV | Tout : configuration, hôtels, kiosques, utilisateurs, contenus, statistiques globales |
| `EDITOR` | Équipe création de contenus VR | CRUD visites / scènes / hotspots / médias ; publication ; pas d'accès hôtels ni kiosques |
| `HOTEL_MANAGER` | Responsable d'un hôtel client | Voir le catalogue publié ; composer la sélection de visites de **son** hôtel ; voir les statistiques de **son** hôtel ; voir l'état de **ses** kiosques |
| `PARTNER` | SMIT, ministère (lecture) | Statistiques agrégées toutes régions, sans données par hôtel nominatives [HYPOTHÈSE] |
| Kiosque (appareil) | Machine authentifiée par jeton | Lecture du manifeste et des contenus de son hôtel ; envoi d'événements et de heartbeats |
| Visiteur anonyme | Client de l'hôtel / internaute | Lecture des visites publiées via lien public / QR |

Un utilisateur `HOTEL_MANAGER` est rattaché à un ou plusieurs hôtels (table `UserHotel`). **Tout accès à une donnée d'hôtel doit vérifier ce rattachement**, au niveau des routes unitaires ET des requêtes de listes/statistiques. Implémentation : un service `AccessPolicy` central, appelé par des guards NestJS, jamais de filtrage ad hoc dans les contrôleurs.

---

## 4. Architecture technique

### 4.1 Pile imposée
| Couche | Choix |
|---|---|
| Runtime | **Node.js 22 LTS**, **TypeScript 5** (`strict`) partout |
| API / serveur | **NestJS 11** (sur adaptateur **Fastify**) : modules, guards, pipes de validation, OpenAPI via `@nestjs/swagger` |
| Base de données | **PostgreSQL 16** |
| ORM / migrations | **Prisma** (`prisma migrate`) |
| Validation | **Zod** — schémas partagés entre API et front dans `packages/shared` |
| Files de tâches | **BullMQ** + **Redis 7** (traitement des panoramas, agrégation statistique, alertes) |
| Traitement d'images | **sharp** (liaison Node de libvips) |
| Stockage fichiers | Interface `StorageService` : disque local en dev, **S3 compatible** (MinIO / fournisseur) en production |
| Authentification | Sessions par cookie `httpOnly` + `SameSite=Lax` stockées en Redis, mots de passe **argon2id**, 2FA TOTP (`otplib`), protection CSRF (double-submit token) |
| Back-office (UI) | **React 19** + Vite + React Router + TanStack Query + react-hook-form + **i18next** + Tailwind CSS + shadcn/ui |
| Visionneuse 360 | **Photo Sphere Viewer v5** + plugins `VirtualTourPlugin`, `MarkersPlugin`, `GalleryPlugin`, `EquirectangularTilesAdapter` |
| Visionneuse web, kiosque, éditeur | TypeScript + Vite, **sans framework** pour `viewer-core` (léger, réutilisable partout) |
| Mode VR | WebXR (Three.js, déjà embarqué par Photo Sphere Viewer) |
| Courriels | nodemailer (SMTP) ; Mailpit en dev |
| Environnement local | **Docker Compose** (postgres, redis, minio, mailpit) + `pnpm` workspaces |
| Tests | **Vitest** (unitaires + intégration API avec base de test), **Supertest**, **Playwright** (E2E) |
| Qualité | ESLint + Prettier, `tsc --noEmit`, Knip (code mort) |
| CI | GitHub Actions : lint + typecheck + tests (services postgres/redis) à chaque push |

### 4.2 Structure du dépôt (monorepo pnpm)
```
xplor/
├── AGENTS.md
├── CAHIER_DES_CHARGES_XPLOR.md
├── docs/  (PROGRESS.md, DECISIONS.md, API.md, INSTALL.md, RECETTE.md, GUIDE_EDITEUR.md)
├── docker-compose.yml
├── package.json / pnpm-workspace.yaml
├── apps/
│   ├── api/                     # NestJS : modules auth, users, catalog, media, editor, hotels, kiosks, public, stats, audit
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/migrations/
│   │   ├── prisma/seed.ts       # données de démonstration
│   │   └── src/
│   ├── worker/                  # processus BullMQ séparé (panoramas, agrégats, alertes) — partage le code de apps/api
│   ├── admin/                   # back-office React (inclut l'éditeur visuel de hotspots)
│   ├── web/                     # visionneuse publique (lien / QR)
│   └── kiosk/                   # PWA kiosque (offline, veille, VR)
├── packages/
│   ├── shared/                  # schémas Zod, types, enums, constantes (événements, rôles, langues)
│   ├── viewer-core/             # lib TS : chargement d'une visite, PSV, hotspots, audio, i18n, WebXR, collecte d'événements
│   └── i18n/                    # fichiers de traduction de l'interface fr / ar / en
└── .github/workflows/ci.yml
```

### 4.3 Flux principaux
```
[Éditeur] --upload panorama--> [API] --job BullMQ--> [worker : sharp → dérivés + tuiles] --> stockage (S3/disque)
[Éditeur] --place hotspots (admin)--> [API /editor]
[Kiosque] --GET manifest (jeton)--> [API] --> liste visites + versions + URLs assets
[Kiosque] --télécharge / met en cache (Service Worker)--> joue hors-ligne
[Kiosque] --POST events (lots) + heartbeat--> [API stats]
[Mobile] --scan QR--> /v/{shareToken} --> [apps/web] --> API publique
```
Déploiement : un reverse proxy (Nginx ou Caddy) sert les builds statiques `admin`, `web`, `kiosk` et route `/api` vers le processus `api`. Le `worker` tourne comme service séparé.

---

## 5. Modèle de données

Conventions :
- Défini dans `apps/api/prisma/schema.prisma`. Identifiants **UUID v7** (`@default(uuid(7))`) ; les API n'exposent que ces UUID.
- Tous les modèles ont `createdAt`, `updatedAt` ; les contenus ont `createdById`.
- Champs **traduisibles** 🌐 : type `Json` (JSONB) au format `LocalizedText = { fr: string; ar?: string; en?: string }`, validé par Zod. `fr` est obligatoire. Fonction utilitaire `localize(text, lang)` avec repli sur `fr`.
- Suppression : logique (`deletedAt`) pour `Tour`, `Scene`, `Hotel`, `Kiosk` ; physique pour les autres.

### 5.1 Référentiels
| Modèle | Champs | Exemples |
|---|---|---|
| `City` (ville / zone) | `name` 🌐, `region` (string), `lat`, `lng` | Rabat, Salé, Kénitra, Témara |
| `Category` | `name` 🌐, `icon` (string), `color` (hex), `weight` | Monuments, Médina, Plages, Gastronomie, Nature, Artisanat |

### 5.2 `Tour` — Visite virtuelle
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `title` 🌐 | Json | oui | |
| `summary` 🌐 | Json (≤ 500 car. par langue) | oui | Affiché sur la carte de sélection |
| `description` 🌐 | Json | non | Texte riche (HTML filtré, voir NF-01) |
| `cityId` | → `City` | oui | |
| `categories` | ↔ `Category` (relation n-n) | oui | |
| `coverAssetId` | → `Asset` (image) | oui | Vignette 16:9 |
| `startSceneId` | → `Scene` | oui pour publier | Doit appartenir à cette visite (validation) |
| `durationMinutes` | Int | non | Durée indicative |
| `lat`, `lng` | Float | non | Position du lieu réel |
| `practicalInfo` 🌐 | Json | non | Horaires, accès, tarif du lieu réel |
| `shareToken` | String(22), unique | auto | Aléatoire (`nanoid`), régénérable ; sert au lien public |
| `publicShare` | Boolean | défaut `false` | Autorise l'accès via lien/QR |
| `contentVersion` | Int | auto | Incrémenté à chaque modification de la visite, de ses scènes ou hotspots (dans la même transaction) |
| `status` | enum `DRAFT`, `PUBLISHED` | | |
| `publishedAt` | DateTime? | | |

### 5.3 `Scene` — Scène (un panorama 360°)
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `tourId` | → `Tour` | oui | Une scène appartient à une seule visite |
| `title` 🌐 | Json | oui | |
| `caption` 🌐 | Json | non | Sous-titre affiché dans la visionneuse |
| `panoramaAssetId` | → `Asset` (kind `PANORAMA`) | oui | |
| `initialYaw` | Float (rad) | défaut 0 | Vue initiale |
| `initialPitch` | Float (rad) | défaut 0 | |
| `initialZoom` | Int 0–100 | défaut 50 | |
| `narration` | Json `{ fr?: assetId, ar?: assetId, en?: assetId }` | non | Une piste audio par langue |
| `ambientAssetId` | → `Asset` (audio) | non | Son d'ambiance non traduit |
| `mapX`, `mapY` | Float 0–1 | non | Position sur le plan de la visite (phase 2) |
| `weight` | Int | | Ordre dans la galerie |

### 5.4 `Hotspot` — Point cliquable dans une scène
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `sceneId` | → `Scene` | oui | Scène où le hotspot est affiché |
| `type` | enum | oui | `SCENE_LINK`, `TOUR_LINK`, `INFO`, `MEDIA`, `URL` |
| `yaw`, `pitch` | Float (rad) | oui | Position sur la sphère |
| `label` 🌐 | Json | oui | Infobulle |
| `targetSceneId` | → `Scene` | si `SCENE_LINK` | Même visite, différente de `sceneId` |
| `targetTourId` | → `Tour` | si `TOUR_LINK` | Ouvre une autre visite (navigation inter-visites) |
| `targetTourSceneId` | → `Scene` | non | Si `TOUR_LINK` : scène d'arrivée (sinon `startScene`) |
| `body` 🌐 | Json | si `INFO` | Fiche d'information (HTML filtré) |
| `mediaAssetIds` | String[] | si `MEDIA` | Images, vidéo ou audio |
| `url` | String | si `URL` | **Désactivé en mode kiosque** (pas de sortie vers le web) |
| `icon` | enum | défaut selon type | `ARROW`, `INFO`, `PHOTO`, `PLAY`, `PORTAL` |
| `arrivalYaw` | Float? | non | Orientation à l'arrivée dans la scène cible |

Règles de validation (service `TourValidationService`, testées unitairement) :
- `SCENE_LINK` : `targetSceneId` obligatoire, dans la même visite, différente de `sceneId`.
- `TOUR_LINK` : `targetTourId` obligatoire et différent de la visite courante ; `targetTourSceneId`, si présent, appartient à `targetTourId`.
- Une visite ne peut être publiée que si : `startSceneId` défini, chaque scène a un panorama `READY`, toutes les scènes sont atteignables depuis la scène de départ (parcours de graphe), aucun hotspot ne pointe vers une scène supprimée ou une visite non publiée. En cas d'échec : réponse `422` listant chaque problème (code, scène, message en français).

### 5.5 `Asset` — Fichier média
| Champ | Type | Notes |
|---|---|---|
| `kind` | enum `PANORAMA`, `IMAGE`, `AUDIO`, `VIDEO` | |
| `originalKey` | String | Clé de stockage du fichier original |
| `mimeType`, `sizeBytes`, `width`, `height`, `durationMs` | | Métadonnées extraites à l'upload |
| `contentHash` | String (sha256) | Détection des doublons, chemins immuables |
| `captureDevice` | enum `INSTA360_PRO2`, `INSTA360_X4`, `OTHER` | Panoramas uniquement |
| `capturedOn` | DateTime? | |
| `processingStatus` | enum `PENDING`, `PROCESSING`, `READY`, `ERROR` | |
| `processingLog` | String? | Message d'erreur lisible |
| `derivatives` | Json | Clés générées (voir 6.2) |
| `copyright` | String? | |

### 5.6 `Hotel` — Hôtel client
| Champ | Type | Notes |
|---|---|---|
| `name` | String | |
| `stars` | enum `FOUR`, `FIVE`, `LUXURY` | |
| `cityId` | → `City` | |
| `address`, `phone`, `email` | String | Contact de l'hôtel (données pro, pas de données clients) |
| `logoAssetId` | → `Asset` | Affiché sur le kiosque |
| `brandColor` | String (hex) | Couleur d'accent de l'interface kiosque |
| `languages` | String[] (`fr`, `ar`, `en`) | Langues proposées ; la première est la langue par défaut |
| `contractType` | enum `SALE`, `RENTAL` | Vente clé en main / location |
| `contractStart`, `contractEnd` | DateTime | Contrat expiré → écran « service suspendu » sur les kiosques |
| `maintenancePinHash` | String | PIN de l'écran technique kiosque (haché argon2) |
| `active` | Boolean | |

### 5.7 `Selection` — Sélection de visites d'un hôtel
| Champ | Type | Notes |
|---|---|---|
| `hotelId` | → `Hotel`, unique | Une sélection par hôtel en phase 1 |
| `items` | → `SelectionItem { tourId, position }` | Liste **ordonnée** ; seules les visites publiées sont diffusées |
| `featuredTourId` | → `Tour`? | Mise en avant sur l'écran d'accueil |
| `attractTourIds` | String[] | Visites jouées en boucle en mode veille |
| `version` | Int | Incrémenté à chaque modification ; entre dans la version du manifeste |

### 5.8 `Kiosk` — Kiosque (appareil)
| Champ | Type | Notes |
|---|---|---|
| `label` | String | Ex. « Hall principal » |
| `hotelId` | → `Hotel` | |
| `deviceType` | enum `TOUCH_SCREEN`, `VR_HEADSET`, `TOUCH_AND_HEADSET` | |
| `enrollmentCode` | String(8)? | Usage unique, expiration 24 h (`enrollmentExpiresAt`) |
| `tokenHash` | String? | Hash sha256 du jeton d'appareil (jeton aléatoire 256 bits → hash rapide suffisant). **Le jeton en clair n'est jamais stocké.** |
| `lastHeartbeatAt` | DateTime? | |
| `lastIp` | String? | Donnée technique de l'appareil, pas d'un voyageur |
| `appVersion` | String? | |
| `syncedManifestVersion` | String? | Version confirmée par le kiosque |
| `storageFreeMb` | Int? | Remonté par heartbeat |
| `idleTimeoutSeconds` | Int | Défaut 90 : retour à l'accueil sans interaction |
| `status` | enum `PENDING`, `ACTIVE`, `DISABLED` | |

État calculé (non stocké) : **en ligne** si heartbeat < 10 min, **hors ligne** sinon, **désynchronisé** si `syncedManifestVersion` ≠ version courante.

### 5.9 `Event` — Événements statistiques
Volume attendu élevé : table **partitionnée par mois** (partitionnement déclaratif PostgreSQL, créé par migration SQL brute), insertions par lots (`createMany`).

| Colonne | Type | Notes |
|---|---|---|
| `id` | BigInt (identity) | |
| `kioskId` | UUID? (index) | NULL pour la visionneuse web publique |
| `hotelId` | UUID? (index) | Dénormalisé pour les requêtes |
| `channel` | enum `KIOSK`, `VR`, `WEB` | |
| `sessionId` | UUID | Généré côté client, **pas lié à une personne** |
| `type` | enum | `SESSION_START`, `SESSION_END`, `TOUR_OPEN`, `SCENE_VIEW`, `HOTSPOT_CLICK`, `AUDIO_PLAY`, `VR_ENTER`, `VR_EXIT`, `QR_SHOWN`, `LANG_CHANGE` |
| `tourId`, `sceneId`, `hotspotId` | UUID? | |
| `lang` | String(8) | |
| `durationMs` | Int? | Pour `SCENE_VIEW`, `SESSION_END` |
| `occurredAt` | Timestamptz | Horodatage client |
| `receivedAt` | Timestamptz | Horodatage serveur |

Table d'agrégats `StatsDaily` (jour × hôtel × visite × canal × langue : sessions, vues, durée totale, clics, entrées VR), recalculée par un job BullMQ répété (toutes les heures pour la veille et le jour courant). Événements bruts conservés 13 mois (suppression de partition) [HYPOTHÈSE].

### 5.10 Utilisateurs et audit
- `User` : `email` (unique), `name`, `passwordHash` (argon2id), `role`, `totpSecret` (chiffré AES-256-GCM avec une clé d'environnement), `totpEnabled`, `lastLoginAt`, `active`, `uiLang`.
- `UserHotel` : (`userId`, `hotelId`) clé composite.
- `AuditLog` : `userId?`, `kioskId?`, `action` (string), `entityType`, `entityId`, `diff` (Json), `ip`, `createdAt`.

### 5.11 Schéma relationnel (résumé)
```
City 1─* Tour *─* Category
Tour 1─* Scene 1─* Hotspot
Hotspot *─1 Scene (targetScene)   ← navigation intra-visite
Hotspot *─1 Tour  (targetTour)    ← navigation inter-visites
Scene *─1 Asset (PANORAMA)
Hotel 1─1 Selection 1─* SelectionItem *─1 Tour
Hotel 1─* Kiosk
User *─* Hotel (UserHotel)
Event → Kiosk, Hotel, Tour, Scene, Hotspot (sans clés étrangères, pour la performance d'insertion)
```

---

## 6. Exigences fonctionnelles

Format : **ID — Exigence** puis *Critères d'acceptation (CA)*. Chaque CA doit être couvert par au moins un test automatisé ou, à défaut, un scénario de recette manuel dans `docs/RECETTE.md`.

### 6.1 Back-office — Contenus (`apps/admin`)
**F-01 — Gestion des visites.** Liste paginée et filtrable (ville, catégorie, statut, langue manquante, texte) ; création, édition, duplication, dépublication.
*CA :* la liste affiche pour chaque visite le nombre de scènes, le statut de traitement des panoramas et les langues traduites ; la duplication copie scènes et hotspots avec remappage des références internes (transaction unique).

**F-02 — Gestion des scènes.** Depuis la fiche d'une visite : ajout de scènes par **upload multiple** de panoramas (glisser-déposer, jusqu'à 20 fichiers, upload direct vers le stockage via URL pré-signée), réordonnancement par glisser-déposer, choix de la scène de départ.
*CA :* un upload de 10 panoramas crée 10 scènes en brouillon titrées d'après le nom de fichier ; l'interface montre la progression d'envoi puis de traitement de chaque panorama (rafraîchissement par polling 3 s ou SSE).

**F-03 — Validation de publication.** Implémente les règles de 5.4.
*CA :* tentative de publication d'une visite avec une scène inatteignable → refus avec la liste des scènes concernées, affichée dans l'interface avec lien vers chaque scène.

**F-04 — Multilingue des contenus.** Chaque champ 🌐 s'édite dans des onglets fr / ar / en (onglet ar en `dir="rtl"`) ; indicateur « traduction manquante ». Interface du back-office en français (arabe et anglais préparés dans `packages/i18n`).
*CA :* une visite sans traduction arabe est diffusée en arabe avec repli sur le français, et signalée dans la liste F-01.

**F-05 — Médiathèque.** Réutilisation de médias entre scènes ; types acceptés : JPEG/PNG/WebP (images), MP3/M4A (audio ≤ 20 Mo), MP4 H.264 (vidéo ≤ 200 Mo). Vérification du type réel par signature de fichier (pas seulement l'extension).

### 6.2 Pipeline médias 360 (`apps/worker`)
**F-10 — Validation à l'upload.** Refuser : ratio ≠ 2:1 (tolérance ±1 %), largeur < 4096 px, format hors JPEG, taille > 80 Mo.
*CA :* message d'erreur explicite en français indiquant la valeur attendue et la valeur reçue.

**F-11 — Génération des dérivés** (file BullMQ `panorama`, 2 tâches en parallèle max, 3 tentatives avec backoff) :
| Dérivé | Spécification | Usage |
|---|---|---|
| `preview` | 512×256 JPEG q70 | Vignette, chargement instantané (flou) |
| `web` | 4096×2048 JPEG q80 (mozjpeg) | Visionneuse mobile / web |
| `tiles` | Base 8192×4096 découpée en grille 16×8 tuiles de 512×512, JPEG q82 | `EquirectangularTilesAdapter` (kiosque, VR) |
| `thumb` | 400×225, recadrage centré sur la vue initiale | Galerie de scènes |

Clé de stockage : `panoramas/{assetId}/{contentHash}/…` — le hash dans le chemin permet un cache HTTP immuable (`Cache-Control: public, max-age=31536000, immutable`).
*CA :* un panorama 11 968×5 984 (Insta360 Pro 2) est traité en < 60 s sur le serveur cible ; en cas d'échec, statut `ERROR` avec journal lisible et bouton « relancer ».

**F-12 — Retraitement.** Script CLI `pnpm --filter api cli reprocess [--all | --asset=UUID]`.

### 6.3 Éditeur visuel de hotspots (dans `apps/admin`, s'appuie sur `packages/viewer-core`)
**F-20 — Éditeur intégré.** Sur la fiche d'une scène, onglet « Éditeur 360 » : panorama affiché dans Photo Sphere Viewer, hotspots existants visibles.

**F-21 — Placement.** Clic sur le panorama → création d'un hotspot aux coordonnées yaw/pitch cliquées ; panneau latéral pour choisir le type, la cible (liste des scènes de la visite / recherche de visites), le libellé dans chaque langue, l'icône.
*CA :* un hotspot créé est visible immédiatement, persistant après rechargement, et ses coordonnées stockées correspondent au point cliqué (écart < 0,01 rad).

**F-22 — Édition directe.** Glisser-déposer d'un hotspot pour le déplacer ; suppression ; annuler/rétablir (Ctrl+Z / Ctrl+Y) sur la session d'édition ; sauvegarde automatique (debounce 1 s) avec indicateur « Enregistré ».

**F-23 — Vue initiale et orientation d'arrivée.** Bouton « Définir la vue actuelle comme vue initiale » ; pour un hotspot `SCENE_LINK`, bouton « Définir l'orientation d'arrivée » qui ouvre la scène cible pour choisir la direction.

**F-24 — Prévisualisation.** Bouton « Tester la visite » qui ouvre la visionneuse (`apps/web`) en mode aperçu, y compris sur contenu non publié (jeton d'aperçu signé, valable 1 h, réservé aux utilisateurs connectés).

**F-25 — Carte des liens.** Vue graphe de la visite (scènes = nœuds, `SCENE_LINK` = flèches, `TOUR_LINK` = nœuds externes) signalant les scènes orphelines. Bibliothèque autorisée : React Flow ou Cytoscape.js.

### 6.4 Visionneuse (`packages/viewer-core`, utilisée par `web`, `kiosk` et l'aperçu admin)
**F-30 — Lecture d'une visite.** Charge le graphe JSON d'une visite (API-10) et l'affiche avec `VirtualTourPlugin` : scène de départ, vue initiale, transitions animées (fondu ~800 ms) entre scènes.

**F-31 — Navigation intra-visite.** Hotspots `SCENE_LINK` en flèches ; galerie de miniatures des scènes (`GalleryPlugin`) ; boutons précédent/suivant.

**F-32 — Navigation inter-visites.** Hotspot `TOUR_LINK` : icône « portail » ; au clic, confirmation courte (« Aller vers : Kasbah des Oudayas ») puis chargement de la visite cible à la scène indiquée ; bouton « Retour » qui revient à la visite et à la scène d'origine (pile d'historique).
*CA :* visite A → B → C → Retour → Retour ramène à la scène exacte de départ dans A.

**F-33 — Contenus enrichis.** `INFO` : panneau latéral avec texte et images ; `MEDIA` : lecteur photo/vidéo/audio en superposition ; narration audio de la scène avec bouton lecture/pause et sous-titre ; son d'ambiance à volume réduit.

**F-34 — Interface.** Sélecteur de langue ; plein écran ; mode gyroscope sur mobile ; bouton « Infos pratiques » (`practicalInfo` + position) ; affichage correct en **RTL** pour l'arabe.

**F-35 — Performances.** Affichage du `preview` flou < 1 s, puis montée en définition progressive ; préchargement des scènes cibles des hotspots visibles.

### 6.5 Visionneuse web publique et partage (`apps/web`)
**F-40 — Page publique.** URL `/v/{shareToken}` ; accessible sans connexion seulement si `publicShare = true` et visite publiée ; balises Open Graph (titre, résumé, couverture) injectées côté serveur par un petit endpoint de rendu HTML de l'API (pour les aperçus WhatsApp / Facebook).
**F-41 — QR code.** Génération d'un QR code (SVG, bibliothèque `qrcode`) par visite dans le back-office (téléchargeable) et affiché sur le kiosque à la fin d'une visite (« Revivez cette visite sur votre téléphone ») avec paramètre `?src=kiosk&h={hotelId}` pour la statistique.
**F-42 — Régénération du jeton** de partage (invalide les anciens liens).

### 6.6 Hôtels et kiosques
**F-50 — Gestion des hôtels.** CRUD réservé à `ADMIN` ; rattachement des gestionnaires.
**F-51 — Sélection.** Le gestionnaire compose la sélection de son hôtel depuis le catalogue publié (recherche, filtres ville/catégorie, glisser-déposer pour ordonner, visite mise en avant, visites du mode veille). Toute modification incrémente `Selection.version`.
**F-52 — Enrôlement d'un kiosque.** L'admin crée un kiosque → code d'enrôlement à 8 caractères affiché ; sur l'appareil, l'application kiosque demande le code, appelle API-01, reçoit un jeton d'appareil stocké localement (IndexedDB).
*CA :* un code ne peut être utilisé qu'une fois ; expiré après 24 h ; 5 échecs par IP en 15 min → blocage 15 min.
**F-53 — Supervision.** Tableau des kiosques : hôtel, état (en ligne / hors ligne / désynchronisé), dernier heartbeat, version d'application, espace libre ; actions « désactiver » (révoque le jeton) et « forcer la resynchronisation ».
**F-54 — Alerte.** Courriel aux `ADMIN` si un kiosque actif est hors ligne > 2 h entre 8 h et 22 h (fuseau `Africa/Casablanca`), via job BullMQ répété toutes les 15 min [HYPOTHÈSE].

### 6.7 Application kiosque (`apps/kiosk`)
**F-60 — PWA plein écran.** Lancée en mode kiosque navigateur (Chrome `--kiosk`) sur mini-PC + écran tactile [HYPOTHÈSE matériel] ; aucune barre d'adresse, pas de sortie possible vers le web, menu contextuel et sélection de texte désactivés.
**F-61 — Écran d'accueil.** Logo et couleur de l'hôtel ; choix de langue (drapeaux + nom de la langue) ; visite mise en avant ; grille des visites de la sélection filtrable par catégorie.
**F-62 — Hors-ligne.** Service Worker (Workbox) : au démarrage et toutes les 15 min, lecture du manifeste (API-02) ; téléchargement en arrière-plan des visites nouvelles ou modifiées (`contentVersion`) ; la version en cache reste jouée tant que la nouvelle n'est pas complètement téléchargée (bascule atomique) ; purge des visites retirées.
*CA :* câble réseau débranché → toutes les visites de la sélection restent jouables intégralement ; au retour du réseau, les événements en attente sont envoyés.
**F-63 — Mode veille (attract loop).** Après `idleTimeoutSeconds` sans interaction : retour à l'accueil, puis rotation automatique lente sur les visites `attractTourIds` avec message « Touchez l'écran pour explorer ». Toute session en cours est clôturée (`SESSION_END`).
**F-64 — Sessions.** Nouvelle `sessionId` à chaque sortie du mode veille ; aucune donnée personnelle collectée ni saisie.
**F-65 — Heartbeat.** Toutes les 5 min (API-03) : version d'app, version de manifeste synchronisée, espace de stockage libre (`navigator.storage.estimate`), erreurs récentes.
**F-66 — Contrat suspendu / kiosque désactivé.** Écran neutre « Service momentanément indisponible » ; aucune visite accessible.
**F-67 — Maintenance locale.** Geste caché (5 appuis sur le logo en 3 s) + code PIN de l'hôtel (vérifié par API, ou hash mis en cache pour le hors-ligne) → écran technique : état de synchro, forcer synchro, réenrôler, version.

### 6.8 Mode casque VR
**F-70 — Entrée en VR.** Bouton « Vivre en VR » si `navigator.xr.isSessionSupported('immersive-vr')` ; lecture de la même visite en WebXR sur casque autonome (Meta Quest 3 / Pico 4, navigateur intégré) [HYPOTHÈSE matériel].
**F-71 — Interaction en VR.** Sélection des hotspots par pointeur de manette ou regard fixe 2 s (gaze) ; transitions en fondu au noir (confort, pas de mouvement de caméra) ; panneau d'info affiché dans l'espace 3D.
**F-72 — Contraintes confort.** 72 fps minimum visés ; pas de rotation automatique en VR ; bouton de sortie toujours accessible.
**F-73 — Repli.** Si WebXR indisponible, le bouton n'est pas affiché (pas d'erreur).
Livrable minimal accepté : lecture d'une visite complète avec navigation par hotspots en VR. Les fiches `INFO` en VR peuvent se limiter au texte.

### 6.9 Statistiques
**F-80 — Collecte.** `viewer-core` émet les événements de 5.9 ; envoi par lots (max 50 événements ou 60 s) via API-04 ; file persistante en IndexedDB en cas de coupure.
**F-81 — Tableau de bord** (`apps/admin`). Filtres : période, hôtel (restreint à ses hôtels pour un gestionnaire), visite, canal, langue. Indicateurs :
- sessions, durée moyenne de session, visites ouvertes, scènes vues ;
- top 10 des visites et des scènes ; taux d'usage VR ; répartition par langue ;
- courbe journalière et histogramme par heure de la journée ;
- scans de QR (visites web avec `src=kiosk`).
Graphiques : Recharts (ou Chart.js).
**F-82 — Export CSV** des agrégats filtrés (séparateur `;`, UTF-8 avec BOM pour Excel).
**F-83 — Rapport mensuel.** Page HTML imprimable par hôtel (export PDF via Playwright côté worker), envoyée par courriel le 1er du mois [HYPOTHÈSE — reportable en phase 2 si retard].

### 6.10 Utilisateurs et sécurité applicative
**F-90 — Comptes.** Création par `ADMIN` uniquement (invitation par courriel, lien valable 48 h) ; pas d'inscription publique ; mot de passe ≥ 12 caractères vérifié contre une liste de mots de passe courants ; 2FA TOTP obligatoire pour `ADMIN` [HYPOTHÈSE] ; réinitialisation de mot de passe par courriel ; verrouillage 15 min après 10 échecs.
**F-91 — Journal d'audit.** Enregistrer dans `AuditLog` : publication/dépublication, suppression, création/désactivation de kiosque, modification de sélection, connexion et échec de connexion, changement de rôle. Consultation filtrable par `ADMIN`.

---

## 7. API (`apps/api`) — préfixe `/api/v1`

Format JSON, dates ISO 8601. Erreurs : `{"error": {"code": "string", "message": "string", "details"?: [...]}}` avec code HTTP adapté. Validation d'entrée par schémas Zod de `packages/shared` (pipe NestJS). Documentation OpenAPI générée automatiquement et servie sur `/api/docs` (admin connecté uniquement en production) ; `docs/API.md` résume les conventions.

### 7.1 Endpoints appareils et publics
| ID | Méthode & chemin | Auth | Rôle |
|---|---|---|---|
| API-01 | `POST /kiosk/enroll` `{code, deviceInfo}` → `{kioskId, token}` | aucune (limité en débit) | Enrôlement |
| API-02 | `GET /kiosk/manifest` | `Authorization: Bearer <jeton kiosque>` | Configuration + liste des visites à synchroniser |
| API-03 | `POST /kiosk/heartbeat` | Bearer | Supervision |
| API-04 | `POST /events` `{events: [...]}` (≤ 200) | Bearer (kiosque) ou anonyme (web, limité en débit, `channel=WEB` forcé) | Statistiques |
| API-10 | `GET /tours/:id?lang=fr` | Bearer kiosque (visite dans sa sélection) ou jeton d'aperçu (F-24) | Graphe complet d'une visite |
| API-11 | `GET /public/tours/:shareToken?lang=fr` | aucune | Idem, si `publicShare` |
| API-12 | `GET /public/share/:shareToken` (HTML) | aucune | Page HTML avec balises Open Graph qui charge `apps/web` |

### 7.2 Endpoints back-office (session + CSRF)
| ID | Ressource | Opérations |
|---|---|---|
| API-20 | `/auth` | `login`, `logout`, `me`, `totp/setup`, `totp/verify`, `password/forgot`, `password/reset`, `invite/accept` |
| API-21 | `/admin/tours` | liste (filtres, pagination), CRUD, `duplicate`, `publish`, `unpublish`, `validate`, `share-token/regenerate`, `qr.svg`, `graph` (F-25), `preview-token` |
| API-22 | `/admin/tours/:id/scenes`, `/admin/scenes/:id` | CRUD, `reorder`, `set-start` |
| API-23 | `/admin/scenes/:id/hotspots`, `/admin/hotspots/:id` | CRUD (éditeur F-20 à F-23) |
| API-24 | `/admin/assets` | `upload-url` (URL pré-signée), `complete`, liste, `reprocess`, suppression si non utilisé |
| API-25 | `/admin/cities`, `/admin/categories` | CRUD |
| API-26 | `/admin/hotels`, `/admin/hotels/:id/selection` | CRUD hôtels (ADMIN) ; lecture/écriture sélection (ADMIN ou gestionnaire rattaché) |
| API-27 | `/admin/kiosks` | CRUD, `enrollment-code`, `disable`, `force-sync`, statut calculé |
| API-28 | `/admin/users` | CRUD, invitation, rattachement hôtels (ADMIN) |
| API-29 | `/admin/stats` | `summary`, `timeseries`, `top-tours`, `top-scenes`, `export.csv` — filtrés par `AccessPolicy` |
| API-30 | `/admin/audit` | liste filtrable (ADMIN) |

### 7.3 Exemple de manifeste (API-02)
```json
{
  "manifestVersion": "s14-t9f2c1",
  "kiosk": { "id": "…", "label": "Hall principal", "idleTimeoutSeconds": 90, "deviceType": "TOUCH_AND_HEADSET" },
  "hotel": {
    "id": "…", "name": "Hôtel Exemple Rabat", "logoUrl": "https://…/logo.png",
    "brandColor": "#8A5A2B", "languages": ["fr", "ar", "en"], "serviceActive": true,
    "maintenancePinHash": "…"
  },
  "selection": {
    "featuredTourId": "uuid-A",
    "attractTourIds": ["uuid-A", "uuid-C"],
    "tours": [
      { "id": "uuid-A", "contentVersion": 12, "sizeBytes": 184000000, "url": "/api/v1/tours/uuid-A" }
    ]
  },
  "categories": [ { "id": "…", "name": { "fr": "Monuments", "ar": "مآثر", "en": "Monuments" }, "icon": "landmark", "color": "#1F6F8B" } ]
}
```
`manifestVersion` = hash court de (`Selection.version`, `contentVersion` de chaque visite, paramètres hôtel/kiosque).

### 7.4 Exemple de graphe de visite (API-10 / API-11)
```json
{
  "id": "uuid-A", "contentVersion": 12, "lang": "fr",
  "title": "Kasbah des Oudayas", "summary": "…", "city": "Rabat",
  "categories": ["Monuments", "Médina"],
  "coverUrl": "…", "practicalInfo": "…", "location": { "lat": 34.0314, "lng": -6.8363 },
  "startSceneId": "scene-1",
  "scenes": [
    {
      "id": "scene-1", "title": "Porte Bab Oudaya", "caption": "…",
      "panorama": {
        "preview": "…/preview.jpg", "web": "…/web.jpg",
        "tiles": { "width": 8192, "cols": 16, "rows": 8, "baseUrl": "…/tiles/{col}_{row}.jpg" }
      },
      "initialView": { "yaw": 0.0, "pitch": 0.05, "zoom": 50 },
      "narrationUrl": "…/fr.mp3", "ambientUrl": null, "thumb": "…",
      "hotspots": [
        { "id": "h1", "type": "SCENE_LINK", "yaw": 1.2, "pitch": -0.1, "label": "Entrer dans la kasbah", "icon": "ARROW", "targetSceneId": "scene-2", "arrivalYaw": 3.1 },
        { "id": "h2", "type": "TOUR_LINK", "yaw": -2.0, "pitch": 0.0, "label": "Aller au Jardin andalou", "icon": "PORTAL", "targetTourId": "uuid-B", "targetSceneId": null },
        { "id": "h3", "type": "INFO", "yaw": 0.4, "pitch": 0.3, "label": "Histoire de la porte", "icon": "INFO", "bodyHtml": "<p>…</p>", "images": ["…"] }
      ]
    }
  ],
  "linkedTours": [ { "id": "uuid-B", "title": "Jardin andalou", "coverUrl": "…", "availableOffline": true } ]
}
```
Règles : textes renvoyés dans la langue demandée avec repli sur `fr` ; `bodyHtml` assaini (liste blanche de balises, `sanitize-html`) ; un `TOUR_LINK` vers une visite absente de la sélection du kiosque est **omis** de la réponse kiosque (pas de lien mort hors-ligne) ; hotspots `URL` omis pour les kiosques ; cache HTTP `ETag` basé sur `contentVersion` + langue. Le type de cette réponse (`TourGraph`) est défini une seule fois dans `packages/shared` et utilisé par l'API et `viewer-core`.

---

## 8. Exigences non fonctionnelles

| ID | Exigence |
|---|---|
| NF-01 Sécurité | OWASP Top 10 ; contrôle d'accès testé pour chaque endpoint et chaque rôle ; jetons kiosque aléatoires 256 bits, stockés hachés, révocables ; `@nestjs/throttler` sur API-01, API-04 anonyme, `/auth/login` ; en-têtes via `@fastify/helmet` (CSP stricte, HSTS) ; CORS limité aux domaines Xplor ; HTML utilisateur assaini ; uploads vérifiés par signature ; `pnpm audit` en CI ; aucun secret dans le dépôt (`.env` ignoré, `.env.example` fourni). |
| NF-02 Données personnelles | Conformité **loi marocaine 09-08 (CNDP)** : aucune donnée personnelle de voyageur collectée ; statistiques anonymes par conception ; pas d'adresse IP stockée dans `Event` ; journaux applicatifs sans IP des visiteurs web au-delà de 30 jours ; mentions légales et politique de confidentialité sur la page publique. |
| NF-03 Performance | Back-office : réponses API < 300 ms (P95) ; manifeste < 200 ms (P95) ; visionneuse web : premier affichage < 3 s en 4G ; kiosque : changement de scène < 1 s depuis le cache ; insertion de 200 événements < 100 ms. |
| NF-04 Disponibilité | Le kiosque fonctionne 100 % hors-ligne sur les contenus synchronisés ; le serveur vise 99,5 % mensuel ; endpoint `/api/health` (base, Redis, stockage). |
| NF-05 Accessibilité | Back-office et page publique conformes WCAG 2.1 AA (contrastes, navigation clavier, libellés) ; kiosque : zones tactiles ≥ 48 px, textes ≥ 18 px, interface utilisable debout à 1 m. Contrôle automatique `@axe-core/playwright` dans les tests E2E. |
| NF-06 Multilingue | fr / ar / en ; RTL complet pour l'arabe (miroir de l'interface via propriétés CSS logiques, pas des panoramas) ; toutes les chaînes d'interface dans `packages/i18n` — aucune chaîne en dur ; test CI qui vérifie que toutes les clés existent dans les 3 langues. |
| NF-07 Compatibilité | Back-office : Chrome, Firefox, Edge, Safari (2 dernières versions). Kiosque : Chromium ≥ 120. Web mobile : iOS Safari 16+, Chrome Android. VR : navigateur Meta Quest / Pico. |
| NF-08 Qualité du code | TypeScript `strict` sans `any` explicite (règle ESLint) ; architecture NestJS par modules (contrôleur fin → service → Prisma) ; pas de logique métier dans les contrôleurs ; configuration par variables d'environnement validées au démarrage (Zod). Couverture de tests ≥ 70 % sur les modules `catalog`, `kiosks`, `stats`, `auth` et sur `viewer-core`. |
| NF-09 Reproductibilité | `docker compose up` + `pnpm install` + `pnpm db:migrate` + `pnpm db:seed` suffisent pour un environnement complet ; migrations Prisma versionnées, jamais modifiées une fois fusionnées. |
| NF-10 Exploitation | Hébergement Linux (Docker Compose en production ou services systemd) : Nginx/Caddy + Node 22 + PostgreSQL 16 + Redis 7 + stockage S3 compatible ; sauvegardes quotidiennes base (`pg_dump`) + fichiers, rétention 30 jours, test de restauration documenté ; journaux structurés JSON (`pino`) ; procédure de déploiement dans `docs/INSTALL.md`. |
| NF-11 Volumétrie cible fin phase 1 | 30 visites, 300 scènes, 30 hôtels, 60 kiosques, 5 millions d'événements/an [HYPOTHÈSE]. |

---

## 9. Planning de la phase 1 (9 mois ≈ 39 semaines)

Démarrage prévu : **S1 = semaine du 5 octobre 2026** [HYPOTHÈSE]. Sprints de 2 semaines. Chaque jalon se termine par une **démo** au porteur et une mise à jour de `docs/PROGRESS.md`.

| Jalon | Semaines | Contenu | Exigences | Livrable de fin |
|---|---|---|---|---|
| **M0 — Socle** | S1–S2 | Monorepo pnpm, Docker Compose, NestJS + Prisma + PostgreSQL, squelettes `admin`/`web`/`kiosk`/`worker`, `packages/shared` et `i18n`, CI, authentification (login, sessions, rôles, `AccessPolicy`), healthcheck | NF-06, NF-08, NF-09, F-90 (sans 2FA) | Environnement complet en 4 commandes ; connexion au back-office ; CI verte |
| **M1 — Modèle de données** | S3–S6 | Schéma Prisma 5.1 à 5.8, API-21/22/23/25 (CRUD), écrans admin de liste et de formulaire, onglets de traduction, règles de validation | F-01, F-02 (sans traitement), F-03, F-04, F-05 | Création d'une visite de 3 scènes et hotspots (coordonnées saisies à la main) via le back-office |
| **M2 — Pipeline 360** | S7–S10 | `Asset`, upload pré-signé, validation, worker BullMQ + sharp, dérivés, tuiles, CLI de retraitement | F-10, F-11, F-12, API-24 | Upload de 10 panoramas Insta360 → tous `READY` |
| **M3 — Visionneuse** | S11–S15 | `viewer-core`, `apps/web`, API-10/11/12, navigation scènes + inter-visites + historique, contenus enrichis, RTL, page `/v/`, QR | F-30 à F-35, F-40 à F-42 | **Démo 1 :** visite réelle de Rabat consultable sur mobile via QR |
| **M4 — Éditeur visuel** | S16–S20 | Éditeur dans `apps/admin`, placement / déplacement / annuler, vue initiale, orientation d'arrivée, aperçu, carte des liens | F-20 à F-25 | L'équipe contenus produit une visite complète **sans aide technique** |
| **M5 — Hôtels & kiosque** | S21–S25 | Hôtels, sélections, kiosques, enrôlement, manifeste, heartbeat, PWA kiosque, hors-ligne, mode veille, supervision, alertes | F-50 à F-54, F-60 à F-67, API-01 à 03, API-26/27 | **Démo 2 :** kiosque de test enrôlé, fonctionnant réseau coupé |
| **M6 — Mode VR** | S26–S29 | WebXR, interactions pointeur/gaze, fondus, panneaux 3D, tests sur casque réel | F-70 à F-73 | Visite complète jouable sur casque |
| **M7 — Statistiques** | S30–S33 | Collecte, file IndexedDB, API-04, table partitionnée, agrégation, tableau de bord, filtres par rôle, export CSV, rapport mensuel | F-80 à F-83, API-29 | Tableau de bord alimenté par une semaine d'usage simulé (script de génération d'événements) |
| **M8 — Durcissement & pilote** | S34–S37 | Audit sécurité (NF-01), 2FA, journal d'audit, performance (tests de charge k6), accessibilité, recette complète, **pilote dans 1 hôtel partenaire** | NF-01 à NF-05, F-90 (2FA), F-91, API-28/30 | PV de recette ; rapport de pilote ; correctifs |
| **M9 — Livraison** | S38–S39 | Documentation (installation, exploitation, guide éditeur, guide gestionnaire hôtel), formation, mise en production, backlog phase 2 | NF-10 | Plateforme en production, prête pour la phase 2 (installation dans 5 hôtels) |

**Piste parallèle — contenus VR (équipe création, hors agent) :** tournages Insta360 à partir de S5 ; premières visites intégrées au M3 (tests réels) ; objectif fin de phase 1 : **≥ 15 visites publiées** en fr/ar/en [HYPOTHÈSE].

**Marge :** le M6 (VR) est le jalon le plus risqué ; s'il dérape, F-83 et F-25 sont reportables en phase 2 pour protéger M8.

### 9.1 Chemin critique et dépendances
M0 → M1 → M2 → M3 → (M4 ∥ M5) → M6 → M7 → M8 → M9.
M4 et M5 peuvent être menés en parallèle s'il y a deux flux de travail (deux agents ou agent + développeur).

---

## 10. Definition of Done (applicable à chaque jalon)

- [ ] Toutes les exigences du jalon implémentées et leurs CA vérifiés.
- [ ] Tests automatisés ajoutés et verts en CI (Vitest unitaires + intégration API, Playwright pour les parcours principaux).
- [ ] `pnpm lint`, `pnpm typecheck` sans erreur.
- [ ] Migrations Prisma créées et appliquées sur une base vierge sans erreur ; seed à jour.
- [ ] Chaînes d'interface dans les 3 langues ; vérification visuelle en arabe (RTL).
- [ ] `docs/PROGRESS.md` mis à jour (fait / reste / risques) ; `docs/DECISIONS.md` complété ; OpenAPI à jour si l'API a changé.
- [ ] Données de démonstration : `pnpm db:seed` crée 3 visites liées entre elles, 1 hôtel, 1 kiosque et un utilisateur par rôle (panoramas d'exemple libres de droits dans `apps/api/prisma/seed-assets/`).
- [ ] Démo au porteur effectuée et retours consignés.

---

## 11. Décisions validées et points ouverts

### 11.1 Déjà validé par le porteur (reprises de la v1.0)
- **D-03** — Langues : français (défaut), arabe (RTL), anglais.
- **D-04** — Les partenaires (SMIT, ministères) ne voient que des statistiques agrégées, jamais par hôtel.
- **D-05** — `publicShare` à `false` par défaut : une visite n'est accessible sur le web que si on active le partage.
- **D-26** — Les visites, scènes et hôtels sont créés en brouillon.
- **D-27 (29/09/2026)** — Abandon de Drupal 11 au profit de Node.js / TypeScript (NestJS + PostgreSQL + Prisma + React pour le back-office). Le code Drupal de M0 et M1 est archivé (branche ou dossier `legacy-drupal/`, **non maintenu**) ; M0 et M1 sont refaits sur la nouvelle pile. Les scénarios déjà validés (« Visite manuelle » Porte / Jardin / Remparts, démo Kasbah des Oudayas / Jardin de Salé / Plage de Mehdia) sont repris comme critères d'acceptation et données de seed.

### 11.2 Encore à valider
1. Matériel des kiosques : mini-PC + écran tactile 32" et/ou casque autonome (Meta Quest 3 / Pico 4) ?
2. Hébergement : VPS au Maroc (ex. Maroc Datacenter, N+ONE) ou cloud international ? Stockage S3 : MinIO auto-hébergé ou service géré ? (impact CNDP et coût)
3. Nombre de visites prévues au lancement et liste des sites de la région Rabat-Salé-Kénitra.
4. Nom de domaine (ex. `xplor.ma`) et charte graphique Xplor.
