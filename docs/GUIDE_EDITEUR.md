# Guide de l'éditeur — Back-office Xplor

## Introduction

### À quoi sert le back-office Xplor ?
Le back-office Xplor est l'interface web de gestion et d'administration de la plateforme Xplor. Il permet de gérer le catalogue des visites virtuelles immersives à 360° destinées aux bornes de réalité virtuelle (kiosques) installées dans les hôtels partenaires, ainsi qu'à la consultation sur le web et les appareils mobiles.

Depuis cette interface, les utilisateurs peuvent notamment :
- Créer et organiser les visites virtuelles (titre, description, ville, catégorie, vignette de présentation).
- Téléverser et gérer les photographies panoramiques 360° (scènes équirectangulaires).
- Positionner et relier les points d'intérêt interactifs (hotspots) reliant les scènes entre elles ou affichant des informations complémentaires.
- Prévisualiser les visites virtuelles et les publier pour les rendre accessibles aux visiteurs.

### À qui s'adresse ce guide ?
Ce document s'adresse principalement aux utilisateurs disposant du rôle d'Éditeur, ainsi qu'aux gestionnaires de contenu et administrateurs ayant un profil non technique. Il détaille pas à pas l'accès au back-office et son utilisation au quotidien, sans nécessiter de connaissances informatiques approfondies.

---

## Connexion

### Accéder à la page de connexion
Pour utiliser le back-office, ouvrez votre navigateur web et accédez à l'adresse du service d'administration (par exemple `https://admin.xplor.ma` en environnement de production).

La page présente le logo Xplor, le slogan « Votre voyage commence ici » et une carte centrale intitulée « Connexion ».

### Saisir vos identifiants
Le formulaire de connexion demande deux informations obligatoires :
1. **Adresse e-mail** : l'adresse électronique associée à votre compte d'utilisateur.
2. **Mot de passe** : le mot de passe secret défini pour votre compte. Conformément aux exigences de sécurité de la plateforme, tout mot de passe doit comporter au moins 12 caractères.

Pour vous connecter :
- Renseignez votre adresse e-mail et votre mot de passe dans leurs champs respectifs.
- Cliquez sur le bouton **Se connecter**. Pendant le traitement de la demande, le bouton est temporairement désactivé pour éviter les envois répétés.

