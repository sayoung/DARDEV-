# Check-list de mise en service d'un hôtel — Xplor

Ce document constitue la procédure opérationnelle de mise en service d'un nouvel établissement hôtelier partenaire sur la plateforme **Xplor** (exigence NF-10).

- **Public visé :** Administrateur Xplor, installateur DARDEV et équipe de déploiement.
- **Opérations VPS :** Toutes les commandes et interventions sur le serveur VPS de production sont exécutées **exclusivement par le porteur du projet (DARDEV)**. Aucun accès distant direct (SSH, clés secrètes) n'est accordé aux tiers ni aux agents.
- **Documents de référence :**
  - Architecture serveur, conteneurs Docker et surveillance : se référer à [EXPLOITATION.md](EXPLOITATION.md).
  - Utilisation quotidienne de l'espace hôtelier et consignes de réception : se référer au [Guide du gestionnaire d'hôtel](GUIDE_GESTIONNAIRE_HOTEL.md).
  - En cas de dysfonctionnement ou pour toute assistance technique : contacter **l'administrateur Xplor / le support désigné** (cf. [GUIDE_GESTIONNAIRE_HOTEL.md § 6](GUIDE_GESTIONNAIRE_HOTEL.md#6-kiosque-hors-ligne--que-faire-et-qui-contacter) « Qui contacter »).

---

## Sommaire

