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
