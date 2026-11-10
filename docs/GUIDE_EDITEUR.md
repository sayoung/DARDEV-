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
