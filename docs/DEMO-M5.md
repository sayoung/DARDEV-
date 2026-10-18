# Démo M5 (Démo 2) — Hôtels & Kiosque

Ce document décrit la procédure opérationnelle pour exécuter la **Démo 2** du jalon **M5** : enrôlement d'un kiosque de test, consultation d'une visite virtuelle, fonctionnement autonome avec réseau coupé (hors-ligne), mode veille et déverrouillage technique par geste caché et code PIN.

---

## 1. Prérequis

1. **Services d'infrastructure** : PostgreSQL, Redis, MinIO et Mailpit doivent être joignables sur `localhost` via le tunnel SSH ouvert par le porteur (ports `5432`, `6379`, `9000/9001`, `1025/8025`).
   > **Rappel impératif** : Ne **jamais** lancer `docker`, `docker compose` ni Docker Desktop sur le poste de développement.
2. **Base de données à jour** : Les migrations et le seed doivent être appliqués :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** :
   - Fichier `.env` présent à la racine (défini à partir de `.env.example`).
   - L'application kiosque utilise la variable `VITE_API_URL` (définie dans `apps/kiosk/.env` ou `.env` racine, valeur par défaut résolue : `http://localhost:3000`).
4. **Visite de démonstration** : Le catalogue contient au moins une visite au statut `PUBLISHED` (par exemple la visite des Oudayas à Rabat issue du seed ou d'un import).

---

## 2. Démarrage des applications

Dans des terminaux séparés (ou via `pnpm dev`) :

```powershell
# 1. API NestJS (écoute sur http://localhost:3000)
pnpm --filter @xplor/api dev

# 2. Back-office Admin React (écoute sur http://localhost:5173)
pnpm --filter @xplor/admin dev

# 3. Application Kiosque PWA (écoute sur http://localhost:5175)
pnpm --filter @xplor/kiosk dev
```

---

## 3. Scénario de la démonstration

### Étape 1 : Préparation de l'hôtel et de sa sélection (Back-office)

1. Ouvrez le back-office dans le navigateur : `http://localhost:5173`.
2. Connectez-vous avec le compte administrateur :
   - **E-mail** : `admin@xplor.local`
   - **Mot de passe** : `xplor-seed-dev-2026`
3. Dans la barre latérale de navigation, cliquez sur **Hôtels** (route `/hotels`).
4. Dans le tableau, repérez l'hôtel de démonstration (**Hôtel Démonstration Rabat**, issu du seed ou créé via `POST /api/v1/admin/hotels`).
5. Cliquez sur le lien **Sélection** (route `/hotels/:id/selection`).
6. Sur la page de sélection :
   - Dans la section **Catalogue des visites**, repérez une visite publiée (ex. « Kasbah des Oudayas ») et cliquez sur le bouton **Ajouter**.
   - Dans la liste **Visites sélectionnées**, activez le bouton radio **Mise en avant** sur cette visite.
   - Cochez la case **Mode veille** pour intégrer cette visite dans la boucle d'attract.
   - Si plusieurs visites sont présentes, ajustez leur ordre d'affichage à l'aide des boutons **Monter** et **Descendre**.
   - Cliquez sur **Enregistrer** : le message « Sélection enregistrée. » confirme la mise à jour et la version de la sélection s'incrémente.

### Étape 2 : Création du kiosque et copie du code d'enrôlement (Back-office)

1. Dans la barre latérale, cliquez sur **Kiosques** (route `/kiosks`).
2. Cliquez sur le bouton **Nouveau kiosque** en haut à droite.
3. Renseignez le formulaire de la boîte de dialogue :
   - **Nom du kiosque** (`kiosk-label`) : `Kiosque Hall`
   - **Hôtel** (`kiosk-hotel`) : sélectionnez `Hôtel Démonstration Rabat`
   - **Type d'appareil** (`kiosk-device-type`) : `Écran tactile` (`TOUCH_SCREEN`)
   - **Délai avant le mode veille (secondes)** (`kiosk-idle-timeout`) : saisissez `15` (valeur courte recommandée pour la démo, afin d'observer la veille rapidement).
4. Cliquez sur **Créer le kiosque**.
5. La boîte de dialogue affiche immédiatement le **Code d'enrôlement** généré (8 caractères en police monospace, ex. `A1B2C3D4`).
6. Copiez ce code à 8 caractères et fermez la boîte de dialogue.
7. Dans le tableau des kiosques, observez que le kiosque apparaît avec l'état **En attente** (`PENDING`).

### Étape 3 : Enrôlement du kiosque (`apps/kiosk`)

1. Dans un nouvel onglet ou une fenêtre privée de votre navigateur, ouvrez l'application kiosque : `http://localhost:5175`.
2. Au premier lancement (aucun identifiant local), l'écran initial **ENROLL** s'affiche :
   - Titre : « Enrôlement du kiosque »
   - Champ de saisie : `kiosk-enroll-code` (« Code d'enrôlement »).
3. Saisissez le code d'enrôlement à 8 caractères obtenu à l'étape 2 (les lettres sont automatiquement converties en majuscules).
4. Cliquez sur le bouton **Enrôler le kiosque** (`[data-testid="kiosk-enroll-submit"]`).
5. **Comportement attendu** :
   - L'application appelle l'endpoint `POST /api/v1/kiosk/enroll`.
   - Le jeton d'appareil est stocké en local (`xplor.kiosk.credentials`).
   - Le manifeste du kiosque est téléchargé et persisté dans le stockage (`xplor.kiosk.manifest.v1`).
   - Les boucles d'arrière-plan démarrent (heartbeat toutes les 5 min, vérification de manifeste toutes les 15 min).
   - Les médias de la visite sélectionnée sont téléchargés en arrière-plan et stockés dans le cache hors-ligne (`CacheStorage` sous la clé `tour-<id>`).

### Étape 4 : Consultation et lecture de la visite (en ligne)

1. L'application bascule automatiquement sur l'écran d'accueil **HOME** (`.kiosk-home`) :
   - En-tête : nom de l'hôtel (avec l'attribut `data-logo`) et boutons de sélection de langue (Français, Arabe, Anglais).
   - Section **À la une** : carte de la visite mise en avant avec le bouton **Explorer la visite** (`data-testid="featured-tour-button"`).
   - Filtres par catégories et grille de visites (« Nos visites virtuelles »).
2. Cliquez sur **Explorer la visite** :
   - L'écran passe à **TOUR** (`.kiosk-tour-view`).
   - La visionneuse Photo Sphere Viewer se monte dans le conteneur `[data-testid="kiosk-tour-viewer"]`.
   - Naviguez dans le panorama 360° à la souris ou au doigt (glisser pour faire pivoter la vue).
3. Cliquez sur le bouton **Retour** (`[data-testid="kiosk-tour-back-btn"]`) ou pressez la touche **Échap** :
   - La visionneuse est proprement détruite.
   - L'écran revient à l'accueil **HOME**.

### Étape 5 : Fonctionnement réseau coupé (Offline)

1. Ouvrez les outils de développement du navigateur (`F12` ou Ctrl+Maj+I).
2. Ouvrez l'onglet **Réseau** (Network).
3. Dans la barre d'outils réseau, passez le profil de limitation (Throttling) de *No throttling* à **Hors ligne** (Offline).
4. Rechargez la page du kiosque (`F5` ou Ctrl+R).
5. **Comportement attendu (preuve du fonctionnement hors-ligne)** :
   - Le Service Worker (`public/sw.js`) sert immédiatement le shell applicatif (`index.html`, bundles JS et CSS).
   - Le bootstrap restaure les identifiants et le manifeste depuis le stockage local sans bloquer sur l'échec réseau.
   - L'écran d'accueil **HOME** s'affiche immédiatement avec le nom de l'hôtel et la sélection de visites.
   - Cliquez sur **Explorer la visite** : la visite 360° se lance et s'affiche sans accroc à partir des tuiles et du graphe en cache (`CacheStorage tour-<id>`).
   - Dans l'onglet Réseau des DevTools, toutes les requêtes directes échouent ou sont servies depuis le Service Worker / cache : aucun appel réseau externe n'aboutit.
6. Cliquez sur le bouton **Retour** pour regagner l'écran **HOME**.

### Étape 6 : Mode veille (Attract) et réveil

1. Sans toucher à la souris, au clavier ni à l'écran, patientez pendant la durée d'inactivité configurée (15 secondes).
2. **Comportement attendu** :
   - Le contrôleur d'inactivité déclenche l'action `IDLE`.
   - L'écran bascule en plein écran vers le mode veille **ATTRACT** (`.kiosk-screen-attract`).
   - L'arrière-plan charge l'aperçu de la visite configurée en mode veille.
   - Le message accessible « Touchez l'écran pour explorer » s'affiche au centre.
3. Touchez l'écran, cliquez n'importe où ou pressez la barre d'espace :
   - L'action `WAKE` est déclenchée.
   - Le mode veille se ferme et l'écran d'accueil **HOME** réapparaît instantanément.

### Étape 7 : Geste caché et déverrouillage PIN (Maintenance)

1. Sur l'écran d'accueil **HOME**, repérez le nom de l'hôtel dans l'en-tête (titre porteur de l'attribut `data-logo`).
2. Effectuez **5 clics (ou appuis tactiles) consécutifs en moins de 3 secondes** sur ce titre.
3. L'écran de maintenance et de saisie du PIN s'ouvre (**MAINTENANCE_PIN** / `.kiosk-screen-maintenance`) :
   - Titre : « Maintenance ».
   - Sous-titre : « Saisissez le code PIN de l'hôtel pour déverrouiller l'écran technique. ».
   - Champ de saisie masqué (`#kiosk-pin-input`) et clavier numérique virtuel tactile (touches `0` à `9`, `Effacer`, `Valider`).
4. Saisissez le code PIN de l'hôtel (au moins 4 chiffres) :
   - *En ligne* : le code est validé via l'API (`POST /api/v1/kiosk/maintenance/verify-pin`) et son hash SHA-256 salé est mis en cache localement (`xplor.kiosk.pinCache`, décision D-127).
   - *Hors-ligne* : si le code a été vérifié une fois en ligne au préalable, la vérification bascule de façon transparente sur le cache local.
5. Cliquez sur **Valider** :
   - L'application bascule sur l'écran d'état technique **MAINTENANCE** (`.kiosk-screen-maintenance-status`).
   - Vérifiez les informations présentées :
     - **Version de l'application**
     - **Version du manifeste** (ex. `1.0.0`)
     - **Dernière synchronisation** (date et heure)
     - **État de la synchronisation** (badge « Synchronisé »)
   - Observez les actions disponibles :
     - **Forcer la synchronisation** : déclenche une resynchronisation immédiate.
     - **Réenrôler** : efface les identifiants locaux et le cache pour réafficher l'écran d'enrôlement (protégé par confirmation).
     - **Fermer** : referme l'écran technique et retourne à l'écran d'accueil **HOME** (également accessible via la touche `Échap`).

---

## 4. Points de contrôle et critères de validation (DoD M5)

| # | Point de contrôle | Résultat attendu |
|---|---|---|
| 1 | **Création & sélection** | L'hôtel a une sélection active avec au moins une visite mise en avant et affectée au mode veille. |
| 2 | **Enrôlement F-52** | Le code à 8 caractères généré par l'admin permet d'enrôler le kiosque sur `http://localhost:5175`. |
| 3 | **Lecture de visite F-61** | La visite 360° s'ouvre, se contrôle à 360° et permet un retour propre vers l'accueil. |
| 4 | **Autonomie hors-ligne F-62** | Réseau coupé (DevTools Offline), le rechargement de la page affiche l'accueil et la visite se lit depuis le cache. |
| 5 | **Mode veille F-63** | Inactivité de 15 s → passage en mode veille avec invitation « Touchez l'écran pour explorer », réveil au premier contact. |
| 6 | **Geste caché & PIN F-67** | 5 appuis rapides sur l'en-tête ouvrent la saisie du PIN ; après déverrouillage, l'écran technique affiche le statut et les actions. |

---

## 5. Limites et hypothèses admises

- **Langues ar et en (D-82)** : Les traductions en arabe et en anglais ainsi que les contrôles RTL fins sont suspendus jusqu'au jalon M8. La démonstration s'exécute en français.
- **Cache local du PIN hors-ligne (D-127)** : Le déverrouillage PIN hors-ligne nécessite qu'au moins une validation en ligne du PIN ait été réalisée sur l'appareil avant la coupure pour que le hash salé SHA-256 soit enregistré dans le stockage local.
- **Taille des visites dans le manifeste (D-121)** : La propriété `sizeBytes` du manifeste peut valoir `0` sans impacter le cache ni la lecture de la visite.
