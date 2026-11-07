# Démo M7 — Statistiques

Ce document décrit la procédure détaillée pour exécuter et valider la démo du **Jalon M7 — Statistiques** (exigences F-80 à F-83, API-04 et API-29).

---

## Contexte et objectifs

Le jalon M7 valide la chaîne complète de mesure d'audience et de suivi d'activité de la plateforme Xplor :
1. **F-80 — Ingestion et agrégation** : Collecte d'événements par lots via `API-04`, table partitionnée `Event`, modèle d'agrégats `StatsDaily`, recalcul quotidien et rattrapage d'historique (`stats:backfill`).
2. **F-81 — Tableau de bord administrateur** : Consultation des indicateurs clés (sessions, durée moyenne, visites ouvertes, scènes vues, clics hotspots, entrées VR, scans QR), courbes temporelles journalière et horaire, classements top visites/scènes, ventilations par langue et par canal, avec filtres combinés.
3. **Contrôle d'accès et isolation multi-tenant** : Garantie stricte qu'un gestionnaire de l'hôtel A ne peut en aucun cas accéder aux données de l'hôtel B.
4. **F-82 — Export CSV** : Téléchargement des agrégats filtrés au format CSV (encodage UTF-8 avec BOM, délimiteur `;`, protection contre les injections de formules pour Excel).
5. **F-83 — Rapport mensuel hôtel** : Génération d'un rapport PDF A4 aux couleurs de la charte Xplor et script de prévisualisation sécurisé pour le développement (`report:preview`).

---

## Prérequis

1. **Services de développement** : PostgreSQL, Redis, MinIO et Mailpit tournent sur le VPS et sont joints via le tunnel SSH ouvert par le porteur sur `localhost` (ports 5432, 6379, 9000/9001, 1025/8025).
   > **RÈGLE IMPÉRATIVE** : **Ne JAMAIS lancer `docker`, `docker compose` ni Docker Desktop en local.**
2. **Base de données à jour** : Les migrations Prisma doivent être appliquées et le seed initial chargé :
   ```powershell
   pnpm db:migrate
   pnpm db:seed
   ```
3. **Variables d'environnement** : Vérifier que le fichier `.env` racine est configuré (voir `.env.example`).

---

## Étape 1 : Préparation des données de démonstration

La démo simule une semaine complète d'utilisation réaliste sur les visites publiées du seed.

### 1.1 Génération d'une semaine d'événements simulés
Dans un terminal PowerShell à la racine du projet :
```powershell
pnpm --filter @xplor/api stats:demo -- --confirm-dev
```
- **Action** : Insère 418 événements répartis sur 7 jours (84 sessions distinctes), couvrant les 3 canaux (`WEB`, `KIOSK`, `VR`), les 3 langues (`fr`, `ar`, `en`), et divers types d'interactions (`SESSION_START`, `TOUR_OPEN`, `SCENE_VIEW`, `HOTSPOT_CLICK`, `VR_ENTER`, `QR_SHOWN`, `SESSION_END`).
- **Sécurité** : L'option `--confirm-dev` est obligatoire pour empêcher toute écriture involontaire.

### 1.2 Calcul des agrégats quotidiens (StatsDaily)
Exécutez le script de rattrapage statistique du worker :
```powershell
pnpm --filter @xplor/worker stats:backfill -- --confirm-dev
```
- **Action** : Calcule et enregistre les agrégats journaliers pour les 7 derniers jours dans la table `StatsDaily`.
- **Propriété** : Le calcul est idempotent (peut être relancé sans doublonner les chiffres).
- **Option** : Par défaut sur 7 jours ; l'option `--days <1..92>` permet d'étendre la fenêtre si souhaité.

### 1.3 Contrôle automatique de cohérence
Vérifiez l'intégrité des statistiques générées via le script de vérification :
```powershell
pnpm --filter @xplor/api stats:verify
```
- **Action** : Script en lecture seule qui audite la base de données :
  - Détecte la présence des 84 sessions et 418 événements.
  - Vérifie la cohérence des totaux globaux et par canal (`WEB`, `KIOSK`, `VR`).
  - Vérifie la répartition linguistique (`fr`, `ar`, `en`).
  - Vérifie le rattachement aux hôtels et aux visites.
- **Résultat attendu** : Affichage d'un bilan vert confirmant la validité des statistiques.

---

## Étape 2 : Démarrage des applications

