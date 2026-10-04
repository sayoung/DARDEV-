# Démo M3 — Documentation

Ce document décrit la procédure pour tester le jalon M3.

## Prérequis

1. **Services de développement** : PostgreSQL, Redis, MinIO et Mailpit doivent être joignables par le tunnel SSH sur `localhost`. **Ne PAS lancer `docker` ni `docker compose`.**
2. **Base de données** : Appliquez les migrations et insérez les données de démonstration :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** : Assurez-vous que les fichiers `.env` sont configurés avec les variables suivantes (voir `.env.example`) :
   - `MEDIA_PUBLIC_URL=http://localhost:9000/xplor`
   - `PUBLIC_WEB_URL=http://localhost:5174`
   - `VITE_PUBLIC_WEB_URL=http://localhost:5174` (dans `apps/admin/.env` ou `.env` à la racine)

> **Limite / risque** : MinIO, Postgres et Redis tournent sur le VPS derrière un tunnel SSH et ne répondent que sur le `localhost` du poste de développement. Un mobile distant ne peut donc pas joindre MinIO via l'IP du poste sans redirection de port supplémentaire. Les panoramas ne se chargeront pas forcément sur mobile.
> *Astuce pour mobile (optionnelle et non garantie)* : Pour tester sur un téléphone connecté au même réseau, remplacez `localhost` par l'IP locale de votre poste (obtenue via la commande PowerShell `ipconfig`) dans `MEDIA_PUBLIC_URL`, `PUBLIC_WEB_URL` et `VITE_PUBLIC_WEB_URL`.

## Démarrage

Lancez tous les services en parallèle :

```powershell
pnpm dev
```

Les applications seront disponibles aux adresses suivantes :
- **API** : http://localhost:3000
- **Admin (Back-office)** : http://localhost:5173
- **Web (Plateforme publique)** : http://localhost:5174

## Scénario

### 1. Partage et QR code (Back-office)

Cette étape permet de vérifier la génération du QR code de partage pour une visite publiée. La condition d'affichage du QR code exige que la visite ait le statut `PUBLISHED` et que le partage soit actif.

1. Ouvrez l'application Admin (Back-office) à l'adresse http://localhost:5173.
2. Sur l'écran **Connexion**, connectez-vous avec un compte du seed :
   - E-mail : `admin@xplor.local`
   - Mot de passe : `xplor-seed-dev-2026`
3. Dans la liste des visites, ouvrez la visite de Rabat (**Kasbah des Oudayas**).
4. Défilez vers le panneau de publication. La visite est publiée et son partage est actif. Le slug du jeton de partage est `demo-rabat`.
5. Vérifiez qu'un encadré intitulé **QR code de la visite** s'affiche.
6. Cliquez sur le bouton **Télécharger le QR code** pour enregistrer le fichier au format SVG.

### 2. Consultation publique (Web)

Cette étape permet de consulter la visite de démonstration (Kasbah des Oudayas) en utilisant la route publique du lecteur (apps/web).

1. Le jeton de partage de la visite de Rabat est `demo-rabat` (défini dans le script de seed).
2. Le QR code généré à l'étape précédente correspond au lien : `<PUBLIC_WEB_URL>/v/demo-rabat`.
3. Le scan du QR code avec un mobile tente d'ouvrir cette URL.

> **Point d'attention** : Dans la branche courante, le fichier `apps/web/vite.config.ts` force la configuration `host: '127.0.0.1'` sur le port 5174. Le serveur de développement web n'est donc pas joignable depuis un appareil externe par défaut.

**Alternatives pour la démo :**

- **Démo sur le poste (recommandée)** : Ouvrez le lien http://localhost:5174/v/demo-rabat dans votre navigateur de bureau.
- **Démo sur un vrai mobile** : Lancez le front web séparément en forçant l'hôte via la ligne de commande (cette option prime sur le fichier de configuration) :

```powershell
# Obtenir l'IP de votre poste
ipconfig

# Lancer l'application web pour qu'elle écoute sur toutes les interfaces
pnpm --filter web dev --host 0.0.0.0
```

> **Risque MinIO / tunnel SSH** : Même si l'application web s'ouvre sur le mobile, les médias (panoramas) peuvent ne pas se charger. En effet, MinIO répondant sur `localhost:9000` via le tunnel SSH du poste développeur, le mobile ne pourra pas résoudre cette adresse sans une redirection de port additionnelle.

### 3. Navigation et interaction (Web)

