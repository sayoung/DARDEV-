# Tests de performance Xplor (k6)

Ce répertoire contient les scénarios de test de charge réalisés avec [k6](https://k6.io/) pour valider les exigences non fonctionnelles de performance (**NF-03** du cahier des charges).

> [!CAUTION]
> **Interdiction formelle de lancer ces tests sur la production** (`api.xplor.ma`, `admin.xplor.ma`, `v.xplor.ma` ou tout autre domaine de production) sans accord explicite et préalable du porteur du projet. Ces tirs génèrent un trafic soutenu qui peut saturer les ressources, déclencher le rate limiting applicatif (`ThrottlerGuard`) ou dégrader le service pour les utilisateurs réels. Les tests doivent être exécutés uniquement sur une instance locale ou un environnement de test dédié.

---

## 1. Installation de k6

k6 est un outil autonome écrit en Go. **Ne pas l'installer via npm** (les paquets npm portant ce nom sont obsolètes ou non officiels).

Installez le binaire officiel selon votre système d'exploitation :

### Windows
- Via `winget` (recommandé) :
  ```powershell
  winget install -e --id Grafana.k6
  ```
- Via `choco` :
  ```powershell
  choco install k6
  ```
- Ou téléchargez le binaire précompilé (.msi ou .zip) depuis la page [GitHub Releases de k6](https://github.com/grafana/k6/releases).

### macOS
- Via Homebrew :
  ```bash
  brew install k6
  ```

### Linux (Ubuntu / Debian)
- Via le dépôt officiel Grafana :
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D34EE14C
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update
  sudo apt-get install k6
  ```
- Ou téléchargez le binaire tar.gz officiel depuis les [Releases GitHub](https://github.com/grafana/k6/releases).

Vérifiez l'installation avec :
```bash
k6 version
```

---

## 2. Exécution du script de test du manifeste public

Le script `perf/k6/manifest.js` teste le téléchargement du graphe / manifeste public d'une visite virtuelle (`GET /api/v1/public/tours/:shareToken`, défini dans `apps/api/src/viewer/public-tours.controller.ts`).

### Paramètres (variables d'environnement)
- `BASE_URL` (optionnel) : URL de base de l'API. Par défaut : `http://localhost:3000`.
- `SHARE_TOKEN` (**obligatoire**) : Jeton public d'une visite existante, active et publiée (`publicShare: true`, statut `PUBLISHED`). Le script s'arrête immédiatement si ce paramètre est manquant.

### Commande d'exécution

```bash
k6 run -e BASE_URL=… -e SHARE_TOKEN=… perf/k6/manifest.js
```

Exemple en local avec une visite de test :
```bash
k6 run -e BASE_URL=http://localhost:3000 -e SHARE_TOKEN=demo-visite-1 perf/k6/manifest.js
```

---

## 3. Scénario et seuils de performance NF-03

### Profil de montée en charge
Le scénario simule une montée en charge progressive représentative :
- **Montée en charge (ramp-up)** : passage progressif de 0 à 20 utilisateurs virtuels (VU) pendant 30 secondes.
- **Plateau (steady state)** : maintien de 20 utilisateurs virtuels simultanés pendant 1 minute.

### Seuils d'acceptation (Thresholds)
Conformément à la spécification **NF-03 Performance** du cahier des charges (*« manifeste < 200 ms (P95) »*) :
- **`http_req_duration: ['p(95)<200']`** : 95 % des requêtes de manifeste public doivent répondre en moins de 200 ms.
- **`http_req_failed: ['rate<0.01']`** : le taux d'erreur HTTP doit être strictement inférieur à 1 % (soit au moins 99 % de réponses avec le statut 200 OK).

---

## 4. Insertion d'événements (NF-03)

Le script `perf/k6/events.js` teste l'ingestion massive d'événements statistiques par lots de 200 événements (`POST /api/v1/events`, défini dans `apps/api/src/events/events.controller.ts`), conformément au schéma partagé `eventsBatchSchema` (**NF-02**, sans donnée personnelle de voyageur).

> [!CAUTION]
> **Interdiction formelle de lancer ce script sur la production (`api.xplor.ma`)** :
> Contrairement au script de consultation du manifeste public (qui effectue uniquement des lectures), ce test réalise des écritures réelles et répétées en base de données PostgreSQL (insertion continue de lots de 200 événements statistiques et sessions associées).
> Lancer ce script sur la production (`api.xplor.ma`) insérerait de faux événements réels, polluerait de façon irréversible les statistiques de fréquentation et les métriques des visites des hôtels réels, tout en consommant inutilement du stockage et des ressources serveur. Ce script est strictement réservé aux environnements locaux ou de test dédiés.

### Paramètres (variables d'environnement)
- `BASE_URL` (optionnel) : URL de base de l'API. Par défaut : `http://localhost:3000`.
- `KIOSK_TOKEN` (**obligatoire**) : Jeton d'appareil d'un kiosque enrôlé. Le script s'arrête immédiatement si ce paramètre est manquant.
  L'en-tête `Authorization: Bearer <KIOSK_TOKEN>` permet au guard `OptionalKioskTokenGuard` d'identifier le kiosque appelant (`request.kioskDevice`), évitant ainsi le rate limiting appliqué aux requêtes anonymes (`EVENTS_ANON_RATE_LIMIT_MAX = 60` requêtes par minute par IP).

### Commande d'exécution

```bash
k6 run -e BASE_URL=... -e KIOSK_TOKEN=... perf/k6/events.js
```

Exemple en local avec une instance de développement :
```bash
k6 run -e BASE_URL=http://localhost:3000 -e KIOSK_TOKEN=mon-jeton-kiosque-local perf/k6/events.js
```

### Obtention d'un jeton kiosque de test par enrôlement local

Pour obtenir un jeton kiosque de test valide sans compromettre de secret ni impacter la production, effectuez un enrôlement sur votre environnement local :

1. **Démarrer les services et les applications en local** :
   - Assurez-vous que les services d'infrastructure locaux (PostgreSQL, Redis sur le port `6379`) sont accessibles et que la base de données est initialisée (`pnpm db:migrate` et `pnpm db:seed`).
   - Démarrez l'API locale (`pnpm --filter @xplor/api dev`, port `3000`) et le back-office administrateur (`pnpm --filter @xplor/admin dev`, port `5173`).

2. **Créer un kiosque et générer un code d'enrôlement** :
   - Connectez-vous au back-office administrateur (`http://localhost:5173`) avec un compte administrateur local (ex. `admin@xplor.local`).
   - Accédez à la rubrique **Kiosques** (`/kiosks`).
   - Cliquez sur **Nouveau kiosque**, renseignez un libellé de test (ex. *Kiosque Test Perf*), sélectionnez un hôtel de démonstration et un type d'appareil (ex. *Écran tactile*).
   - À la création, l'API génère un **code d'enrôlement** temporaire à 8 caractères alphanumériques (ex. `A1B2C3D4`), valable 15 minutes (statut `PENDING`). Vous pouvez également générer un code à tout moment via l'action dédiée sur un kiosque en attente.

3. **Enrôler le kiosque pour obtenir le jeton Bearer** :
   Deux options sont disponibles pour effectuer l'enrôlement :
   - **Option A — Via l'application kiosque (`apps/kiosk`)** :
     Ouvrez l'application kiosque (`http://localhost:5175`), saisissez le code d'enrôlement à 8 caractères sur l'écran d'enrôlement et validez. Récupérez ensuite le jeton persisté dans le `localStorage` du navigateur :
     ```javascript
     JSON.parse(localStorage.getItem('xplor.kiosk.credentials')).token
     ```
   - **Option B — Directement via une requête HTTP (`curl`)** :
     Appelez l'endpoint public d'enrôlement sur votre API locale :
     ```bash
     curl -X POST http://localhost:3000/api/v1/kiosk/enroll \
       -H "Content-Type: application/json" \
       -d '{"code":"<VOTRE_CODE_8_CARACTERES>","deviceInfo":{"userAgent":"k6-perf-test"}}'
     ```
     La réponse HTTP 200 retourne l'identifiant du kiosque et le jeton d'authentification :
     ```json
     {
       "kioskId": "<uuid-du-kiosque>",
       "token": "<jeton_kiosque_obtenu>"
     }
     ```

4. **Utiliser le jeton retourné dans k6** :
   Fournissez la valeur du jeton (`token`) à la variable d'environnement `KIOSK_TOKEN`. Ce jeton n'est transmis qu'une seule fois lors de l'enrôlement (l'API n'enregistre en base que son empreinte SHA-256).

### Profil de charge et seuils de performance NF-03

#### Profil de charge
- **Utilisateurs virtuels (VU)** : 5 VU simultanés (`vus: 5`).
- **Durée** : 1 minute (`duration: '1m'`).
- **Charge par requête** : chaque itération émet un lot complet de 200 événements statistiques (`POST /api/v1/events`).

#### Seuils d'acceptation (Thresholds)
Conformément à la spécification **NF-03 Performance** du cahier des charges (*« 200 événements < 100 ms » (p95)*) :
- **`http_req_duration: ['p(95)<100']`** : 95 % des requêtes d'ingestion de lots de 200 événements doivent répondre en moins de 100 ms (P95).
- **`http_req_failed: ['rate<0.01']`** : le taux d'erreur HTTP doit être strictement inférieur à 1 % (soit au moins 99 % de réponses avec le statut 200 OK).

---

## 5. Consultation des listes du back-office (NF-03)

Le script `perf/k6/admin-api.js` teste les performances des requêtes de consultation des listes du back-office administrateur, conformément à l'exigence **NF-03 Performance** du cahier des charges (*« Back-office : réponses API < 300 ms (P95) »*).

> [!CAUTION]
> **Interdiction formelle de lancer ce script sur la production (`api.xplor.ma` / `admin.xplor.ma`)** sans accord préalable du porteur. Ces tests doivent être exécutés exclusivement sur une instance locale ou un environnement de test dédié.

### Authentification unique (`setup()`) et gestion de session

L'API NestJS protège la route `POST /api/v1/auth/login` avec un limiteur de débit strict (`ThrottlerGuard` configuré à 5 requêtes par minute et par IP, voir `apps/api/src/auth/auth.controller.ts`).

Afin de respecter cette contrainte :
- La connexion n'est **jamais appelée dans la boucle des utilisateurs virtuels**.
- La phase `setup()` de k6 effectue **une seule connexion initiale** avec les identifiants fournis.
- Le cookie de session opaque (`xplor_sid`, défini dans `apps/api/src/auth/session-cookie.ts`) et le jeton CSRF associés sont propagés aux 10 utilisateurs virtuels.
- Chaque VU transmet le cookie `xplor_sid` lors de toutes ses requêtes de consultation.

### Endpoints testés à chaque itération (GET en lecture seule)

Chaque itération simule la consultation des trois listes principales du back-office :
1. **Visites virtuelles** : `GET /api/v1/admin/tours` (défini dans `apps/api/src/catalog/tours.controller.ts`).
2. **Hôtels** : `GET /api/v1/admin/hotels` (défini dans `apps/api/src/hotels/hotels.controller.ts`).
3. **Kiosques** : `GET /api/v1/admin/kiosks` (défini dans `apps/api/src/kiosks/kiosks.controller.ts`).

### Paramètres (variables d'environnement)

- `BASE_URL` (optionnel) : URL de base de l'API. Par défaut : `http://localhost:3000`.
- `ADMIN_EMAIL` (**obligatoire**) : Adresse e-mail d'un compte administrateur ou gestionnaire (ex. `admin@xplor.local`). Arrêt immédiat si manquante.
- `ADMIN_PASSWORD` (**obligatoire**) : Mot de passe du compte. Arrêt immédiat si manquant.
*(Aucune valeur par défaut n'est inscrite dans le script afin d'éviter la fuite d'identifiants).*

### Commande d'exécution

```bash
k6 run -e BASE_URL=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... perf/k6/admin-api.js
```

Exemple en local avec le compte administrateur du seed (`pnpm db:seed` initialise le compte avec la valeur de `SEED_DEFAULT_PASSWORD` définie dans `.env`, par exemple `xplor-seed-dev-2026`) :

```bash
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=admin@xplor.local -e ADMIN_PASSWORD=xplor-seed-dev-2026 perf/k6/admin-api.js
```

### Profil de charge et seuils de performance NF-03

#### Profil de charge
- **Utilisateurs virtuels (VU)** : 10 VU simultanés (`vus: 10`).
- **Durée** : 1 minute (`duration: '1m'`).
- **Comportement par VU** : à chaque itération, l'utilisateur virtuel envoie le cookie de session et effectue les trois requêtes `GET` en lecture seule sur les listes de visites, d'hôtels et de kiosques.

#### Seuils d'acceptation (Thresholds)
Conformément à la spécification **NF-03 Performance** du cahier des charges (*« Back-office : réponses API < 300 ms (P95) »*) :
- **`http_req_duration: ['p(95)<300']`** : 95 % des requêtes de consultation du back-office doivent répondre en moins de 300 ms (P95).
- **`http_req_failed: ['rate<0.01']`** : le taux d'erreur HTTP doit être strictement inférieur à 1 % (soit au moins 99 % de réponses avec le statut 200 OK).
