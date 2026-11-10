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
3. Dans le champ **Code à 6 chiffres**, saisissez le code numérique temporaire visible dans votre application. Ce code à 6 chiffres est renouvelé toutes les 30 secondes.
4. Cliquez sur le bouton **Vérifier**.

En cas d'anomalie :
- Si les 6 chiffres sont erronés ou si le code a expiré entre-temps, le message rouge **Code invalide** s'affiche.
- Si une erreur réseau intervient lors de la validation, le message **La demande a échoué. Réessayez.** s'affiche.

Dès la validation du code, votre session est établie et vous accédez immédiatement à l'accueil du back-office.

---

## Médiathèque et import de panoramas

### Rôle et présentation de la médiathèque
La **Médiathèque** centralise l'ensemble des ressources multimédias nécessaires à la composition des visites virtuelles (photographies panoramiques 360°, images d'illustration et fichiers sonores).

Pour accéder à la médiathèque :
- Dans la barre latérale de navigation du back-office, cliquez sur le menu **Médias**.
- L'écran affiche l'en-tête **Médiathèque** accompagné du sous-titre **Gérez les images, panoramas et sons.**.

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
4. Pour chaque fichier, une ligne de progression affiche le nom du fichier, le pourcentage d'avancement du téléversement et la mention **En cours**.
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
    - Si le média est actuellement utilisé par une scène, un point d'intérêt ou comme vignette de visite, la suppression est bloquée et le système affiche : **Ce média est utilisé par une scène ou un point d'intérêt.**.
    - Pour pouvoir supprimer ce média, il est nécessaire de le retirer préalablement des scènes ou visites qui y font référence.

Au-delà de 20 éléments dans la liste, une pagination s'affiche au bas du tableau avec les boutons **Précédent** et **Suivant** pour parcourir les différentes pages.

### Nettoyer la médiathèque
Pour supprimer en masse les fichiers qui ne sont plus exploités dans aucune visite :
1. Cliquez sur le bouton **Nettoyer la médiathèque** situé en haut à droite de la page.
2. Le système analyse les médias non utilisés :
   - Si aucun média orphelin n'est trouvé, une boîte de dialogue avec le titre **Information** affiche le message : **La médiathèque est déjà propre**.
   - Si des médias orphelins sont identifiés, une fenêtre de **Confirmation** s'affiche en indiquant le nombre de médias concernés et le volume total en mégaoctets qui sera supprimé.
3. Cliquez sur **Confirmer** pour procéder à la suppression définitive, ou sur **Annuler** pour abandonner l'opération.
4. Une notification avec le titre **Succès** confirme le nombre de médias effectivement supprimés.

### Sélectionner un média dans l'éditeur de visite ou de scène
Lors de l'édition d'une visite (choix de la vignette) ou d'une scène (choix du panorama 360°) :
- Cliquez sur le champ de sélection pour ouvrir la boîte de dialogue **Sélectionner un média**.
- Deux onglets sont proposés :
  - **Médiathèque** : permet de choisir parmi les médias déjà importés et prêts. Vous pouvez utiliser le champ **Rechercher par nom...** pour filtrer rapidement vos fichiers.
  - **Envoyer depuis mon ordinateur** : permet de téléverser directement un nouveau fichier depuis votre ordinateur sans devoir quitter le formulaire d'édition.