1. Parcourez la scène principale avec la souris ou l'écran tactile (glisser pour tourner).
2. Utilisez les boutons **Scène précédente** / **Scène suivante** (icônes ❮ ❯ de la barre de contrôles) ou les miniatures de la galerie pour changer de scène.
3. Ouvrez un hotspot de type **INFO** pour lire son contenu.
4. Ouvrez un hotspot de type **MÉDIA** pour visionner son image ou vidéo associée.
5. Cliquez sur un hotspot **Portail** (lien vers une autre visite, type TOUR_LINK).
6. Le lecteur affiche une boîte de dialogue **"Aller vers : [Titre]"** avec les boutons **Y aller** et **Annuler**.
7. Cliquez sur **Y aller**. La nouvelle visite se charge.
8. Cliquez sur le bouton **Retour** (icône ↩, dans la barre de contrôles en bas au centre ; visible seulement après avoir suivi un portail) pour revenir à la visite précédente.
9. Lancez la narration audio via le bouton **Lecture** (icône ▶, indépendant de la barre de contrôles) dans l'interface du lecteur. Vérifiez que le sous-titre correspondant s'affiche à l'écran.
10. Activez le bouton **Gyroscope** (icône 🧭, dans la barre de contrôles, visible seulement si supporté) pour regarder autour de vous en bougeant l'appareil.
11. Cliquez sur le bouton **Infos pratiques** (icône ℹ, dans la barre de contrôles) pour afficher le panneau latéral contenant le résumé, la description et les informations pratiques.
12. Dans ce même panneau, cliquez sur le lien **Voir sur la carte**.
13. Changez la langue de l'interface en utilisant le sélecteur **Langue** (les traductions incomplètes font partie des limites admises).

### 4. Aperçu Open Graph (Partage social)

1. Pour vérifier comment les réseaux sociaux voient le lien partagé, vous pouvez interroger la route publique correspondante.
2. Ouvrez une invite PowerShell et exécutez l'une des commandes suivantes :
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3000/api/v1/public/share/demo-rabat
   ```
   *ou*
   ```powershell
   curl.exe http://localhost:3000/api/v1/public/share/demo-rabat
   ```
3. Dans la réponse, vérifiez la présence des balises `<meta>` Open Graph dans le `<head>` :
   - `<meta property="og:title" content="...">`
   - `<meta property="og:description" content="...">`
   - `<meta property="og:image" content="...">`
   - `<meta property="og:url" content="...">`
   - `<meta property="og:type" content="website">`

### 5. Régénération du lien de partage (Back-office)

1. Retournez dans le back-office sur la fiche de la visite de Rabat.
2. Dans le panneau de publication, cliquez sur le bouton **Régénérer le lien de partage**.
3. Confirmez l'action dans la boîte de dialogue (**"Les anciens liens et QR codes ne fonctionneront plus. Voulez-vous continuer ?"**).
4. Le jeton de partage change dans l'interface et un nouveau QR code est généré.
5. Rechargez l'ancienne URL (`http://localhost:5174/v/demo-rabat`) dans le navigateur, ou essayez d'y accéder via l'API.
6. L'API renvoie un code d'erreur HTTP **404 Not Found**.
7. L'application web intercepte cette erreur et affiche le message : **"Cette visite n'existe pas ou n'est plus partagée."**

## Limites

- L'API kiosque (API-10) et le QR code de fin de visite sur borne sont reportés à une étape ultérieure (décision **D-104**).
- Les traductions complètes en arabe et anglais, ainsi que la vérification détaillée de l'affichage de droite à gauche (RTL), sont suspendues temporairement (décision **D-82**).

## Résultat attendu

À la fin de la démonstration, le présentateur aura pu constater :
- L'accès à la visite publique web via son jeton de partage, et le fonctionnement des contrôles de base (galerie, changement de scène, panorama).
- Le comportement correct des hotspots (Info, Média) et des portails inter-visites avec boîte de dialogue ("Aller vers : ...", "Y aller") et option de Retour.
- Le fonctionnement de la narration audio avec sous-titres, et du gyroscope.
- L'affichage opérationnel du panneau "Infos pratiques" et de son lien externe vers la carte.
- Le changement interactif de langue dans l'application web.
- La bonne structuration HTML des balises `og:*` par l'API pour les réseaux sociaux.
- L'invalidation réussie des anciens liens et QR codes (retour HTTP 404 / "Cette visite n'existe pas ou n'est plus partagée.") lors de la régénération du jeton.
