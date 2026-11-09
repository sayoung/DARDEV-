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