### En cas d'oubli de mot de passe
Si vous avez égaré votre mot de passe :
- Cliquez sur le lien **Mot de passe oublié** situé au bas de la carte de connexion.
- Renseignez votre adresse de messagerie dans le champ **Adresse e-mail**, puis cliquez sur le bouton **Envoyer le lien**.
- Si un compte correspond à cette adresse, un courriel vous est envoyé avec un lien pour choisir un nouveau mot de passe. Ce lien est valable pendant 1 heure (à titre informatif, les liens d'invitation initiale permettant de créer son mot de passe sont quant à eux valables 48 heures).

### Messages d'erreur et sécurité du compte
Lors de la saisie ou de la validation de vos identifiants, l'interface peut afficher différents messages d'alerte :
- **Identifiants incorrects** : l'adresse e-mail ou le mot de passe indiqué ne correspond à aucun compte valide. Vérifiez vos informations et réessayez.
- **Compte verrouillé. Réessayez dans 15 minutes.** : pour se prémunir contre les tentatives d'accès malveillantes par force brute, le système bloque automatiquement l'accès au compte pendant 15 minutes dès le 10e échec de connexion consécutif. Vous devez alors patienter 15 minutes avant de tenter une nouvelle saisie.
- **La connexion a échoué. Réessayez.** : un problème réseau ou une défaillance temporaire du serveur a empêché la vérification.
- **Ta session a expiré ou a été ouverte ailleurs. Reconnecte-toi.** : votre session a expiré après une période d'inactivité ou une autre connexion avec vos identifiants a été détectée sur un autre appareil ou navigateur.

### Étape de double authentification (2FA)
Lorsque la double authentification est activée sur votre compte (elle concerne les comptes administrateur) :

1. Après validation de votre adresse e-mail et de votre mot de passe, un second écran s'affiche avec le titre **Authentification à deux facteurs**.
2. Ouvrez votre application d'authentification mobile (par exemple Google Authenticator, Microsoft Authenticator ou toute application compatible avec le protocole standard TOTP).
3. Dans le champ **Code à 6 chiffres**, saisissez le code numérique temporaire visible dans votre application. Ce code à 6 chiffres change régulièrement.
4. Cliquez sur le bouton **Vérifier**.

En cas d'anomalie :
- Si les 6 chiffres sont erronés ou si le code a expiré entre-temps, le message d'erreur **Code invalide** s'affiche.
- Si une erreur réseau intervient lors de la validation, le message **La demande a échoué. Réessayez.** s'affiche.

Dès la validation du code, votre session est établie et vous accédez immédiatement à l'accueil du back-office.

---

## Médiathèque et import de panoramas

### Rôle et présentation de la médiathèque
La **Médiathèque** centralise les ressources multimédias (notamment les photographies panoramiques 360°) nécessaires à la composition des visites virtuelles.

Pour accéder à la médiathèque :
- Dans la barre latérale de navigation du back-office, cliquez sur le menu **Médias**.
- L'écran affiche l'en-tête **Médiathèque** accompagné du sous-titre **Gérez les images, panoramas et sons.**

### Organisation des dossiers
Sur le côté gauche de la page (ou dans le menu déroulant sur écran mobile), la section **Dossiers** permet de filtrer l'affichage des médias :
- **Tous les médias** : affiche la liste intégrale de tous les fichiers enregistrés sur la plateforme.
- **Dossiers par visite** : chaque visite virtuelle existante dispose d'un dossier dédié portant le titre de la visite, avec le nombre de fichiers associés entre parenthèses. Sélectionner un dossier de visite restreint la liste aux médias rattachés à ses scènes ou à sa vignette de présentation.
- **Non utilisés** : regroupe les médias orphelins, c'est-à-dire ceux qui ne sont actuellement associés à aucune scène, aucun point d'intérêt ni aucune vignette. Ce dossier permet d'identifier rapidement les éléments superflus pouvant être nettoyés.

### Spécifications et prérequis pour les panoramas 360°
Pour pouvoir être traités et intégrés dans les visites virtuelles, les fichiers panoramiques doivent répondre aux spécifications techniques suivantes, vérifiées automatiquement lors de l'import :

- **Format de fichier** : image JPEG uniquement (`image/jpeg`). Tout autre type de fichier est refusé.
- **Type de projection et proportions** : panorama équirectangulaire au ratio 2:1 (la largeur correspond exactement au double de la hauteur). Une tolérance d'écart de 1 % est appliquée lors de la validation pour accepter les légères variations de cadrage.
- **Dimensions minimales** : la largeur de l'image doit être d'au moins 4 096 pixels (par exemple 4096 × 2048 pixels ou 8192 × 4096 pixels). Les images de largeur inférieure sont refusées.
- **Poids maximal** : le fichier ne doit pas dépasser 80 Mo.
- **Validation et intégrité** : un fichier endommagé ou qui n'est pas une image JPEG valide est refusé lors de l'analyse.

### Importer des panoramas
Pour ajouter un ou plusieurs panoramas depuis votre poste de travail :

1. Dans le volet **Dossiers**, sélectionnez le dossier souhaité (choisissez une visite précise pour rattacher directement vos images, ou restez sur **Tous les médias**).
2. Dans le bloc d'envoi en haut de la page, cliquez sur le champ **Sélectionner des fichiers** pour choisir un ou plusieurs fichiers JPEG sur votre disque dur (la sélection multiple est possible).
3. Cliquez sur le bouton **Envoyer**.
4. Pour chaque fichier, une ligne affiche le nom du fichier, une barre de progression du téléversement et la mention **En cours**.
5. Une fois le transfert terminé, l'état indique **Envoyé**.
6. **Création automatique de scènes (optionnelle)** :
   - Si vous avez sélectionné le dossier d'une visite avant le téléversement, le bouton **Créer les scènes dans cette visite** devient disponible après l'envoi.
   - En cliquant sur ce bouton, son libellé passe à **Création...**. Dès que le traitement de chaque panorama est finalisé, le système crée automatiquement une scène dans la visite en reprenant le nom de base du fichier comme titre de scène.
   - Le statut du fichier indique alors **Envoyé (Scène créée)**.

### Cycle de traitement et statuts des médias
Une fois le téléversement achevé, le fichier entre dans une file de traitement en arrière-plan. Dans la colonne **Statut** du tableau, un badge indique l'état d'avancement :

- **En attente** : le média a été enregistré et attend sa prise en charge dans la file de traitement.
- **En cours** : le fichier a passé avec succès les vérifications de conformité et le système prépare en arrière-plan les différentes résolutions nécessaires à la consultation.
- **Prêt** : le traitement est achevé avec succès. Le panorama est opérationnel et peut être sélectionné dans les scènes.
- **Erreur** : le fichier a été refusé lors de la vérification ou du traitement. Un message explicatif détaillant le motif du refus (format invalide, dimensions inférieures au minimum de 4 096 pixels, ratio non conforme ou fichier dépassant 80 Mo) s'affiche sous le badge ou au survol.

### Consultation et actions sur les médias
Le tableau de la médiathèque présente les caractéristiques de chaque fichier sous plusieurs colonnes :
- **Nom** : présente la miniature carrée du média (lorsqu'elle est générée) et le nom du fichier.
- **Date de création** : date d'enregistrement du média sur la plateforme.
- **Dimensions** : dimensions de l'image en pixels (par exemple 8192 × 4096).
- **Taille (Mo)** : taille du fichier sur le disque en mégaoctets.
- **Statut** : badge d'état (**En attente**, **En cours**, **Prêt** ou **Erreur**).
- **Actions** :
  - **Retraiter** : ce bouton (disponible pour les médias au statut **Prêt** ou **Erreur**) permet de relancer le traitement en arrière-plan en cas de besoin, sans devoir re-téléverser l'image.
  - **Supprimer** : permet de supprimer définitivement le média de la plateforme. Une boîte de dialogue demande confirmation : « Êtes-vous sûr de vouloir supprimer ce média ? ».
    - Si le média est actuellement utilisé par une scène, un point d'intérêt ou comme vignette de visite, la suppression est bloquée et le système affiche : **Ce média est utilisé par une scène ou un point d'intérêt.**
    - Pour pouvoir supprimer ce média, il est nécessaire de le retirer préalablement des scènes ou visites qui y font référence.

Au-delà de 20 éléments dans la liste, une pagination s'affiche au bas du tableau avec les boutons **Précédent** et **Suivant** pour parcourir les différentes pages.

### Nettoyer la médiathèque
Pour supprimer en masse les fichiers qui ne sont plus exploités dans aucune visite :
1. Cliquez sur le bouton **Nettoyer la médiathèque** situé en haut à droite de la page.
2. Le système analyse les médias non utilisés :
   - Si aucun média orphelin n'est trouvé, une boîte de dialogue avec le titre **Information** affiche le message : **La médiathèque est déjà propre**.
   - Si des médias orphelins sont identifiés, une fenêtre de **Confirmation** s'affiche en indiquant le nombre de médias concernés et le volume total en mégaoctets qui sera supprimé.
3. Cliquez sur **Confirmer** pour procéder à la suppression définitive, ou sur **Annuler** pour abandonner l'opération.
4. Une boîte de dialogue avec le titre **Succès** confirme le nombre de médias effectivement supprimés.

### Sélectionner un média dans l'éditeur de visite ou de scène
Lors de l'édition d'une visite (choix de la vignette) ou d'une scène (choix du panorama 360°) :
- Cliquez sur le champ de sélection pour ouvrir la boîte de dialogue **Sélectionner un média**.
- Deux onglets sont proposés :
  - **Médiathèque** : permet de choisir parmi les médias déjà importés et prêts. Vous pouvez utiliser le champ **Rechercher par nom...** pour filtrer rapidement vos fichiers.
  - **Envoyer depuis mon ordinateur** : permet de téléverser directement un nouveau fichier depuis votre ordinateur sans devoir quitter le formulaire d'édition.

---

## Créer une visite

### Accéder à la création d'une visite
Pour créer une nouvelle visite virtuelle :
- Dans la barre latérale du back-office, cliquez sur le menu **Visites**.
- En haut à droite du tableau des visites, cliquez sur le bouton **Nouvelle visite** (accessible aux utilisateurs disposant du rôle Éditeur ou Administrateur).
- Vous pouvez également cliquer sur le raccourci **Nouvelle visite** accessible sur la page d'**Accueil**.
- L'écran s'ouvre sur la page intitulée **Nouvelle visite**.

### Formulaire de nouvelle visite
Le formulaire regroupe les informations descriptives et géographiques de la visite :

- **Titre** : nom de la visite virtuelle (champ obligatoire). Si le titre n'est pas renseigné au moment de soumettre le formulaire, le message d'erreur **Le français est obligatoire.** s'affiche.
- **Résumé** : texte de présentation synthétique de la visite (champ multiligne obligatoire, limité à 500 caractères). Si le résumé n'est pas renseigné au moment de soumettre le formulaire, le message d'erreur **Le français est obligatoire.** s'affiche.
- **Description** : texte de présentation détaillé de la visite (champ multiligne optionnel).
- **Informations pratiques** : renseignements utiles aux visiteurs (horaires, accès, recommandations ; champ multiligne optionnel).
- **Ville** : liste déroulante obligatoire. L'option initiale indique **Sélectionner une ville...**. Vous devez sélectionner la ville de rattachement parmi les villes configurées dans le catalogue.
- **Catégories** : liste de cases à cocher présentant les catégories disponibles. Vous devez cocher au moins une catégorie pour pouvoir enregistrer la visite.
- **Vignette** : image de présentation associée à la visite, affichée sur les listes et sur les fiches de présentation (champ obligatoire).
  - Le sélecteur affiche au départ le bouton **Sélectionner un média...**. Une fois un média choisi, son intitulé s'affiche accompagné du bouton **Modifier**.
  - Si aucune vignette n'a été sélectionnée lors de la soumission du formulaire, le message d'erreur **Veuillez sélectionner une vignette.** s'affiche.
  - Deux types de médias sont acceptés pour la vignette : les images (**Image**) et les photographies panoramiques 360° (**Panorama**).
  - Cliquez sur le champ pour ouvrir la boîte de dialogue **Sélectionner un média** :
    - L'onglet **Médiathèque** liste les médias au statut **Prêt**. Vous pouvez utiliser la liste déroulante **Filtrer par type** (**Tous les types**, **Image** ou **Panorama**) et la zone de recherche **Rechercher un média** (champ « Rechercher par nom... »). Cliquez sur le média ou le panorama souhaité pour l'associer comme vignette.
    - L'onglet **Envoyer depuis mon ordinateur** permet d'importer directement un nouveau fichier image ou panorama depuis votre disque dur en cliquant sur **Choisir un fichier**, puis sur **Envoyer**.
- **Durée (minutes)** : durée estimée du parcours en minutes (champ numérique optionnel, nombre entier positif).
- **Latitude** : coordonnée géographique comprise entre -90 et 90 (champ numérique optionnel).
- **Longitude** : coordonnée géographique comprise entre -180 et 180 (champ numérique optionnel).

### Enregistrement et fiche de la visite
Pour valider la création de la visite :
1. Cliquez sur le bouton **Enregistrer** situé au bas du formulaire. Pendant l'enregistrement, le bouton est temporairement désactivé pour éviter tout double envoi.
2. Si des informations sont invalides ou incomplètes (par exemple si aucune catégorie n'est cochée), le message rouge **Veuillez corriger les erreurs dans le formulaire.** s'affiche (ou **Veuillez sélectionner une vignette.** si aucune vignette n'a été sélectionnée).
3. Dès que l'enregistrement réussit, vous êtes automatiquement redirigé vers l'écran **Détails de la visite** (`/tours/<id>`). Lors d'une modification ultérieure depuis cette fiche, cliquer sur **Enregistrer** affiche le message de confirmation **Visite enregistrée.**

### Statuts de la visite : Brouillon et Publiée
Chaque visite possède un cycle de vie caractérisé par deux statuts :

- **Brouillon** : statut initial de toute visite nouvellement créée. La visite est en cours de composition et demeure invisible pour le public (non consultable sur les bornes ni via les liens publics non authentifiés).
- **Publiée** : statut actif indiquant que la visite est finalisée, validée et mise à disposition des visiteurs.

#### Gestion du statut depuis la fiche de la visite
Dans la partie supérieure de l'écran **Détails de la visite**, le bloc de publication permet de gérer l'état de la visite :
- La mention **Statut :** est suivie du badge d'état actuel (**Brouillon** ou **Publiée**).
- **Vérifier** : ce bouton lance un contrôle d'intégrité de la visite (présence d'une scène de départ, cohérence des liens entre les scènes et conformité des panoramas).
  - Si aucune anomalie n'est détectée, le message **Aucun problème : la visite peut être publiée** s'affiche.
  - Si des erreurs sont présentes, l'encadré d'alerte **Problèmes à corriger avant publication** détaille les points à rectifier (par exemple : scène de départ manquante, panorama non prêt, ou scène inatteignable).
- **Publier** : bouton visible lorsque la visite est au statut **Brouillon**. Il permet de basculer la visite au statut **Publiée** après vérification automatique de l'intégrité de la visite. Si la visite comporte des anomalies non résolues, la publication est bloquée et les problèmes sont affichés.
- **Dépublier** : bouton visible lorsque la visite est au statut **Publiée**. Il permet de repasser immédiatement la visite en **Brouillon** pour masquer temporairement son accès public et effectuer des ajustements.
- **Tester la visite** : bouton situé en haut à droite de l'en-tête de la page. Il ouvre un aperçu de la visite dans un nouvel onglet, avec le badge **Aperçu – visite non publiée**. Si l'ouverture automatique du nouvel onglet est bloquée par votre navigateur, le lien de secours **Ouvrir l'aperçu** s'affiche.
- **Lien public et QR code** : dès que la visite est publiée, le volet affiche le **Lien public** pérenne ainsi que le **QR code de la visite**. Le bouton **Télécharger le QR code** permet d'enregistrer l'image vectorielle SVG du QR code pour l'impression ou la signalétique.
- **Régénérer le lien de partage** : permet d'invalider le jeton public actuel et d'en générer un nouveau. Une boîte de dialogue demande confirmation : « Les anciens liens et QR codes ne fonctionneront plus. Voulez-vous continuer ? ».

#### Suivi des statuts dans la liste des visites
Sur la page **Visites** :
- Le tableau présente la colonne **Statut** avec le badge **Brouillon** ou **Publiée** pour chaque visite.
- Le filtre déroulant **Statut** en haut de page permet de filtrer la liste en affichant **Tous les statuts**, uniquement les visites au statut **Brouillon**, ou au statut **Publiée**.
- Pour chaque ligne du tableau, le bouton **Modifier** ouvre la fiche de détail, et le bouton **Dupliquer** permet de dupliquer une visite et l'ensemble de ses scènes (la copie est créée au statut Brouillon).

---

## Ajouter des scènes

### Présentation de la section des scènes
Sur l'écran **Détails de la visite**, sous le formulaire des caractéristiques générales, se trouve la section **Scènes**.
Elle regroupe sous forme de tableau toutes les scènes panoramiques 360° qui composent la visite :
- **Titre** : nom de la scène, avec le badge **Scène de départ** pour la scène d'entrée. Cliquer sur le titre ouvre l'écran de modification de la scène.
- **Hotspots** : nombre de points d'interaction configurés dans la scène.
- **Actions** : ensemble des boutons permettant d'ordonner et d'administrer chaque scène.

### Créer une scène manuellement
Pour ajouter une scène dans la visite :
1. Cliquez sur le bouton **Ajouter une scène** situé sous le tableau des scènes.
2. La page s'ouvre avec le titre **Ajouter une scène**. Le fil d'Ariane indique le cheminement : **Visites** > *[Titre de la visite]* > **Nouvelle scène**. Le lien **← Retour à la visite** permet de revenir à la visite sans enregistrer.
3. Renseignez les champs du formulaire :
   - **Titre** : nom de la scène (champ obligatoire, avec onglets **Français**, **Arabe** et **Anglais** ; la saisie en français est obligatoire).
   - **Légende** : courte mention descriptive affichée en surimpression lors de la visualisation (champ optionnel).
   - **Panorama** : photographie panoramique 360° associée à la scène (champ obligatoire).
     - Cliquez sur le champ pour ouvrir la boîte de dialogue **Sélectionner un média**.
     - Dans l'onglet **Médiathèque**, sélectionnez un panorama déjà importé dont le statut est **Prêt** (vous pouvez utiliser le champ de recherche par nom).
     - Dans l'onglet **Envoyer depuis mon ordinateur**, vous pouvez téléverser directement un fichier JPEG équirectangulaire conforme (ratio 2:1, largeur minimale 4 096 pixels, 80 Mo maximum).
   - Paramètres de vue initiale :
     - **Lacet initial** : angle horizontal du regard au chargement de la scène, exprimé en radians de -π à π (environ ±3,14, pas de 0,1, valeur par défaut : 0).
     - **Tangage initial** : angle vertical d'inclinaison du regard, exprimé en radians de -π/2 à π/2 (environ ±1,57, pas de 0,1, valeur par défaut : 0).
     - **Zoom initial** : niveau de grossissement initial de la vue, sous la forme d'un entier de 0 à 100 (valeur par défaut : 50).
   - **Narration audio** : fichiers audio d'explication vocale diffusés à l'ouverture de la scène (champs optionnels déclinables pour chaque langue : **Français**, **العربية**, **English**).
   - **Son d'ambiance** : fichier audio diffusé en boucle en arrière-plan sonore de la scène (champ optionnel).
4. Cliquez sur le bouton **Enregistrer**. Dès la validation, la scène est créée et l'interface ouvre automatiquement sa page de modification (`/tours/<tourId>/scenes/<sceneId>`).

### Création automatique de scènes depuis la médiathèque
Pour créer rapidement plusieurs scènes à la suite :
1. Rendez-vous dans le menu **Médias** de la barre latérale.
2. Dans le volet **Dossiers**, sélectionnez le dossier correspondant à votre visite.
3. Utilisez le bloc d'envoi pour téléverser l'ensemble de vos panoramas JPEG 360°.
4. Une fois l'envoi terminé, cliquez sur le bouton **Créer les scènes dans cette visite**.
5. Le système crée automatiquement une scène dans la visite pour chaque panorama dès la fin de son traitement, en reprenant le nom de base du fichier comme titre de scène.
6. Vous pouvez ensuite retourner dans la visite pour renommer les scènes et ajuster leur ordre.

### Nommer et modifier une scène
Depuis la section **Scènes** de la visite, cliquez sur le bouton **Modifier** en face de la scène souhaitée (ou sur son titre).
L'écran présente deux onglets de travail :
- **Informations** : permet d'ajuster le **Titre**, la **Légende**, le fichier **Panorama** associé, les paramètres de vue initiale et les médias sonores. Cliquez sur **Enregistrer** pour sauvegarder les modifications ; la mention **Scène enregistrée avec succès** confirme l'enregistrement. Le bouton **Supprimer** permet de supprimer définitivement la scène après confirmation par la boîte de dialogue : « Êtes-vous sûr ? ».
- **Éditeur 360** : affiche le visualiseur panoramique immersif pour positionner les points d'intérêt (hotspots) et ajuster visuellement l'orientation du regard.

Au bas de la page, deux liens permettent de naviguer rapidement entre les scènes de la visite dans l'ordre établi :
- **← Scène précédente**
- **Scène suivante →**

### Ordonner les scènes et choisir la scène de départ
Dans le tableau de la section **Scènes**, plusieurs boutons d'action permettent d'organiser le parcours :

- **Monter** : déplace la scène d'un cran vers le haut dans l'ordre d'affichage. Le bouton est désactivé pour la première scène de la liste.
- **Descendre** : déplace la scène d'un cran vers le bas dans l'ordre d'affichage. Le bouton est désactivé pour la dernière scène de la liste.
- **Définir comme départ** : définit la scène sélectionnée comme point d'entrée principal de la visite virtuelle.
  - La scène ainsi désignée reçoit immédiatement le badge **Scène de départ**.
  - La visite virtuelle doit obligatoirement posséder une scène de départ pour pouvoir être validée et publiée.
- **Supprimer** : supprime la scène de la visite après confirmation par le message : « Êtes-vous sûr ? ».

### Carte des liens et accessibilité des scènes
Sous le tableau des scènes, le bloc **Carte des liens** permet de contrôler que toutes les scènes de la visite sont correctement reliées entre elles :
- Le bouton **Actualiser** permet de recalculer le graphe de navigation.
- Si le graphe est complet, le message **Toutes les scènes sont accessibles.** confirme qu'un visiteur peut atteindre chaque scène à partir du point d'entrée.
- Si une ou plusieurs scènes ne sont connectées par aucun lien de navigation (hotspot), le message **Scènes inaccessibles depuis la scène de départ :** en dresse la liste. Il convient alors d'ajouter un hotspot pointant vers ces scènes pour rétablir la continuité du parcours.

---

## Éditeur visuel 360°

### Présentation et accès à l'éditeur 360°
L'**Éditeur 360** est l'espace de composition visuelle interactive de la visite. Il permet d'immerger directement l'éditeur dans le panorama de chaque scène pour positionner les points d'intérêt (hotspots), définir le cadrage d'accueil du visiteur et régler les transitions de regard entre les pièces ou points de vue.

Pour accéder à l'éditeur visuel d'une scène :
1. Dans la fiche de détail de la visite (`/tours/<id>`), faites défiler jusqu'à la section **Scènes**.
2. Cliquez sur le titre de la scène à modifier (ou sur le bouton **Modifier**).
3. Sur la page de la scène, deux onglets sont proposés sous le titre :
   - **Informations** : caractéristiques générales et saisie textuelle.
   - **Éditeur 360** : interface visuelle interactive. Cliquez sur cet onglet.
4. **Condition préalable** : le fichier panoramique associé à la scène doit avoir achevé son traitement en arrière-plan et afficher le statut **Prêt** dans la médiathèque. Si le traitement est encore en cours ou a échoué, l'éditeur ne s'ouvre pas et le message d'alerte **Le panorama n'est pas prêt.** s'affiche.

### Interface de l'éditeur 360°
L'écran de l'éditeur 360 se compose de deux zones complémentaires :

- **Le visualiseur 360° interactif (à gauche)** :
  - Affiche le panorama équirectangulaire complet. Vous pouvez faire pivoter la vue dans toutes les directions (lacet horizontal et tangage vertical) en maintenant le clic gauche enfoncé et en déplaçant la souris, ou par glissement sur écran tactile.
  - La molette de la souris permet d'ajuster le niveau de zoom.
  - En bas du visualiseur, la barre d'outils Photo Sphere Viewer intègre les commandes de zoom (`+` et `-`), le bouton **Déplacer** (mode déplacement de marqueur), la légende éventuelle et le bouton de bascule en plein écran.
  - En haut du visualiseur, la barre d'outils d'édition met à disposition :
    - Les boutons d'historique **Annuler** et **Rétablir**.
    - Le bouton **Définir la vue actuelle comme vue initiale**.
    - L'indicateur de statut de synchronisation automatique (**Modifications en attente…**, **Enregistrement…**, **Enregistré**, ou **Échec de l'enregistrement**).
- **Le panneau latéral de gestion (à droite)** :
  - **État neutre** : lorsqu'aucun point n'est sélectionné, il affiche le message d'aide : **Cliquez sur le panorama pour placer un hotspot.**
  - **Création** : dès qu'un clic est effectué sur le panorama, il affiche le formulaire **Nouveau hotspot**.
  - **Édition / Sélection** : lorsqu'un point existant est sélectionné, il affiche son libellé et propose les boutons d'action (**Modifier**, **Déplacer ici**, **Définir l'orientation d'arrivée**, **Supprimer**, **Annuler**).

### Placer un nouveau point d'intérêt (hotspot)
Pour créer un point d'intérêt dans la scène :
1. Dans le visualiseur 360°, orientez la caméra vers l'endroit précis où doit se situer l'interaction (par exemple une porte, un passage vers une autre pièce, un monument ou un objet remarquable).
2. Cliquez directement sur l'image panoramique à cet emplacement.
3. Un marqueur temporaire est positionné et le panneau latéral droit ouvre le formulaire intitulé **Nouveau hotspot**.
4. Configurez les propriétés du hotspot :
   - **Type** : sélectionnez l'interaction souhaitée :
     - **Lien vers une scène** : crée une transition de navigation vers une autre scène de la même visite.
     - **Lien vers une visite** : permet de relier la scène à une autre visite virtuelle complète (liaison inter-visites).
     - **Information** : ouvre une bulle d'information ou un panneau explicatif au clic ou survol.
     - **Média** : présente des photographies d'illustration complémentaires.
     - **Lien externe** : propose un lien vers une page web extérieure.
   - **Icône** : choisissez le pictogramme représentatif affiché sur le panorama parmi **Flèche**, **Info**, **Photo**, **Lecture** ou **Portail**.
   - **Libellé** : saisissez le nom ou l'infobulle du point d'intérêt. Ce champ utilise le composant multilingue avec onglets par langue (**Français**, **العربية**, **English**) ; la saisie en français est obligatoire.
   - **Champs spécifiques au type choisi** :
     - Pour un **Lien vers une scène** : sélectionnez la **Scène cible** dans la liste déroulante regroupant les autres scènes de la visite.
     - Pour un **Lien vers une visite** : recherchez la visite de destination via le champ de recherche textuel, sélectionnez la **Visite cible**, puis choisissez optionnellement la **Scène de départ (optionnelle)** au sein de cette visite distante.
     - Pour une **Information** : rédigez le contenu textuel dans le champ **Texte** (saisie multiligne multilingue, français obligatoire).
     - Pour un **Média** : cliquez sur le sélecteur **Médias** pour choisir une ou plusieurs images prêtes dans la médiathèque.
     - Pour un **Lien externe** : renseignez l'adresse web dans le champ **URL externe** (doit débuter par `http://` ou `https://`).
5. Cliquez sur le bouton **Enregistrer**.
   - Le bouton est désactivé pendant la transmission pour empêcher les soumissions en double.
   - Si des données requises sont manquantes, le message d'erreur **Veuillez corriger les erreurs dans le formulaire.** s'affiche.
   - Dès la validation par le serveur, le nouveau hotspot apparaît de manière permanente sur le panorama et dans la liste des points de la scène.
6. Si vous souhaitez annuler la création en cours avant enregistrement, cliquez sur le bouton **Annuler** : le formulaire se ferme et le marqueur temporaire disparaît.

### Déplacer et repositionner un point d'intérêt
Si un point d'intérêt n'est pas parfaitement aligné avec l'élément visible du panorama, vous pouvez ajuster sa position à tout moment selon 3 méthodes complémentaires :

1. **Glisser-déposer direct (Drag & Drop)** :
   - Dans le visualiseur 360°, cliquez sur l'icône du hotspot, maintenez le bouton de la souris enfoncé (ou le contact tactile) et déplacez le curseur vers le nouvel emplacement.
   - Relâchez pour fixer la nouvelle position.
   - Le visualiseur convertit automatiquement les coordonnées physiques 2D de l'écran en coordonnées sphériques 360° (lacet et tangage).
2. **Repositionnement guidé (« Déplacer ici »)** :
   - Cliquez une fois sur le hotspot pour le sélectionner (une bordure de mise en évidence l'entoure).
   - Dans le volet latéral droit, cliquez sur le bouton **Déplacer ici**.
   - L'indication **Cliquez sur la photo ou appuyez sur Échap pour annuler.** s'affiche.
   - Cliquez à l'endroit désiré sur le panorama : le point sélectionné est immédiatement téléporté à ces nouvelles coordonnées.
3. **Mode « Déplacer » de la barre d'outils du visualiseur** :
   - Sélectionnez le point d'intérêt à déplacer.
   - Dans la barre inférieure du visualiseur, cliquez sur le bouton **Déplacer** pour activer le mode.
   - Cliquez sur le nouvel emplacement dans le panorama. Le marqueur est mis à jour et le mode déplacement se désactive automatiquement.

**Annulation du repositionnement (touche Échap)** :
Si vous avez activé le mode de repositionnement par erreur (via le bouton **Déplacer ici** ou le mode déplacement), appuyez simplement sur la touche **Échap (Escape)** de votre clavier : le mode déplacement est immédiatement interrompu et le hotspot conserve son emplacement d'origine.

### Annulation et rétablissement des modifications
L'éditeur 360 intègre un système d'historique et de sauvegarde automatique temporisée pour garantir un travail fluide et sans risque de perte :

- **Boutons Annuler et Rétablir** :
  - Situés en haut à gauche au-dessus de l'image panoramique, les boutons **Annuler** et **Rétablir** permettent de naviguer dans l'historique des déplacements effectués au cours de la session.
  - Vous pouvez également utiliser les raccourcis clavier standards :
    - `Ctrl + Z` (ou `Cmd + Z` sous macOS) pour **Annuler** le dernier déplacement.
    - `Ctrl + Y` ou `Ctrl + Maj + Z` (ou `Cmd + Shift + Z` sous macOS) pour **Rétablir** le déplacement annulé.
  - Les boutons se désactivent automatiquement lorsque l'historique ne contient aucune action antérieure ou postérieure.
- **Sauvegarde automatique temporisée (Debounced Saver)** :
  - Chaque déplacement de hotspot est automatiquement mis en attente et enregistré sur le serveur après un délai d'inactivité de 1 seconde (évitant ainsi des requêtes réseau superflues lors des ajustements continus).
  - L'état de synchronisation est affiché en direct en haut à droite :
    - **Modifications en attente…** : le déplacement a été pris en compte localement et attend la fin de vos manipulations.
    - **Enregistrement…** : la mise à jour est en cours d'envoi vers le serveur.
    - **Enregistré** : les coordonnées sont validées et enregistrées de façon pérenne.
    - **Échec de l'enregistrement** : la communication avec le serveur a échoué. Un bouton **Réessayer** apparaît alors automatiquement à côté du message pour relancer immédiatement l'enregistrement sans perdre vos modifications.

### Définir la vue initiale d'une scène
La vue initiale correspond à l'angle de regard et au niveau de grossissement découverts par le visiteur dès l'ouverture de la scène.

Pour ajuster la vue initiale de manière visuelle :
1. Dans l'onglet **Éditeur 360**, naviguez dans le panorama, faites pivoter l'angle de vue horizontalement et verticalement, et ajustez le zoom jusqu'à trouver le cadrage le plus accueillant et représentatif de la scène.
2. Cliquez sur le bouton **Définir la vue actuelle comme vue initiale** situé dans la barre supérieure de l'éditeur.
3. Le système capture automatiquement le cadrage actuel du visualiseur (lacet horizontal, tangage vertical et niveau de zoom).
4. Le message vert de confirmation **Vue initiale enregistrée** apparaît.
5. Les valeurs sont enregistrées sur la scène et synchronisées avec les champs correspondants de l'onglet **Informations**.

### Orientation d'arrivée pour les liens de scène
Lorsqu'un visiteur clique sur un hotspot de type **Lien vers une scène** pour franchir une porte ou changer de pièce, il est essentiel que son regard s'oriente naturellement dans la continuité de son déplacement à son entrée dans la scène cible (par exemple en regardant vers l'intérieur de la nouvelle pièce plutôt que de revenir au cadrage initial par défaut).

Pour configurer cette orientation d'arrivée :
1. Dans l'éditeur 360, cliquez sur le hotspot de transition (type **Lien vers une scène**) pour le sélectionner.
2. Dans le panneau latéral droit, sous l'intitulé du hotspot, cliquez sur le bouton **Définir l'orientation d'arrivée**.
3. Une boîte de dialogue modale s'ouvre avec le titre **Utiliser cette direction** :
   - Elle charge et affiche le panorama 360° de la scène de destination.
   - *(Si le panorama de la scène cible n'a pas terminé son traitement, l'alerte rouge « Le panorama de la scène cible n'est pas prêt. » est affichée).*
4. Dans cette fenêtre, faites pivoter le panorama 360° jusqu'à aligner la vue dans la direction précise où le regard du visiteur doit se porter lorsqu'il arrive dans cette nouvelle scène.
5. Cliquez sur le bouton **Utiliser cette direction** situé en bas à droite de la fenêtre. (Pour annuler sans enregistrer, cliquez sur le bouton **Fermer** ou sur la croix).
6. Le réglage est enregistré sur le hotspot et le message de confirmation **Orientation d'arrivée enregistrée** s'affiche.
7. Lors de la consultation, le lecteur 360 appliquera automatiquement cet angle d'arrivée lors de la transition.

### Modifier ou supprimer un hotspot existant
Depuis l'éditeur 360 :
- Pour modifier les paramètres textuels, l'icône ou la cible d'un point :
  1. Cliquez sur le hotspot sur le panorama pour le sélectionner.
  2. Dans le volet latéral, cliquez sur le bouton **Modifier**.
  3. Le formulaire s'ouvre avec le titre **Modifier le hotspot** pré-rempli avec les données existantes.
  4. Effectuez vos corrections et cliquez sur **Enregistrer** (ou sur **Annuler** pour revenir sans modifier).
- Pour supprimer définitivement un point :
  1. Sélectionnez le hotspot sur le panorama.
  2. Cliquez sur le bouton rouge **Supprimer**.
  3. Une boîte de dialogue de confirmation demande : « Supprimer ce hotspot ? ».
  4. Cliquez sur **OK** pour confirmer la suppression définitive.

### Tester et prévisualiser la visite
Le back-office intègre un mode d'aperçu fidèle permettant de vérifier l'expérience immersive en conditions réelles avant toute publication :

- **Lancer l'aperçu** :
  - Depuis la page de détail d'une visite (`/tours/<id>`), cliquez sur le bouton **Tester la visite** situé en haut à droite dans l'en-tête de la page.
  - Le système contacte l'API pour générer un jeton temporaire d'aperçu sécurisé (`previewToken`), puis ouvre automatiquement la visite dans un nouvel onglet du navigateur via le visualiseur public (sur l'URL `/v/preview/<token>`).
  - Si votre navigateur bloque l'ouverture automatique des fenêtres contextuelles (pop-ups), un lien textuel de secours intitulé **Ouvrir l'aperçu** apparaît immédiatement à côté du bouton pour vous permettre d'ouvrir l'onglet d'un simple clic.
- **Comportement en mode aperçu** :
  - En haut du visualiseur, un badge semi-transparent rappelle la mention **Aperçu – visite non publiée**.
  - L'aperçu permet de tester l'ensemble du parcours :
    - Déclenchement de la scène de départ avec son cadrage initial.
    - Franchissement des hotspots de navigation et vérification des orientations d'arrivée.
    - Consultation des panneaux d'information, des galeries d'images et des liens externes.
    - Diffusion des narrations vocales et des sons d'ambiance.
    - Contrôle du confort visuel en mode plein écran.

### Carte des liens (visualisation du graphe de navigation)
Dans la page **Détails de la visite** (`/tours/<id>`), la section **Carte des liens** propose une analyse visuelle automatisée de la structure de votre visite virtuelle :

- **Représentation graphique (XYFlow / React Flow)** :
  - Le graphe schématise l'ensemble des scènes sous forme de blocs rectangulaires disposés de manière ordonnée.
  - La scène de départ est mise en évidence avec la mention **Départ :** précédant son titre.
  - Les liaisons de navigation internes (hotspots reliant deux scènes de la même visite) sont représentées par des flèches pleines indiquant le sens du déplacement.
  - Les liaisons vers des visites externes (liens inter-visites) sont représentées avec des bordures et traits en pointillés pour les distinguer immédiatement.
  - Des contrôles de navigation en bas à gauche du graphe permettent de zoomer, dézoomer, verrouiller ou adapter la vue à l'écran.
- **Détection des anomalies et scènes inaccessibles (orphelines)** :
  - Le système calcule en temps réel le graphe de connectivité depuis la scène de départ :
    - Si toutes les scènes peuvent être atteintes par au moins un chemin de navigation depuis l'entrée, la mention **Toutes les scènes sont accessibles.** s'affiche.
    - Si une ou plusieurs scènes ne sont reliées par aucun lien (ou constituent une boucle isolée inatteignable depuis le départ), ces nœuds s'affichent avec une bordure rouge d'alerte dans le graphe, et un encadré rouge détaille la liste sous le titre : **Scènes inaccessibles depuis la scène de départ :**.
- **Actualisation du graphe** :
  - Cliquez sur le bouton **Actualiser** en haut à droite de la carte des liens pour recalculer et redessiner immédiatement le graphe après avoir ajouté ou déplacé des hotspots.
  - Si la visite ne compte encore aucune scène, le message informatif **Aucune scène dans cette visite.** est affiché.

### Gestion tabulaire des points d'intérêt (vue avancée)
Pour les éditeurs souhaitant un inventaire synthétique ou une relecture exhaustive de tous les points d'une scène sans passer par la sphère 360°, une vue sous forme de tableau est accessible :

- Accessible via le chemin de navigation ou à l'adresse `/tours/<tourId>/scenes/<sceneId>/hotspots`, la page présente le titre **Hotspots** (ou **Hotspots de la scène**) et le fil d'Ariane complet (**Visites** > *[Nom de la visite]* > *[Nom de la scène]* > **Hotspots**).
- Le tableau regroupe tous les points d'intérêt configurés avec les colonnes suivantes :
  - **Type** : badge indiquant le type (**Lien vers une scène**, **Lien vers une visite**, **Information**, **Média**, **Lien externe**).
  - **Libellé** : titre textuel du hotspot.
  - **Cible** : nom de la scène de destination pour un lien interne, nom de la visite pour un lien distant, ou adresse URL cliquable pour un lien externe.
  - **Icône** : pictogramme associé (**Flèche**, **Info**, **Photo**, **Lecture**, **Portail**).
  - **Actions** :
    - Bouton **Modifier** : ouvre le formulaire d'édition détaillé de ce hotspot (`/tours/<tourId>/scenes/<sceneId>/hotspots/<id>`).
    - Bouton **Supprimer** : supprime le hotspot après demande de confirmation : « Êtes-vous sûr de vouloir supprimer ce hotspot ? ».
- Les boutons d'en-tête permettent de revenir directement à l'édition de la scène (**Retour à la scène**) ou d'ouvrir le formulaire manuel d'ajout (**Ajouter un hotspot**).

