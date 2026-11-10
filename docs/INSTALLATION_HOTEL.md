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
4. Étape 4 : Enrôlement physique du kiosque *(partie 2/3)*
5. Étape 5 : Contrôle du heartbeat et test hors ligne *(partie 2/3)*
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
