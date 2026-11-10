# Plan de formation — Plateforme Xplor

Ce document constitue le support et le référentiel des parcours de formation de la plateforme **Xplor**. Il s'adresse à un public non technique et formalise les objectifs pédagogiques, les publics concernés, les modules d'apprentissage adossés aux guides de référence, les exercices pratiques sur l'environnement de démonstration, ainsi que les grilles d'évaluation des compétences.

---

## 1. Objectifs de la formation

Le plan de formation a pour finalité d'assurer une prise en main autonome, efficace et sereine de la plateforme Xplor par l'ensemble des acteurs intervenant sur le système.

Les objectifs prioritaires sont les suivants :
- Accompagner la montée en compétences opérationnelle de chaque catégorie d'utilisateurs en fonction de son rôle et de son niveau d'habilitation.
- Permettre à l'équipe en charge des contenus de concevoir, enrichir et publier des visites virtuelles immersives à 360° en totale autonomie, sans assistance technique.
- Rendre les gestionnaires d'établissements hôteliers autonomes dans la composition du catalogue de visites proposé sur leurs bornes kiosques, le suivi de l'état des appareils et la consultation de leur fréquentation.
- Préparer l'exploitant technique à la surveillance de l'infrastructure, aux opérations de maintenance, aux procédures de sauvegarde et de test de reprise, ainsi qu'à la gestion des alertes de fonctionnement.
- Réaliser l'ensemble des exercices pratiques sur un environnement de démonstration dédié, garantissant un apprentissage réaliste sans impact sur les données de production.

---

## 2. Publics concernés

La formation s'articule autour de trois publics cibles :

1. **Équipe contenus** : créateurs de contenus, photographes, médiateurs culturels et éditeurs chargés de concevoir, organiser et publier les visites virtuelles 360° (utilisateurs disposant du rôle « Éditeur » ou « Administrateur »).
2. **Gestionnaires d'hôtel** : directeurs d'établissement, responsables d'hébergement ou référents internes responsables du pilotage local des bornes kiosques et de la programmation des visites proposées aux voyageurs (utilisateurs disposant du rôle « Gestionnaire d'hôtel »).
3. **Exploitant technique** : administrateurs système, techniciens d'exploitation et équipe de support informatique veillant à la disponibilité du service, à la sécurité et à l'intégrité de l'infrastructure logicielle et matérielle (utilisateurs disposant du rôle « Administrateur » ou profil technique d'exploitation).

---

## 3. Module 1 — Équipe contenus : création et publication de visites virtuelles 360°

### 3.1 Présentation et objectifs pédagogiques
Ce module forme l'équipe de création de contenus à l'utilisation quotidienne du back-office Xplor. À l'issue de ce module, les participants sont capables d'importer des médias panoramiques conformes, de structurer une visite complète avec ses scènes, de positionner les points d'intérêt interactifs et de procéder à la publication après validation du graphe de navigation.