Démarrez les services de développement :
```powershell
pnpm dev
```
*(ou lancez séparément l'API `pnpm --filter @xplor/api dev` et le back-office `pnpm --filter @xplor/admin dev`)*

Points d'accès :
- **API NestJS** : http://localhost:3000
- **Back-office Admin** : http://localhost:5173

---

## Étape 3 : Exploration du Tableau de bord (F-81)

### 3.1 Connexion Administrateur
1. Ouvrez votre navigateur sur http://localhost:5173.
2. Connectez-vous avec le compte administrateur du seed :
   - **E-mail** : `admin@xplor.local`
   - **Mot de passe** : `xplor-seed-dev-2026`
3. Dans la barre latérale de navigation violette, cliquez sur **Statistiques**.

### 3.2 Vérification des indicateurs clés (cartes de synthèse)
Vérifiez que les cartes en haut de page affichent les métriques de la période :
- **Sessions** : nombre total de sessions uniques (ex. 84 sur 7 jours).
- **Durée moyenne** : durée moyenne d'une session en minutes.
- **Visites ouvertes** : nombre total d'ouvertures de visites (`TOUR_OPEN`).
- **Scènes vues** : nombre d'affichages de scènes 360° (`SCENE_VIEW`).
- **Clics sur les points** : interactions avec les hotspots (`HOTSPOT_CLICK`).
- **Entrées VR** : sessions ayant basculé en mode casque immersif (`VR_ENTER`).
- **Scans QR** : consultations web issues du scan d'un QR kiosque (`src=kiosk` / `QR_SHOWN`).

### 3.3 Vérification des graphiques et distributions
1. **Évolution journalière** : Observez la courbe SVG montrant l'évolution du nombre de sessions jour par jour. Les points de données disposent d'infobulles au survol et d'une alternative textuelle pour l'accessibilité.
2. **Activité par heure** : Observez l'histogramme SVG présentant la répartition des sessions sur les 24 heures de la journée.
3. **Top 10 des visites** : Liste classée des visites les plus consultées avec leur nombre d'ouvertures.
4. **Top 10 des scènes** : Liste classée des panoramas les plus vus.
5. **Répartition par langue** : Sessions ventilées entre Français (`fr`), Arabe (`ar`) et Anglais (`en`).
6. **Répartition par canal** : Sessions ventilées entre Web (`WEB`), Kiosque tactile (`KIOSK`) et Casque VR (`VR`).

### 3.4 Manipulation des filtres
Testez la réactivité du formulaire de filtres en haut de page :
1. **Filtre Période** : Modifiez les dates `Du` et `Au` pour sélectionner une sous-période (ex. les 3 derniers jours), puis cliquez sur **Appliquer**. Constatez la mise à jour immédiate des indicateurs et graphiques.
2. **Filtre Hôtel** : En tant qu'administrateur, le menu déroulant permet de choisir « Tous les hôtels » ou « Hôtel Démonstration Rabat ». Sélectionnez l'hôtel et appliquez.
3. **Filtre Visite** : Filtrez sur une visite précise (ex. Kasbah des Oudayas).
4. **Filtre Canal** : Sélectionnez le canal `VR`, appliquez, et constatez que seules les sessions VR sont prises en compte.
5. **Filtre Langue** : Sélectionnez la langue `العربية` ou `Français` et appliquez.

---

## Étape 4 : Contrôle d'accès et isolation multi-tenant (AccessPolicy)

Le cahier des charges et `AGENTS.md` imposent un cloisonnement strict : **un gestionnaire de l'hôtel A ne doit jamais voir les données de l'hôtel B**.

### 4.1 Connexion Gestionnaire d'hôtel
1. Déconnectez-vous via le menu utilisateur en haut à droite.
2. Connectez-vous avec le compte gestionnaire d'hôtel du seed :
   - **E-mail** : `manager@xplor.local`
   - **Mot de passe** : `xplor-seed-dev-2026`
   - **Rôle** : `HOTEL_MANAGER`, rattaché uniquement à « Hôtel Démonstration Rabat ».
3. Cliquez sur **Statistiques** dans le menu latéral.

### 4.2 Constat dans l'interface
- Les statistiques affichées sont automatiquement restreintes à l'établissement rattaché.
- Le gestionnaire n'a aucun accès aux statistiques globales des autres hôtels ni à un sélecteur permettant de consulter un autre établissement.

### 4.3 Validation de l'isolation au niveau de l'API
Pour prouver que la protection est étanche côté serveur :
1. Tenter d'interroger directement l'API avec un identifiant d'hôtel non rattaché (ex. UUID fictif ou d'un hôtel tiers) :
   ```powershell
   # Depuis un terminal avec un cookie de session valide de manager@xplor.local :
   # GET /api/v1/admin/stats?hotelId=00000000-0000-0000-0000-000000000999
   ```
