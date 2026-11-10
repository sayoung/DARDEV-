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
6. Étape 6 : Test de la passerelle QR code mobile *(partie 3/3)*
7. Étape 7 : Remise documentaire et signature du procès-verbal *(partie 3/3)*

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
