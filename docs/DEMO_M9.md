# Démo M9 — Livraison

Ce document décrit la procédure détaillée pour exécuter et valider la démo du **Jalon M9 — Livraison** (exigence NF-10).

---

## Objectif

Valider le déploiement et l'accessibilité en production de la plateforme Xplor (exigence NF-10) :
- Vérifier la disponibilité et l'état opérationnel de l'API publique via sa sonde de santé.
- Valider l'accès et l'authentification sur le back-office d'administration en production.

---

## Prérequis

1. **Accès Internet** : Disposer d'une connexion Internet active permettant de joindre les services en production hébergés sur le domaine `xplor.ma`.
2. **Compte administrateur de production** : Disposer des identifiants (adresse e-mail et mot de passe, ainsi que l'application d'authentification TOTP si le 2FA est configuré) d'un compte administrateur de production.

---

## Étape 1 : Vérification de la sonde de santé de l'API

### Action
Ouvrir dans un navigateur l'adresse de la sonde de santé de l'API en production :
https://api.xplor.ma/api/health

### Résultat attendu
Le service répond avec un statut HTTP 200 OK et un corps JSON confirmant le bon fonctionnement des sondes de l'application :
```json
{
  "status": "ok",
  "checks": {
    "db": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

- [ ] Sonde de santé opérationnelle répondant HTTP 200 OK avec le statut `ok` sur https://api.xplor.ma/api/health

---

## Étape 2 : Connexion au back-office d'administration

### Action
1. Ouvrir le navigateur et accéder à l'interface d'administration :
   https://admin.xplor.ma
2. Sur l'écran **Connexion**, saisir l'adresse e-mail et le mot de passe du compte administrateur de production.
3. Cliquer sur le bouton **Se connecter**.
4. Si l'authentification à deux facteurs (2FA TOTP) est requise pour le compte administrateur, saisir le code à 6 chiffres dans l'écran de challenge et cliquer sur **Vérifier**.

### Résultat attendu
L'authentification réussit et l'utilisateur est redirigé vers le tableau de bord du back-office d'administration, confirmant la validité de la session d'administration en production.

- [ ] Connexion réussie au back-office d'administration sur https://admin.xplor.ma

---

## Étape 3 : Parcours éditeur

Ce parcours valide le cycle complet de gestion et de publication d'une visite virtuelle en production selon les sections de référence du document `docs/GUIDE_EDITEUR.md` :
- **Connexion** : Prérequis d'authentification sur le back-office validé à l'étape 2 (selon la section « Connexion » du guide).
- **Médiathèque et import de panoramas**
- **Créer une visite**
- **Ajouter des scènes**
- **Statuts de la visite : Brouillon et Publiée**
- **Publication, QR code et lien /v/** (notamment **QR code de la visite** et **Lien public web et route /v/**).

### 3.1 Médiathèque et import de panoramas — Importer un panorama

#### Action
1. Dans la barre latérale du back-office, cliquer sur le menu **Médias** pour accéder à la **Médiathèque**.
2. Dans le bloc d'envoi en haut de la page, cliquer sur le champ **Sélectionner des fichiers** et choisir un fichier panoramique JPEG équirectangulaire conforme aux prérequis techniques (ratio 2:1, largeur minimale de 4 096 pixels, poids maximal de 80 Mo).
3. Cliquer sur le bouton **Envoyer**.
4. Suivre l'avancement du téléversement jusqu'à la fin du transfert (état **Envoyé**), puis patienter pendant la prise en charge et le traitement par le worker d'arrière-plan.

#### Résultat attendu
Le panorama apparaît dans le tableau de la médiathèque avec sa miniature carrée, ses dimensions en pixels et le badge vert **Prêt**, confirmant son intégrité et sa disponibilité pour les scènes.

- [ ] Panorama 360° équirectangulaire importé et traité avec succès avec le statut Prêt dans la médiathèque

### 3.2 Créer une visite

#### Action
1. Dans la barre latérale de navigation du back-office, cliquer sur le menu **Visites**.
2. Cliquer sur le bouton **Nouvelle visite** en haut à droite pour accéder au **Formulaire de nouvelle visite** (selon la section « Créer une visite » du guide).
3. Renseigner les champs obligatoires du formulaire :
   - **Titre** : saisir le nom de la visite (en français).
   - **Résumé** : saisir un résumé descriptif de la visite (en français, maximum 500 caractères).
   - **Ville** : sélectionner une ville dans la liste déroulante.
   - **Catégories** : cocher au moins une catégorie dans la liste.
   - **Vignette** : cliquer sur le sélecteur, puis dans l'onglet **Médiathèque**, sélectionner une image ou un panorama au statut **Prêt** pour l'associer comme vignette.
4. Cliquer sur le bouton **Enregistrer**.

#### Résultat attendu
Le formulaire est validé, la visite est créée en base de données et l'interface redirige automatiquement vers l'écran **Détails de la visite** (`/tours/<id>`) au statut initial **Brouillon**.

- [ ] Visite virtuelle créée avec succès et accessible sur son écran de détails au statut Brouillon

### 3.3 Ajouter des scènes

#### Action
1. Sur l'écran **Détails de la visite**, faire défiler jusqu'à la section **Scènes** (selon la section « Ajouter des scènes » du guide).
2. Cliquer sur le bouton **Ajouter une scène**.
3. Renseigner les champs du formulaire :
   - **Titre** : saisir le titre de la scène (en français).
   - **Panorama** : cliquer sur le champ pour ouvrir la boîte de dialogue **Sélectionner un média**, puis choisir dans l'onglet **Médiathèque** le panorama 360° au statut **Prêt** importé lors de la sous-étape 3.1.
4. Cliquer sur le bouton **Enregistrer**.
5. Après enregistrement de la scène, revenir à la fiche de la visite en cliquant sur le lien **← Retour à la visite**.
6. Dans le tableau de la section **Scènes**, vérifier que la scène est désignée comme **Scène de départ** (cliquer sur le bouton **Définir comme départ** si nécessaire pour afficher le badge **Scène de départ**).

#### Résultat attendu
La scène panoramique 360° est enregistrée et rattachée à la visite. Elle apparaît dans le tableau des scènes avec son titre et le badge **Scène de départ**.

- [ ] Scène 360° ajoutée avec son panorama et configurée comme scène de départ de la visite

### 3.4 Statuts de la visite : Brouillon et Publiée — Publier la visite

#### Action
1. Sur l'écran **Détails de la visite**, repérer le panneau supérieur de gestion de statut (selon les sections « Statuts de la visite : Brouillon et Publiée » et « Publication, QR code et lien /v/ » du guide).
2. Cliquer sur le bouton **Vérifier** pour lancer le contrôle d'intégrité de la visite (scène de départ définie, panoramas prêts, scènes accessibles).
3. Constater le message de validation : **Aucun problème : la visite peut être publiée**.
4. Cliquer sur le bouton **Publier**.

#### Résultat attendu
La demande de publication est acceptée par l'API, le badge de statut bascule instantanément de **Brouillon** à **Publiée**, et le panneau affiche la section **Lien public** avec le jeton de partage (`shareToken`) ainsi que la section **QR code de la visite**.

- [ ] Visite validée et publiée avec succès, passage du statut Brouillon au statut Publiée

### 3.5 QR code de la visite — Récupérer le QR code

#### Action
1. Dans le panneau de publication de la visite publiée, localiser le bloc **QR code de la visite** (selon la section « QR code de la visite » du guide).
2. Vérifier l'affichage du rendu vectoriel du QR code encodant l'adresse publique `https://v.xplor.ma/v/<shareToken>`.
3. Cliquer sur le bouton **Télécharger le QR code**.