2. **Résultat attendu** : L'API répond par un code d'erreur HTTP `404 Not Found` (ou `403 Forbidden`), interdisant formellement l'accès aux données hors de son périmètre d'affectation.

---

## Étape 5 : Export CSV et ouverture dans Excel (F-82)

1. Depuis la page **Statistiques** (en compte admin ou gestionnaire), cliquez sur le bouton **Exporter en CSV**.
2. Un fichier nommé `xplor-statistiques.csv` est téléchargé.
3. Ouvrez le fichier dans Microsoft Excel (ou LibreOffice Calc) :
   - **Encodage** : Vérifiez que les caractères accentués français et arabes s'affichent correctement dès l'ouverture, grâce au préfixe UTF-8 BOM (`\uFEFF`).
   - **Séparateur** : Vérifiez que les données se placent immédiatement dans les bonnes colonnes grâce au délimiteur point-virgule (`;`).
   - **Structure** : Le fichier comporte successivement la section des indicateurs globaux, l'évolution journalière, le classement des visites et le classement des scènes.
   - **Protection anti-injection** : Les valeurs textuelles débutant par des symboles de formule (`=`, `+`, `-`, `@`) sont préfixées par un guillemet simple `'` pour bloquer toute exécution de macro arbitraire dans Excel.

---

## Étape 6 : Prévisualisation du rapport mensuel PDF hôtel (F-83)

Le worker Xplor génère le 1er de chaque mois un bilan d'audience au format PDF pour chaque hôtel partenaire. Le script `report:preview` permet de tester cette génération en local sans envoyer de courriel.

### 6.1 Exécution de la commande de prévisualisation
Dans une invite de commande PowerShell :
```powershell
pnpm --filter @xplor/worker report:preview -- --confirm-dev --hotel 01990000-0000-7000-8000-000000000101
```
*(Variante par nom d'hôtel : `pnpm --filter @xplor/worker report:preview -- --confirm-dev --hotel "Hôtel Démonstration Rabat"`)*
*(Variante avec mois spécifique : `pnpm --filter @xplor/worker report:preview -- --confirm-dev --hotel 01990000-0000-7000-8000-000000000101 --month 2026-11`)*

### 6.2 Vérifications du document PDF produit
1. **Sortie console** : Le script indique le chemin absolu du fichier généré dans le répertoire temporaire système (`$env:TEMP`) ainsi que son poids en octets.
2. **Consultation du PDF** : Ouvrez le fichier dans un visualiseur PDF :
   - Mise en page A4 portrait soignée, respectant la charte graphique Xplor (bandeau violet `#6958A5`, textes contrastés, séparateurs gris clair).
   - En-tête mentionnant clairement le nom de l'hôtel (« Hôtel Démonstration Rabat ») et le mois d'activité analysé.
   - Grille d'indicateurs mensuels synthétiques (total des sessions, visites ouvertes, scènes vues, durée moyenne de consultation, scans QR).
   - Tableau du palmarès des visites les plus populaires de l'établissement.
   - Aucun envoi d'e-mail n'a été déclenché, garantissant une utilisation sans risque hors production.

---

## Synthèse des points de contrôle pour la recette

| # | Point de contrôle | Résultat attendu | Validé |
|---|---|---|:---:|
| 1 | Événements simulés (`stats:demo`) | 418 événements insérés pour 84 sessions sur 7 jours | [ ] |
| 2 | Agrégation quotidienne (`stats:backfill`) | Agrégats journaliers calculés dans `StatsDaily` de manière idempotente | [ ] |
| 3 | Contrôle d'intégrité (`stats:verify`) | Script en lecture seule validant la cohérence mathématique des sessions | [ ] |
| 4 | Tableau de bord admin (F-81) | 7 cartes de métriques, 2 graphiques SVG, 4 classements et filtres fonctionnels | [ ] |
| 5 | Isolation multi-tenant | Le gestionnaire de l'hôtel A ne voit aucune donnée de l'hôtel B (API 404/403) | [ ] |
| 6 | Export CSV (F-82) | Fichier UTF-8 BOM avec `;`, lisible nativement dans Excel, anti-injection | [ ] |
| 7 | Rapport mensuel PDF (F-83) | Script `report:preview` produisant un PDF A4 charte Xplor dans `$env:TEMP` | [ ] |