1. [Étape 1 : Création de l'hôtel dans le back-office](#1-création-de-lhôtel-dans-le-back-office)
2. [Étape 2 : Invitation du gestionnaire et rattachement](#2-invitation-du-gestionnaire-et-rattachement)
3. [Étape 3 : Sélection des visites proposées sur le kiosque](#3-sélection-des-visites-proposées-sur-le-kiosque)
4. [Étape 4 : Enrôlement du kiosque](#4-enrôlement-du-kiosque)
5. [Étape 5 : Contrôle du heartbeat et du mode hors ligne](#5-contrôle-du-heartbeat-et-du-mode-hors-ligne)
6. [Étape 6 : Test d'un QR code sur mobile](#6-test-dun-qr-code-sur-mobile)
7. [Étape 7 : Remise du guide gestionnaire](#7-remise-du-guide-gestionnaire)
8. [Check-list récapitulative de mise en service](#8-check-list-récapitulative-de-mise-en-service)

---

## 1. Création de l'hôtel dans le back-office

Cette étape administrative préalable enregistre l'établissement dans le système central (rôle « Administrateur » requis).

- [ ] Se connecter au back-office d'administration (`https://admin.xplor.ma`) avec un compte disposant du rôle « Administrateur » (`ADMIN`).
- [ ] Enregistrer l'établissement via l'API d'administration `POST /api/v1/admin/hotels` (ou via le formulaire de gestion) avec les paramètres obligatoires (`HotelCreateSchema`) :
  - **Nom (`name`)** : dénomination commerciale complète de l'hôtel.
  - **Classement (`stars`)** : catégorie d'étoiles (`FOUR`, `FIVE` ou `LUXURY`).
  - **Ville (`cityId`)** : identifiant de la ville de rattachement (catalogue `/cities`).
  - **Coordonnées** : adresse postale (`address`), numéro de téléphone (`phone`) et courriel de contact (`email`).
  - **Identité et sécurité** : couleur de marque (`brandColor`, format hexadécimal `#RRGGBB`) et code PIN de maintenance kiosque à 4 chiffres (`kioskPin`).
- [ ] Accéder à la rubrique « Hôtels » (`/hotels`) dans la navigation principale et vérifier la présence de l'établissement dans le tableau avec son « Nom » et sa « Ville ».

---

## 2. Invitation du gestionnaire et rattachement

Cette étape crée le compte du responsable hôtelier et le rattache exclusivement à son établissement (exigence F-90, API-28).

- [ ] Créer l'invitation utilisateur par un administrateur via `POST /api/v1/admin/users/invitations` avec :
  - L'adresse électronique (`email`) et le nom complet (`name`) du responsable.
  - Le rôle « Gestionnaire d'hôtel » (`HOTEL_MANAGER`).
  - La langue d'interface (`uiLang`, ex. `fr`).
- [ ] Vérifier l'envoi du courriel d'invitation contenant le lien d'activation `/invite/<jeton>` (valable 48 heures).
- [ ] Rallier l'hôtel au compte utilisateur :
  - Depuis le back-office, ouvrir la fiche de l'utilisateur (`/users/:id`).
  - Dans le bloc « Hôtels rattachés », cocher l'établissement concerné.
  - Cliquer sur le bouton « Enregistrer les hôtels » (`PUT /api/v1/admin/users/:id/hotels` ou `PUT /api/v1/admin/hotels/:id/managers`).
- [ ] Vérifier que le gestionnaire a défini son mot de passe (au moins 12 caractères) et que la politique d'accès (`AccessPolicy`) restreint strictement sa visibilité aux seules ressources de son hôtel.

---

## 3. Sélection des visites proposées sur le kiosque

Cette étape définit le bouquet de visites immersives qui seront synchronisées et présentées sur les bornes de l'hôtel (exigence F-51).

- [ ] Dans le menu « Hôtels » (`/hotels`), repérer la ligne de l'établissement et cliquer sur le lien « Sélection » (route `/hotels/:id/selection`).
- [ ] Dans la section « Catalogue des visites », rechercher les visites publiées par mot-clé (« Rechercher une visite ») ou filtrer par « Ville » et « Catégorie ».
- [ ] Cliquer sur « Ajouter » sur chaque visite retenue pour l'établissement.
- [ ] Dans la section « Visites sélectionnées » :
  - Ordonner l'affichage sur le kiosque à l'aide des boutons « Monter » et « Descendre ».
  - Définir la visite vedette mise en avant sur l'écran d'accueil (« À la une ») en cochant l'option « Mise en avant » (une seule visite).
  - Activer la boucle de veille d'inactivité en cochant l'option « Mode veille » sur les visites souhaitées.
  - Si nécessaire, retirer une visite du bouquet avec le bouton « Retirer ».
- [ ] Cliquer sur le bouton « Enregistrer » pour valider la composition (`PUT /api/v1/admin/hotels/:id/selection`).
- [ ] Vérifier l'affichage du message de confirmation « Sélection enregistrée. » et l'incrémentation du numéro « Version {{version}} ».

---

## 4. Enrôlement du kiosque

Cette étape permet d'associer physiquement l'appareil borne à son établissement hôtelier par la génération et la saisie d'un code sécurisé (exigences F-52, API-01, API-05).

### 4.1 Déclaration de la borne et génération du code (Back-office)

- [ ] Se connecter au back-office (`https://admin.xplor.ma`) avec un compte disposant du rôle « Administrateur » (`ADMIN`).
- [ ] Naviguer vers la rubrique « Kiosques » (`/kiosks`).
- [ ] Cliquer sur le bouton « Nouveau kiosque » (`POST /api/v1/admin/kiosks`) pour ouvrir le formulaire de provisionnement :
  - **« Nom du kiosque » (`label`)** : identifiant lisible de l'appareil (ex. `Kiosque Hall Réception`).
  - **« Hôtel » (`hotelId`)** : sélectionner l'établissement dans la liste déroulante (« Sélectionner un hôtel »).
  - **« Type d'appareil » (`deviceType`)** : choisir la typologie matérielle (« Écran tactile », « Casque VR » ou « Écran tactile et casque VR »).
  - **« Délai avant le mode veille (secondes) » (`idleTimeoutSeconds`)** : configurer la durée d'inactivité avant le déclenchement de la boucle de veille (entre 15 et 600 secondes).
  - Cliquer sur « Créer le kiosque ». L'appareil est initialement créé au statut « En attente » (`PENDING`).
- [ ] Obtenir le code d'enrôlement :
  - La boîte de dialogue « Code d'enrôlement » s'ouvre automatiquement (ou peut être rouverte via le bouton « Code d’enrôlement » sur une borne au statut « En attente »).
  - L'écran affiche l'instruction : « Saisissez ce code sur l'appareil. ».
  - Relever le code d'enrôlement composé de **8 caractères** alphanumériques majuscules sans symboles ambigus (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`).
  - **Durée de validité :** le code est valide pendant **60 minutes** (`ENROLLMENT_CODE_TTL_MINUTES = 60`, vérifié dans `apps/api/src/kiosks/kiosk-secrets.ts`). En cas de dépassement, générer un nouveau code via l'action « Code d’enrôlement » (`POST /api/v1/admin/kiosks/:id/enrollment-code`).

### 4.2 Saisie du code sur l'appareil (Application Kiosque)

- [ ] Allumer l'appareil et lancer l'application kiosque.
- [ ] Vérifier que l'écran « Enrôlement du kiosque » s'affiche en l'absence d'association préalable.
- [ ] Constater la consigne : « Saisissez le code d'enrôlement à 8 caractères pour associer cet appareil. ».
- [ ] Saisir le code d'enrôlement à 8 caractères dans le champ « Code d'enrôlement » (espace réservé « XXXXXXXX », identifiant `kiosk-enroll-code`).
- [ ] Cliquer sur le bouton « Enrôler le kiosque » (le libellé bascule temporairement à « Enrôlement en cours... »).
- [ ] Vérifier le traitement de la requête (`POST /api/v1/kiosk/enroll`) :
  - En cas de saisie erronée ou de format non conforme, l'alerte « Le code d'enrôlement doit comporter 8 caractères majuscules ou chiffres. » s'affiche.
  - En cas de succès, le serveur passe le statut de la borne à `ACTIVE`, révoque le code à usage unique et délivre un jeton d'authentification Bearer chiffré de 256 bits (`kioskBearer`).
- [ ] Vérifier que l'appareil enregistre son jeton localement, télécharge le manifeste des visites de l'hôtel (`GET /api/v1/kiosk/manifest`) et bascule vers l'écran d'accueil (« Nos visites virtuelles »).

---

## 5. Contrôle du heartbeat et du mode hors ligne

Cette étape valide la boucle de télémétrie, la surveillance opérationnelle dans le back-office et la continuité de service en cas de coupure réseau (exigences F-53, F-54, F-60, F-65).

### 5.1 Vérification de la boucle de heartbeat et supervision back-office

- [ ] Vérifier le fonctionnement nominal de la télémétrie kiosque :
  - La borne enrôlée expédie automatiquement un signal de vie (heartbeat) **toutes les 5 minutes** via `POST /api/v1/kiosk/heartbeat`.
  - La charge utile transmise comprend la version d'application (`appVersion`), la version synchronisée du manifeste (`syncedManifestVersion`), l'espace disque disponible en Mo (`storageFreeMb`) et la liste des erreurs récentes (`recentErrors`, limitée aux 10 derniers messages de 300 caractères maximum).
  - La réponse du serveur confirme l'horodatage serveur (`serverTime`) et l'indicateur de resynchronisation (`forceSync`).
- [ ] Contrôler l'état de la borne dans le tableau de bord des kiosques :
  - Accéder à la page de supervision du back-office : [https://admin.xplor.ma/kiosks](https://admin.xplor.ma/kiosks) (se référer à [EXPLOITATION.md § 3.1](EXPLOITATION.md#31-tableau-de-bord-des-kiosques)).
  - Repérer la ligne correspondant à la borne :
    - Vérifier que la colonne « État » affiche **« En ligne »** (`ONLINE`).
    - Vérifier que la colonne « Dernier signal » (`lastHeartbeatAt`) reflète une heure d'émission récente (inférieure à 5 minutes).
    - Contrôler que la colonne « Version » affiche la version d'application active.
    - Contrôler que la colonne « Espace libre » affiche l'espace disponible exprimé en Mo (ex. `X Mo`).
- [ ] Connaître les règles d'état calculé de la borne (`computeConnectionState`) :
  - **« En ligne » (`ONLINE`)** : signal reçu il y a moins de 15 minutes (`OFFLINE_AFTER_MINUTES = 15`) et contenu aligné sur le manifeste attendu.
  - **« Désynchronisé » (`DESYNCHRONIZED`)** : borne connectée mais version de contenu locale en retard par rapport à la sélection hôtelière. Utiliser le bouton « Forcer la synchronisation » (`POST /api/v1/admin/kiosks/:id/force-sync`) pour demander un rechargement au prochain heartbeat (cf. [EXPLOITATION.md § 3.2](EXPLOITATION.md#32-actions-de-supervision)).
  - **« Hors ligne » (`OFFLINE`)** : absence de heartbeat depuis plus de 15 minutes (`OFFLINE_AFTER_MINUTES = 15`).

### 5.2 Test du mode hors ligne

- [ ] Simuler une perte de connectivité réseau sur la borne (déconnexion de la liaison réseau locale).
- [ ] Vérifier la continuité de l'expérience visiteur :
  - L'application kiosque s'appuie sur le Service Worker et le stockage local (Cache Storage / IndexedDB).
  - Les visites virtuelles 360°, scènes et points d'intérêt préalablement synchronisés restent consultables et interactifs sans latence ni coupure.
  - L'écran d'accueil (« Nos visites virtuelles ») et la navigation immersive s'exécutent normalement sans affichage d'erreur bloquante.
  - Les échecs de requêtes réseau occasionnés sont enregistrés dans le journal local (`recentErrors`) sans impacter le visiteur.
- [ ] Rétablir la connexion réseau :
  - Vérifier qu'au retour du réseau, le cycle de heartbeat (toutes les 5 minutes) s'exécute à nouveau avec succès.
  - Vérifier dans le tableau de bord back-office (`/kiosks`) que l'horodatage « Dernier signal » s'actualise avec la nouvelle heure et que l'état repasse à « En ligne » (`ONLINE`).

### 5.3 Procédure et seuils de l'alerte automatique d'absence de heartbeat (F-54)

- [ ] Se référer aux consignes de surveillance détaillées dans [EXPLOITATION.md § 3.3](EXPLOITATION.md#33-alertes-automatiques-dabsence-de-heartbeat-f-54).
- [ ] Noter les paramètres opérationnels du travailleur d'arrière-plan BullMQ (`apps/worker/src/kiosk-offline-alert.ts`, file `kiosk-offline-check`) :
  - **Fréquence de contrôle :** la tâche d'arrière-plan s'exécute **toutes les 15 minutes** (`KIOSK_OFFLINE_INTERVAL_MS = 15 * 60 * 1000`).
  - **Seuil de déclenchement de l'alerte :** un courriel d'alerte n'est déclenché que si le dernier heartbeat date de **plus de 2 heures** (`ALERT_OFFLINE_AFTER_MS = 2 * 60 * 60 * 1000 = 7 200 000 ms`). *Attention : le délai de 15 minutes correspond à la fréquence de vérification de la tâche et au passage visuel en « Hors ligne » dans le tableau de bord, et non au seuil d'alerte par courriel.*
  - **Conditions d'émission :**
    1. La borne est au statut actif (`status === 'ACTIVE'`).
    2. L'absence de heartbeat dépasse strictement 2 heures.
    3. L'heure locale se situe en période diurne entre **08:00 et 22:00** dans le fuseau horaire marocain `Africa/Casablanca`.
    4. Aucune alerte n'a été transmise pour cette borne au cours des dernières 24 heures (délai anti-répétition `ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000`).
  - **Destinataires :** un courriel automatique est expédié aux comptes administrateurs (`ADMIN`) dès que ces conditions sont vérifiées.

---

## 6. Test d'un QR code sur mobile

Cette étape valide le fonctionnement de la passerelle kiosque / mobile par QR code (exigences F-33, F-41, F-62, F-63, NF-10), permettant à un visiteur de poursuivre l'exploration d'une visite virtuelle sur son propre smartphone.

### 6.1 URL publique de visionnage (vérifiée dans `docs/DEPLOY.md`)

- Le domaine public dédié à la visionneuse web grand public est **`v.xplor.ma`** (certificat TLS 1.3 géré par Caddy).
- L'URL publique de consultation d'une visite prend la forme pérenne :
  `https://v.xplor.ma/v/<jeton>`
- Lorsque le lien est généré pour le kiosque ou scanné depuis une borne interactive, le paramètre de provenance anonyme `?src=kiosk` est joint à l'URL :
  `https://v.xplor.ma/v/<jeton>?src=kiosk`

### 6.2 Protocole de test sur smartphone

- [ ] **Affichage du QR code :**
  - Ouvrir une visite publiée sur l'écran tactile du kiosque.
  - Afficher le QR code de partage de la visite (ou utiliser le support d'information / présentoir imprimé doté du QR code vectoriel SVG téléchargé depuis le volet de publication du back-office via `xplor-<jeton>.svg`).
- [ ] **Scan du QR code sur mobile (procédure générique) :**
  - À l'aide de l'appareil photo ou d'un lecteur de QR code standard d'un smartphone (procédure générique, sans contrainte de système d'exploitation mobile, de version ni de distance particulière), viser le QR code affiché à l'écran ou sur le support.
  - Constater la détection instantanée du QR code et l'affichage de la notification invitant à ouvrir l'adresse web.
- [ ] **Chargement et expérience immersive sur mobile :**
  - Ouvrir le lien dans le navigateur du smartphone.
  - Vérifier que la page résout correctement l'adresse sécurisée `https://v.xplor.ma/v/<jeton>` (ou `https://v.xplor.ma/v/<jeton>?src=kiosk`).
  - Constater le chargement immédiat du panorama 360° dans la visionneuse Photo Sphere Viewer v5.
  - Tester les interactions tactiles mobiles :
    - Rotation fluide à 360° par glissement du doigt sur l'écran.
    - Zoom avant et zoom arrière par pincement tactile.
    - Clic sur un point d'intérêt (hotspot) pour changer de scène ou consulter un contenu enrichi.
  - Basculer le smartphone entre les orientations portrait et paysage pour vérifier l'adaptation responsive de l'interface.
- [ ] **Garanties de confidentialité (Loi 09-08 CNDP) :**
  - Constater qu'aucune autorisation intrusive (géolocalisation, accès aux contacts ou stockage du smartphone) n'est exigée du voyageur.
  - Vérifier que la consultation s'opère de façon totalement anonyme, sans aucun traçage nominatif ni dépôt de traceurs tiers.
- [ ] **Prise en compte dans le suivi statistique :**
  - Se connecter au back-office (`https://admin.xplor.ma/stats`).
  - Vérifier que l'ouverture web via QR code est correctement comptabilisée dans les indicateurs d'activité hôtelière (indicateur « Scans QR » et sessions web associées).

---

## 7. Remise du guide gestionnaire

Cette étape formalise la passation opérationnelle auprès de la direction et de l'équipe de réception de l'établissement hôtelier.

### 7.1 Remise documentaire et découverte de l'espace hôtelier

- [ ] Remettre au responsable de l'hôtel le [Guide du gestionnaire d'hôtel](GUIDE_GESTIONNAIRE_HOTEL.md) (sans recopier son contenu dans la présente procédure technique).
- [ ] Accompagner le gestionnaire dans la découverte des chapitres essentiels du guide :
  - **Connexion sécurisée** ([GUIDE_GESTIONNAIRE_HOTEL.md § 1](GUIDE_GESTIONNAIRE_HOTEL.md#1-connexion)) : accès au back-office sur `https://admin.xplor.ma`, gestion des identifiants et mot de passe robuste d'au moins 12 caractères.
  - **Périmètre et politique d'accès** ([GUIDE_GESTIONNAIRE_HOTEL.md § 2](GUIDE_GESTIONNAIRE_HOTEL.md#2-périmètre-vos-hôtels)) : vérification de l'étanchéité stricte des données et restriction exclusive aux hôtels rattachés.
  - **Gestion de la sélection hôtelière** ([GUIDE_GESTIONNAIRE_HOTEL.md § 3](GUIDE_GESTIONNAIRE_HOTEL.md#3-visites-proposées-sur-le-kiosque)) : méthode d'ajout, de retrait, d'ordonnancement des visites, choix de la visite « À la une » et activation du « Mode veille ».
  - **Suivi opérationnel des kiosques** ([GUIDE_GESTIONNAIRE_HOTEL.md § 4](GUIDE_GESTIONNAIRE_HOTEL.md#4-kiosques-enrôlement-état-et-heartbeat-mode-veille-hors-ligne)) : compréhension des états de connectivité (« En ligne », « Désynchronisé », « Hors ligne ») et rappel de l'autonomie hors ligne.
  - **Consultation des statistiques** ([GUIDE_GESTIONNAIRE_HOTEL.md § 5](GUIDE_GESTIONNAIRE_HOTEL.md#5-statistiques-et-export-csv)) : suivi des indicateurs de consultation et téléchargement de l'export CSV UTF-8.

### 7.2 Consignes de premier niveau et assistance technique (§ 6 « Qui contacter »)

- [ ] Sensibiliser le personnel de réception aux vérifications simples de premier niveau :
  - **Alimentation électrique** : contrôler le branchement de la prise secteur et l'allumage de la borne.
  - **Réseau** : vérifier le branchement du câble Ethernet RJ45 ou la bonne réception du réseau Wi-Fi local de l'hôtel.
  - **Redémarrage simple** : en cas de blocage, débrancher l'appareil, patienter 15 à 30 secondes, puis rebrancher.
  - **Code PIN de maintenance** : rappeler au gestionnaire que le code PIN à 4 chiffres configuré lors de l'étape 1 permet de déverrouiller l'écran technique de maintenance directement sur le kiosque.
- [ ] En cas de dysfonctionnement persistant ou d'anomalie réseau non résolue, orienter le gestionnaire vers les consignes d'assistance du guide :
  - Se référer directement à [GUIDE_GESTIONNAIRE_HOTEL.md § 6](GUIDE_GESTIONNAIRE_HOTEL.md#6-kiosque-hors-ligne--que-faire-et-qui-contacter) (sous-section [Qui contacter si le dysfonctionnement persiste](GUIDE_GESTIONNAIRE_HOTEL.md#qui-contacter-si-le-dysfonctionnement-persiste)).
  - Noter les informations requises avant tout contact avec l'administrateur technique :
    1. Le nom du kiosque (`label`) et le nom de l'hôtel.
    2. La date et l'heure du « Dernier signal » affichées dans le tableau de bord back-office.
    3. La version de l'application et l'espace disque disponible.
    4. La description précise du problème constaté (écran noir, message d'erreur ou symptôme physique).

### 7.3 Rappel de sécurité : gouvernance du serveur VPS

- [ ] Rappeler expressément que **toutes les opérations sur le serveur VPS de production sont exécutées exclusivement par le porteur du projet (DARDEV)**.
  - Aucun accès distant (SSH, identifiants systèmes, console d'administration hôte) n'est accordé aux gestionnaires d'hôtel, aux équipes sur site ni aux intervenants externes.
  - La gestion de l'infrastructure Docker, de la base de données PostgreSQL, du stockage MinIO, du cache Redis, du serveur web Caddy et des certificats SSL relève de la responsabilité exclusive du porteur de projet (se référer à [EXPLOITATION.md § 1](EXPLOITATION.md#1-architecture-de-production) et [EXPLOITATION.md § 8](EXPLOITATION.md#8-contacts-et-matrice-descalade)).

---

## 8. Check-list récapitulative de mise en service

Ce récapitulatif synthétise l'ensemble des contrôles d'installation à valider pour acter la mise en service complète de l'établissement hôtelier :

| Étape | Intitulé du contrôle | Statut attendu | Réf. |
|---|---|---|---|
| **Étape 1** | Création de l'établissement dans le back-office | Fiche hôtel créée (nom, étoiles, ville, coordonnées, couleur hexadécimale, code PIN maintenance à 4 chiffres) | [Étape 1](#1-création-de-lhôtel-dans-le-back-office) |
| **Étape 2** | Invitation et rattachement du gestionnaire | Compte utilisateur invité, mot de passe fort configuré (≥ 12 caractères), rattachement exclusif validé par `AccessPolicy` | [Étape 2](#2-invitation-du-gestionnaire-et-rattachement) |
| **Étape 3** | Sélection du bouquet de visites hôtelier | Visites ajoutées au catalogue local, ordre d'affichage ajusté, visite à la une et mode veille configurés, version incrémentée | [Étape 3](#3-sélection-des-visites-proposées-sur-le-kiosque) |
| **Étape 4** | Enrôlement physique du kiosque | Appareil déclaré, code d'enrôlement à 8 caractères saisi sur la borne sous 60 minutes, jeton Bearer enregistré, statut `ACTIVE` et téléchargement du manifeste | [Étape 4](#4-enrôlement-du-kiosque) |
| **Étape 5** | Contrôle télémétrie et autonomie hors ligne | Heartbeat fonctionnel (< 5 min, état « En ligne »), coupure réseau testée avec navigation 360° autonome sans interruption, reconnexion validée | [Étape 5](#5-contrôle-du-heartbeat-et-du-mode-hors-ligne) |
| **Étape 6** | Test de la passerelle QR code sur mobile | QR code scanné depuis un smartphone standard (sans contrainte d'OS ni distance), URL publique `https://v.xplor.ma/v/<jeton>` ouverte, visionneuse fluide et respect CNDP 09-08 | [Étape 6](#6-test-dun-qr-code-sur-mobile) |
| **Étape 7** | Remise documentaire et passation | [Guide du gestionnaire d'hôtel](GUIDE_GESTIONNAIRE_HOTEL.md) remis, consignes de premier niveau expliquées, renvoi au § 6 « Qui contacter », rappel des opérations VPS réservées au porteur (DARDEV) | [Étape 7](#7-remise-du-guide-gestionnaire) |