#### Résultat attendu
Le navigateur déclenche immédiatement le téléchargement du fichier image vectorielle au format SVG nommé `xplor-<shareToken>.svg`, parfaitement lisible et prêt pour une impression ou un affichage physique.

- [ ] QR code vectoriel de la visite affiché dans l'interface et fichier SVG téléchargé avec succès

### 3.6 Lien public web et route /v/ — Ouvrir le lien /v/

#### Action
1. Dans le volet **Lien public** du panneau de publication, copier l'URL publique de la visite sous la forme `https://v.xplor.ma/v/<shareToken>` (selon la section « Lien public web et route /v/ » du guide).
2. Ouvrir un nouvel onglet dans le navigateur et accéder à cette adresse.
3. Vérifier le chargement de la visite sur l'application web publique.

#### Résultat attendu
L'application web publique (`apps/web`) charge avec succès la visite via la route `/v/:shareToken`. Le visualiseur immersif 360° affiche le panorama de la scène de départ, le titre de la visite s'affiche correctement, et la navigation interactive à 360° (rotation, inclinaison, zoom) est fluide et pleinement fonctionnelle sans nécessiter d'authentification.

- [ ] Consultation publique de la visite réussie sur l'URL https://v.xplor.ma/v/<shareToken> avec affichage interactif du visualiseur 360°