### 3.2 Références documentaires
Ce module s'appuie sur la documentation détaillée dans [docs/GUIDE_EDITEUR.md](GUIDE_EDITEUR.md). Les participants doivent se référer aux sections suivantes du guide :
- [Connexion](GUIDE_EDITEUR.md#connexion)
- [Médiathèque et import de panoramas](GUIDE_EDITEUR.md#mediatheque-et-import-de-panoramas)
- [Créer une visite](GUIDE_EDITEUR.md#creer-une-visite)
- [Ajouter des scènes](GUIDE_EDITEUR.md#ajouter-des-scenes)
- [Éditeur visuel 360°](GUIDE_EDITEUR.md#editeur-visuel-360)
- [Contenus fr/ar/en](GUIDE_EDITEUR.md#contenus-fr-ar-en)
- [Publication, QR code et lien /v/](GUIDE_EDITEUR.md#publication-qr-code-et-lien-v)

### 3.3 Exercices pratiques sur l'environnement de démonstration

#### Exercice 1 : Connexion au back-office et import de panoramas dans la médiathèque
1. Ouvrir le navigateur sur l'adresse du back-office de démonstration.
2. Sur la page « Connexion », renseigner les champs « Adresse e-mail » et « Mot de passe », puis cliquer sur « Se connecter ».
3. Dans la barre latérale « Navigation principale », cliquer sur « Médias » pour ouvrir la « Médiathèque ».
4. Utiliser le bouton « Sélectionner des fichiers » pour choisir un panorama équirectangulaire conforme (format JPEG, ratio 2:1, largeur minimale de 4 096 pixels).
5. Cliquer sur « Envoyer », observer le suivi « En cours » puis « Envoyé », et constater le passage du média au statut « Prêt » dans la liste.

#### Exercice 2 : Création d'une visite virtuelle et configuration des scènes
1. Dans la « Navigation principale », cliquer sur « Visites », puis sur le bouton « Nouvelle visite ».
2. Renseigner les champs du formulaire : « Titre », « Description », choisir une « Ville », attribuer des « Catégories », et sélectionner une « Vignette » dans la médiathèque.
3. Cliquer sur « Enregistrer » : la visite est créée avec le statut « Brouillon ».
4. Dans la section « Scènes », cliquer sur « Ajouter une scène », renseigner son « Titre » et lui associer le « Panorama » téléversé à l'exercice précédent.
5. Utiliser l'action « Définir comme départ » sur la scène principale pour désigner le point d'entrée de la visite.

#### Exercice 3 : Édition interactive 360° et points d'intérêt
1. Depuis la fiche de la scène, basculer sur l'onglet « Éditeur 360 ».
2. Cliquer sur l'image panoramique pour ouvrir le volet « Nouveau hotspot ».
3. Configurer un point d'intérêt de type « Lien vers une scène » en choisissant la scène cible.
4. Orienter le panorama vers la direction d'observation voulue et cliquer sur « Définir la vue actuelle comme vue initiale ».
5. Définir la perspective de transition en cliquant sur « Définir l'orientation d'arrivée ».
6. Déplacer un point d'intérêt avec l'action « Déplacer ici », puis tester le bouton « Annuler » pour vérifier la fonction d'annulation.

#### Exercice 4 : Contrôle de cohérence, publication et partage
1. Sur la fiche de la visite, consulter la « Carte des liens » pour vérifier l'accessibilité des scènes depuis la scène de départ.
2. Cliquer sur le bouton « Vérifier » pour exécuter le contrôle d'intégrité et constater l'affichage du message « Aucun problème : la visite peut être publiée ».
3. Cliquer sur « Publier » pour faire passer la visite du statut « Brouillon » au statut « Publiée ».
4. Cliquer sur « Tester la visite » pour parcourir la visite dans la visionneuse interactive.
5. Vérifier la génération du « Lien public » et cliquer sur « Télécharger le QR code » pour récupérer le « QR code de la visite ».

### 3.4 Acquis à vérifier
- [ ] Savoir s'authentifier sur le back-office et naviguer dans les rubriques du catalogue.
- [ ] Savoir téléverser un panorama équirectangulaire dans la médiathèque et vérifier son statut de traitement.
- [ ] Savoir créer une visite virtuelle avec ses métadonnées obligatoires en français.
- [ ] Savoir ajouter des scènes, leur associer un média panoramique et désigner la scène de départ.
- [ ] Savoir positionner et configurer des points d'intérêt (hotspots) dans l'éditeur interactif 360°.
- [ ] Savoir définir la vue initiale d'une scène et l'orientation d'arrivée d'une transition.
- [ ] Savoir utiliser les fonctions de vérification d'intégrité avant publication.
- [ ] Savoir publier une visite virtuelle, prévisualiser son rendu et télécharger son QR code.

---

## 4. Module 2 — Gestionnaires d'hôtel : pilotage de l'espace établissement et des kiosques

### 4.1 Présentation et objectifs pédagogiques
Ce module s'adresse aux gestionnaires d'établissements hôteliers. Il permet d'acquérir les compétences nécessaires pour composer le bouquet de visites interactives proposées sur les bornes kiosques de l'hôtel, suivre l'état de fonctionnement des équipements déployés et analyser la fréquentation touristique à partir des indicateurs statistiques.

### 4.2 Références documentaires
Ce module s'appuie sur la documentation détaillée dans [docs/GUIDE_GESTIONNAIRE_HOTEL.md](GUIDE_GESTIONNAIRE_HOTEL.md). Les participants doivent se référer aux sections suivantes du guide :
- [1. Connexion](GUIDE_GESTIONNAIRE_HOTEL.md#1-connexion)
- [2. Périmètre (vos hôtels)](GUIDE_GESTIONNAIRE_HOTEL.md#2-périmètre-vos-hôtels)
- [3. Visites proposées sur le kiosque](GUIDE_GESTIONNAIRE_HOTEL.md#3-visites-proposées-sur-le-kiosque)
- [4. Kiosques (enrôlement, état et heartbeat, mode veille, hors ligne)](GUIDE_GESTIONNAIRE_HOTEL.md#4-kiosques-enrôlement-état-et-heartbeat-mode-veille-hors-ligne)
- [5. Statistiques et export CSV](GUIDE_GESTIONNAIRE_HOTEL.md#5-statistiques-et-export-csv)
- [6. Kiosque hors ligne : que faire et qui contacter](GUIDE_GESTIONNAIRE_HOTEL.md#6-kiosque-hors-ligne--que-faire-et-qui-contacter)

### 4.3 Exercices pratiques sur l'environnement de démonstration

#### Exercice 1 : Connexion au compte gestionnaire et vérification du périmètre
1. Accéder au back-office de démonstration et se connecter avec un compte doté du rôle gestionnaire d'hôtel.
2. Dans la « Navigation principale », cliquer sur « Hôtels ».
3. Vérifier que la liste restreinte ne présente que le ou les établissements assignés, avec les colonnes « Nom » et « Ville », attestant du respect du cloisonnement de sécurité.

#### Exercice 2 : Composition de la sélection des visites pour le kiosque
1. Dans la liste des établissements, cliquer sur le lien « Sélection » de l'hôtel assigné.
2. Dans la section « Catalogue des visites », identifier une visite disponible et cliquer sur le bouton « Ajouter ».
3. Dans la liste « Visites sélectionnées », utiliser les actions « Monter » et « Descendre » pour modifier l'ordre d'affichage des visites.
4. Utiliser l'action « Retirer » pour enlever une visite de la sélection.
5. Cliquer sur le bouton « Enregistrer » et constater la confirmation « Sélection enregistrée. » ainsi que la mise à jour du numéro de version de la sélection.

#### Exercice 3 : Consultation et interprétation de l'état des kiosques
1. Dans la « Navigation principale », cliquer sur « Kiosques ».
2. Examiner le tableau récapitulatif des bornes de l'établissement avec ses colonnes : « Nom », « Hôtel », « État », « Dernier signal », « Version » et « Espace libre ».
3. Identifier la signification des différents badges d'état (« En ligne », « Hors ligne », « Désynchronisé », « En attente », « Désactivé »).
4. Noter la valeur de l'indicateur « Dernier signal » pour vérifier la réception régulière de la télémétrie de l'appareil.

#### Exercice 4 : Analyse des statistiques de consultation et export CSV
1. Dans la « Navigation principale », cliquer sur « Statistiques ».
2. Filtrer les données en sélectionnant une « Visite », un « Canal » ou une « Langue », puis cliquer sur « Appliquer les filtres ».
3. Analyser les métriques consolidées : « Sessions », « Visites ouvertes », « Scènes vues », « Clics sur les points », « Entrées VR », « Scans QR ».
4. Consulter les graphiques de distribution : « Sessions par jour », « Visites les plus ouvertes », « Scènes les plus vues ».
5. Cliquer sur « Exporter en CSV » pour télécharger le fichier d'analyse tabulaire.

### 4.4 Acquis à vérifier
- [ ] Savoir se connecter au back-office avec son compte gestionnaire et vérifier son périmètre d'établissements.
- [ ] Savoir accéder à la sélection des visites de son hôtel.
- [ ] Savoir rechercher des visites publiées dans le catalogue et les ajouter à la sélection du kiosque.
- [ ] Savoir réordonner les visites sélectionnées et enregistrer les modifications.
- [ ] Savoir consulter la liste des kiosques de son hôtel et interpréter les statuts de connexion.
- [ ] Savoir filtrer les indicateurs d'audience de son établissement et exporter les données en CSV.
- [ ] Connaître les vérifications physiques élémentaires à réaliser en cas de signalement d'un kiosque hors ligne.

---

## 5. Module 3 — Exploitant technique : supervision, maintenance et exploitation

### 5.1 Présentation et objectifs pédagogiques
Ce module prépare l'exploitant technique et les administrateurs système à la gestion opérationnelle de la plateforme Xplor en production. Il aborde la vérification des sondes de santé, la surveillance et l'enrôlement du parc de bornes kiosques, la gestion des sauvegardes et des tests de reprise, la consultation des journaux conteneurisés et le respect des règles de protection des données (loi 09-08).

### 5.2 Références documentaires
Ce module s'appuie sur la documentation détaillée dans [docs/EXPLOITATION.md](EXPLOITATION.md). Les participants doivent se référer aux sections suivantes du guide :
- [1. Architecture de production](EXPLOITATION.md#1-architecture-de-production)
- [2. Supervision de la plateforme](EXPLOITATION.md#2-supervision-de-la-plateforme)
- [3. Supervision des kiosques depuis le back-office](EXPLOITATION.md#3-supervision-des-kiosques-depuis-le-back-office)
- [4. Sauvegardes quotidiennes (Backup)](EXPLOITATION.md#4-sauvegardes-quotidiennes-backup)
- [4.4 Test de restauration](EXPLOITATION.md#44-test-de-restauration)
- [5. Journaux et rotation](EXPLOITATION.md#5-journaux-et-rotation)
- [6. Mises à jour et retour arrière (Rollback)](EXPLOITATION.md#6-mises-à-jour-et-retour-arrière-rollback)
- [7. Tâches périodiques et administration CLI](EXPLOITATION.md#7-tâches-périodiques-et-administration-cli)
- [8. Contacts et matrice d'escalade](EXPLOITATION.md#8-contacts-et-matrice-descalade)

### 5.3 Exercices pratiques sur l'environnement de démonstration

#### Exercice 1 : Contrôle de disponibilité et diagnostic des sondes d'intégrité
1. Exécuter une requête HTTP sur le point de contrôle `/api/health` de l'environnement de test.
2. Vérifier la réception du code HTTP 200 et valider l'état nominal des trois sondes intégrées détaillées dans la réponse JSON : connectivité à la base de données PostgreSQL (`db`), disponibilité de la mémoire cache Redis (`redis`) et accessibilité du stockage d'objets MinIO (`storage`).
3. Interpréter la conduite à tenir en cas de code HTTP 503 ou de latence excédant le seuil de tolérance du service.

#### Exercice 2 : Supervision avancée des kiosques et actions d'administration
1. Accéder à l'écran « Kiosques » du back-office avec un compte administrateur.
2. Utiliser l'action « Code d’enrôlement » pour générer un code temporaire sécurisé à 8 caractères destiné à associer un nouvel appareil.
3. Déclencher l'action « Forcer la synchronisation » sur une borne de test pour commander le téléchargement immédiat du manifeste à jour.
4. Appliquer l'action « Désactiver » pour révoquer l'accès d'un appareil de démonstration et vérifier l'affichage immédiat de l'état « Désactivé ».

#### Exercice 3 : Consultation des journaux conteneurisés et conformité loi 09-08
1. Afficher les journaux d'exécution en continu des services applicatifs conteneurisés (`api` et `worker`).
2. Examiner la structure JSON standardisée des lignes de journaux et repérer les champs d'information opérationnels.
3. Vérifier le respect strict des prescriptions de protection de la vie privée (loi 09-08) : constater l'absence totale de conservation d'adresses IP nominatives dans les enregistrements de requêtes et les événements statistiques.
4. Examiner la configuration de rotation des fichiers de journaux Docker par taille pour prévenir toute saturation de l'espace disque.

#### Exercice 4 : Répétition d'un test de restauration sur environnement bac à sable
1. Vérifier la présence d'une archive de sauvegarde comprenant le dump de base de données et l'archive des fichiers médias.
2. Exécuter le script de restauration avec le paramètre de confirmation non interactive sur l'environnement bac à sable isolé.
3. Procéder aux quatre vérifications obligatoires post-restauration :
   - Contrôle du retour nominal de la sonde `/api/health`.
   - Connexion réussie à l'interface d'administration.
   - Contrôle du nombre de visites publiées en base.
   - Chargement et navigation fluide dans un panorama 360° depuis la visionneuse.

### 5.4 Acquis à vérifier
- [ ] Connaître l'architecture globale des conteneurs et services de la plateforme.
- [ ] Savoir interroger et interpréter les résultats de la sonde de disponibilité `/api/health`.
- [ ] Savoir générer un code d'enrôlement pour associer une nouvelle borne kiosque.
- [ ] Savoir forcer la synchronisation des contenus ou désactiver un kiosque depuis le back-office.
- [ ] Savoir consulter les journaux structurés des conteneurs applicatifs.
- [ ] Connaître les règles d'anonymisation et de conformité à la loi 09-08.
- [ ] Connaître les mécanismes de sauvegarde automatique et de rotation des archives.
- [ ] Savoir dérouler la procédure de test de restauration sur environnement bac à sable et valider les contrôles associés.

---

## 6. Émargement des sessions de formation

Le tableau d'émargement ci-dessous est destiné à attester de la réalisation des sessions de formation dispensées sur l'environnement de démonstration :

| Date | Module | Participant | Formateur |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