---

## Étape 4 : Parcours gestionnaire d'hôtel

Ce parcours valide l'ensemble des fonctionnalités d'administration déléguée et d'exploitation offertes à un gestionnaire d'établissement hôtelier selon les sections de référence du document `docs/GUIDE_GESTIONNAIRE_HOTEL.md` :
- **1. Connexion** (notamment **Procédure de connexion**)
- **2. Périmètre (vos hôtels)** (notamment **Rôle et habilitations** et **Menu de navigation**)
- **3. Visites proposées sur le kiosque** (notamment **Accéder à la sélection**, **Explorer le catalogue des visites**, **Ajouter une visite**, **Gérer les visites sélectionnées** et **Enregistrer les modifications**)
- **4. Kiosques (enrôlement, état et heartbeat, mode veille, hors ligne)** (notamment **Tableau des kiosques**, **États de connexion (« État »)**, **Battement de cœur (« Heartbeat »)** et **Mode veille**)
- **5. Statistiques et export CSV** (notamment **Accéder aux statistiques**, **Filtrer les données**, **Indicateurs clés**, **Graphiques et classements** et **Exporter les données en CSV**)
- **6. Kiosque hors ligne : que faire et qui contacter** (notamment **Rappel sur le statut « Hors ligne »**, **Vérifications sur le matériel**, **Écran de maintenance sur le kiosque (personnel autorisé)** et **Qui contacter si le dysfonctionnement persiste**).

### 4.1 Connexion — Procédure de connexion

#### Action
1. Sur le back-office d'administration (https://admin.xplor.ma ou environnement de démonstration local), si une session précédente est active, cliquer sur le bouton **Se déconnecter** dans la barre supérieure (selon la section « Déconnexion » du guide).
2. Sur l'écran **Connexion**, renseigner les champs d'identification (selon la section « Procédure de connexion » du guide) :
   - **Adresse e-mail** : saisir l'adresse e-mail d'un compte disposant du rôle « Gestionnaire d'hôtel » (`HOTEL_MANAGER`), par exemple le compte de démonstration `manager@xplor.local` (issu du seed) ou le compte gestionnaire attribué à l'établissement en production.
   - **Mot de passe** : saisir le mot de passe associé au compte gestionnaire.
3. Cliquer sur le bouton **Se connecter**.
4. Si l'authentification à deux facteurs est activée pour ce compte, renseigner le code à 6 chiffres sur l'écran d'authentification TOTP puis cliquer sur **Vérifier**.

#### Résultat attendu
L'authentification réussit et l'utilisateur est redirigé vers l'interface du back-office. L'en-tête confirme l'identité du gestionnaire avec son nom et son rôle (« Gestionnaire » ou « Gestionnaire d'hôtel »), et la barre latérale affiche uniquement les rubriques autorisées pour son profil.

- [ ] Connexion réussie au back-office d'administration avec un compte Gestionnaire d'hôtel (ex. manager@xplor.local)

### 4.2 Périmètre (vos hôtels) — Rôle et habilitations

#### Action
1. Examiner la barre latérale « Navigation principale » pour vérifier la composition du menu (selon la section « Menu de navigation » du guide) :
   - Constater la présence des rubriques accessibles au gestionnaire : **Accueil**, **Visites**, **Hôtels**, **Kiosques**, **Statistiques**.
   - Constater l'absence des rubriques d'administration globale : **Utilisateurs**, **Journaux d'audit**, ou boutons de création d'hôtel.
2. Cliquer sur le menu **Hôtels** dans la barre latérale pour afficher la liste des établissements rattachés (selon la section « Rôle et habilitations » du guide).
3. Examiner le tableau des hôtels affiché :
   - Vérifier la présence des colonnes **Nom** et **Ville**.
   - Vérifier que seul(s) le ou les établissements attribués au gestionnaire connecté sont visibles (ex. « Hôtel Démonstration Rabat » dans le cadre du seed), sans aucune fuite de données vers des hôtels tiers.
   - Repérer le lien d'action **Sélection** sur la ligne de l'établissement.

#### Résultat attendu
Le menu de navigation restreint et le tableau des hôtels appliquent strictement la politique d'accès (`AccessPolicy`) : le gestionnaire d'hôtel n'accède qu'à son propre périmètre d'établissement, avec l'impossibilité de visualiser ou modifier les hôtels tiers ou d'accéder aux fonctions d'administration générale réservées aux administrateurs.

- [ ] Cloisonnement multi-tenant et périmètre strict vérifiés dans la rubrique Hôtels pour le rôle Gestionnaire d'hôtel

### 4.3 Visites proposées sur le kiosque — Gérer les visites sélectionnées

#### Action
1. Dans la liste des établissements de la rubrique **Hôtels**, cliquer sur le lien d'action **Sélection** de l'hôtel rattaché (selon la section « Accéder à la sélection » du guide).
2. Constater l'affichage de l'écran « Sélection des visites » avec le numéro de version courante (**Version {{version}}**).
3. Dans la section **Catalogue des visites** (selon la section « Explorer le catalogue des visites » du guide) :
   - Utiliser le champ **Rechercher une visite** ou les filtres **Ville** et **Catégorie** pour localiser les visites publiées disponibles sur la plateforme.
   - Sur une visite publiée disponible, cliquer sur le bouton **Ajouter** (selon la section « Ajouter une visite » du guide) ; constater que le bouton indique désormais **Ajoutée** et que la visite est insérée dans la section « Visites sélectionnées ».
4. Dans la section **Visites sélectionnées** (selon la section « Gérer les visites sélectionnées » du guide) :
   - Réorganiser l'ordre d'affichage des visites à l'aide des boutons **Monter** et **Descendre**.
   - Activer la case à cocher **Mise en avant** sur la visite destinée à être mise en vedette sur l'écran d'accueil du kiosque (« À la une »).
   - Activer la case à cocher **Mode veille** sur les visites à faire défiler dans la boucle d'attente automatique du kiosque.
5. Cliquer sur le bouton **Enregistrer** (selon la section « Enregistrer les modifications » du guide).

#### Résultat attendu
Pendant la sauvegarde, le bouton affiche **Enregistrement...**. La confirmation **Sélection enregistrée.** s'affiche à l'écran et le numéro de version de la sélection est incrémenté, garantissant que les kiosques physiques de l'hôtel recevront cette mise à jour lors de leur prochaine synchronisation.

- [ ] Bouquet de visites du kiosque configuré, ordonné et enregistré avec succès avec incrémentation de la version

### 4.4 Kiosques (enrôlement, état et heartbeat, mode veille, hors ligne) — Tableau des kiosques

#### Action
1. Dans la barre latérale de navigation, cliquer sur le menu **Kiosques** (selon la section « Tableau des kiosques » du guide).
2. Consulter le tableau recensant le parc d'appareils déployés pour les hôtels rattachés au gestionnaire :
   - **Nom** : nom ou libellé d'identification du kiosque (ex. « Hall principal »).
   - **Hôtel** : établissement auquel l'appareil est affecté.
   - **État** : état de connectivité et de synchronisation (selon la section « États de connexion (« État ») » du guide : **En ligne**, **Désynchronisé**, **Hors ligne**, **En attente** ou **Désactivé**).
   - **Dernier signal** : date et heure de réception du dernier signal régulier (*heartbeat*) transmis par l'appareil (selon la section « Battement de cœur (« Heartbeat ») » du guide).
   - **Version** : version logicielle de l'application kiosque installée sur l'appareil.
   - **Espace libre** : stockage disponible restant sur l'appareil (exprimé en mégaoctets, `{{mb}} Mo`).
3. Vérifier que la colonne **Actions** n'expose pas d'opérations d'administration destructives non autorisées pour le rôle gestionnaire (les actions techniques avancées telles que la suppression ou le changement de configuration restant protégées).

#### Résultat attendu
Le tableau des kiosques restitue fidèlement l'état opérationnel du parc d'équipements de l'hôtel, permettant au gestionnaire de surveiller la connectivité des bornes, la fraîcheur des signaux réguliers et la capacité de stockage locale.

- [ ] Consultation et suivi du parc d'appareils validés dans le tableau des kiosques

### 4.5 Statistiques et export CSV — Exporter les données en CSV

#### Action
1. Dans la barre latérale de navigation, cliquer sur le menu **Statistiques** (selon la section « Accéder aux statistiques » du guide).
2. Vérifier l'affichage du titre **Statistiques** et du sous-titre « Activité des visites sur la période sélectionnée. ».
3. Configurer les filtres d'analyse (selon la section « Filtrer les données » du guide) :
   - Définir la plage de dates dans les champs **Du** et **Au** (plage maximale de 366 jours consécutifs).
   - Sélectionner l'hôtel dans la liste déroulante **Hôtel** (restreinte aux seuls établissements attribués au gestionnaire).
   - Optionnellement, filtrer par **Visite**, **Canal** ou **Langue**.
   - Cliquer sur le bouton **Appliquer les filtres**.
4. Examiner les cartes d'**Indicateurs clés** (**Sessions**, **Durée moyenne**, **Visites ouvertes**, **Scènes vues**, **Clics sur les points**, **Entrées VR**, **Scans QR**) ainsi que les graphiques de fréquentation (**Sessions par jour**, **Visites les plus ouvertes**).
5. En haut à droite de la page, cliquer sur le bouton **Exporter en CSV** (selon la section « Exporter les données en CSV » du guide).
6. Observer l'état transitoire **Préparation du CSV…** pendant la génération du fichier.

#### Résultat attendu
Le fichier nommé `xplor-statistiques.csv` est automatiquement téléchargé par le navigateur. Le document est encodé en UTF-8 avec marqueur BOM et séparateur point-virgule (`;`), garantissant une ouverture immédiate sous tableur (Excel, LibreOffice) sans altération des caractères accentués, et restituant le tableau des indicateurs clés ainsi que la ventilation chronologique des visites.

- [ ] Indicateurs d'activité du kiosque consultés et fichier xplor-statistiques.csv téléchargé avec succès

### 4.6 Kiosque hors ligne : que faire et qui contacter — Écran de maintenance sur le kiosque (personnel autorisé)

#### Action
1. Prendre connaissance de la procédure opérationnelle applicable lorsqu'un kiosque présente l'état **Hors ligne** (selon les sections « Rappel sur le statut « Hors ligne » » et « Vérifications sur le matériel » du guide) :
   - Contrôle du branchement électrique et de la mise sous tension de l'écran.
   - Contrôle tactile de l'écran pour quitter le mode veille (« Touchez l'écran pour explorer »).
   - Contrôle du raccordement réseau filaire (câble RJ45 clipsé, voyants réseau actifs) ou sans fil (Wi-Fi de l'hôtel opérationnel, absence de blocage par portail captif).
   - Procédure de redémarrage électrique avec coupure de 15 à 30 secondes avant remise sous tension.
2. Sur la borne ou l'écran physique du kiosque, ouvrir l'écran de **Maintenance** affichant « Saisissez le code PIN de l'hôtel pour déverrouiller l'écran technique. » (selon la section « Écran de maintenance sur le kiosque (personnel autorisé) » du guide).
3. Saisir le **Code PIN** à 4 chiffres configuré pour l'hôtel et valider par le bouton **Valider**.
4. Sur l'écran technique **État du kiosque**, vérifier les informations de diagnostic affichées :
   - **Version de l'application**
   - **Version du manifeste**
   - **Dernière synchronisation**
   - **État de la synchronisation** (**Synchronisé** ou **Erreurs de synchronisation**)
   - **Visites en échec**
5. Tester l'action **Forcer la synchronisation** pour demander le rechargement immédiat des contenus en attente.
6. En cas de blocage persistant, relever les informations requises (**Nom** du kiosque, **Hôtel**, date et heure du **Dernier signal**, **Version**, **Espace libre**, description du comportement constaté) et suivre la procédure de contact de l'administrateur ou de l'équipe de support (selon la section « Qui contacter si le dysfonctionnement persiste » du guide).

#### Résultat attendu
La démarche de diagnostic et de remise en service d'un kiosque hors ligne est validée : l'accès sécurisé par code PIN à l'écran de maintenance permet d'inspecter l'état technique de l'appareil physique, de forcer une synchronisation locale et de rassembler les éléments de diagnostic nécessaires à une escalade technique auprès du support.

- [ ] Procédure de diagnostic et d'accès à l'écran de maintenance du kiosque par code PIN validée
