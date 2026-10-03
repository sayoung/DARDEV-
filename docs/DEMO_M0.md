# Démo M0 — Socle

Scénario pour le porteur du projet. Le parcours principal est local, sous Node 22 : environnement en quatre commandes, puis `pnpm dev`, puis connexion au back-office (cahier des charges, section 9). La variante « démo sans Docker local » (D-62) est le repli, en fin de document. La CI verte se constate sur GitHub ; elle reste une preuve complémentaire (run https://github.com/sayoung/DARDEV-/actions/runs/36580207347).

Préparer le poste comme dans `docs/INSTALL.md` : `nvm use 22`, puis les deux fichiers `.env` (racine du dépôt et `apps/api/.env`). Docker répond sur ce poste depuis le 29/09/2026 : suivre les sections 1 à 8.

Les libellés cités sont ceux du français. Le mot de passe des comptes seedés est la valeur de `SEED_DEFAULT_PASSWORD` dans `.env` (exemple de développement : `xplor-seed-dev-2026`).

## 1. Environnement

À la racine du dépôt, Node 22, dans cet ordre :

```bash
nvm use 22
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
```

Puis :

```bash
pnpm dev
```

`pnpm dev` lance l'API, le back-office, le web (port 5174), le kiosque (port 5175) et le worker. Cette démo n'utilise que l'API et le back-office.

Contrôle des services :

```bash
docker compose ps
```

`postgres`, `redis`, `minio` et `mailpit` sont `healthy`. `minio-init` s'est terminé avec le code 0.

`pnpm db:seed` écrit quatre utilisateurs actifs. L'hôtel, le kiosque et les visites restent au jalon M1.

## 2. Adresses attendues

| Quoi        | URL                                       | Attendu                                                                           |
| ----------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Back-office | http://localhost:5173                     | Page « Xplor », formulaire « Connexion »                                          |
| API         | http://localhost:3000                     | Processus Nest à l'écoute                                                         |
| Santé       | http://localhost:3000/api/health          | **200**, corps `{"status":"ok","checks":{"db":"ok","redis":"ok","storage":"ok"}}` |
| Mailpit     | http://localhost:8025                     | Interface web des courriels                                                       |
| OpenAPI     | http://localhost:3000/api/v1/openapi.json | JSON OpenAPI **3.1.0**, titre « Xplor API » (absent en production)                |

Un échec de sonde répond **503** et `"status":"error"`. Le cas de démo est le **200** avec les trois sondes à `ok`.

## 3. Connexion administrateur

1. Ouvrir http://localhost:5173.
2. Adresse `admin@xplor.local`, mot de passe `SEED_DEFAULT_PASSWORD`.
3. « Se connecter ».

La page d'accueil affiche le nom **Administrateur**, le rôle **Administrateur** et le bouton **Se déconnecter**.

## 4. Arabe et RTL

Le sélecteur est le groupe « Langue ». Cliquer **العربية**.

Dans les outils du navigateur, sur l'élément `<html>` :

- `lang` vaut `ar` ;
- `dir` vaut `rtl`.

Le rôle affiché devient **مسؤول**. Le nom **Administrateur** ne change pas : c'est le nom du compte, pas une chaîne traduite. La feuille de style aligne le contenu avec `text-align: start` et les marges logiques (`margin-inline`, `padding-inline`) : en RTL, le bloc part du côté droit.

La preuve RTL versionnée est [`docs/screenshots/login-ar.png`](screenshots/login-ar.png) : capture pleine page du formulaire de connexion ouvert avec `?lang=ar`. Le scénario Playwright `e2e/back-office.spec.ts` vérifie `lang="ar"` et `dir="rtl"` sur `<html>` avant d'enregistrer ce fichier.

Le porteur contrôle visuellement chaque écran en arabe : connexion, mot de passe oublié, définition du mot de passe, accueil.

Revenir au **Français** pour la suite (les libellés ci-dessous sont en français). Le choix est gardé dans `localStorage` sous la clé `xplor.lang`.

## 5. Mot de passe oublié

Ce parcours change le mot de passe de `admin@xplor.local`. Le noter : la suite qui invite un compte l'utilise. `pnpm db:seed` réécrit ensuite ce mot de passe avec `SEED_DEFAULT_PASSWORD` ; ne pas relancer le seed au milieu de la démo.

Choisir un mot de passe d'au moins 12 caractères, absent de la liste des mots de passe courants. Exemple : `Xplor-reset-demo-2026`.

1. **Se déconnecter**, puis **Mot de passe oublié**.
2. Adresse `admin@xplor.local`, **Envoyer le lien**.
3. Le texte affiché est toujours : « Si un compte correspond à cette adresse, un courriel vient d'être envoyé. »
4. Ouvrir http://localhost:8025. Le message a pour objet **Réinitialisation de votre mot de passe Xplor**.
5. Cliquer le lien. Il ouvre `http://localhost:5173/reset/<jeton>` (« Nouveau mot de passe »).
6. Saisir deux fois le nouveau mot de passe, **Enregistrer**.

La page revient à la connexion avec : « Votre mot de passe a été mis à jour. Vous pouvez vous connecter. » Se reconnecter avec `admin@xplor.local` et le **nouveau** mot de passe. L'ancien mot de passe de seed ne convient plus pour ce compte.

Le lien est valable 1 heure et ne sert qu'une fois.

## 6. Invitation

Le back-office n'a pas d'écran d'invitation (le CRUD utilisateurs est hors de ce jalon). L'invitation part par l'API. Dans PowerShell, appeler `curl.exe` : l'alias `curl` est une autre commande.

Remplacer `NOUVEAU_MOT_DE_PASSE_ADMIN` par le mot de passe choisi à l'étape 5. Le compte invité ne doit pas déjà exister (`editor@xplor.local` répondrait 409). Exemple d'adresse : `demo.invite@xplor.local`. Mot de passe d'acceptation, mêmes règles qu'au reset, exemple : `Xplor-invite-demo-2026`.

Connexion API (le corps JSON contient `csrfToken` ; le cookie `xplor_sid` est enregistré) :

```powershell
curl.exe -s -c "$env:TEMP\xplor-admin.txt" -H "Content-Type: application/json" --data-raw '{"email":"admin@xplor.local","password":"NOUVEAU_MOT_DE_PASSE_ADMIN"}' http://localhost:3000/api/v1/auth/login
```

Copier `csrfToken` de la réponse, puis :

```powershell
curl.exe -s -D - -b "$env:TEMP\xplor-admin.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: CSRF_TOKEN" --data-raw '{"email":"demo.invite@xplor.local","name":"Editeur invite","role":"EDITOR","uiLang":"fr"}' http://localhost:3000/api/v1/admin/users/invitations
```

Attendu : **201**, avec l'e-mail, le nom et le rôle `EDITOR`.

Dans Mailpit, objet **Invitation à rejoindre Xplor**. Cliquer le lien `http://localhost:5173/invite/<jeton>` (valable 48 heures).

1. « Définir votre mot de passe », deux fois le mot de passe d'acceptation, **Enregistrer**.
2. Message : « Votre mot de passe est défini. Vous pouvez vous connecter. »
3. Se connecter avec `demo.invite@xplor.local` et ce mot de passe.
4. L'accueil affiche **Editeur invite** et le rôle **Éditeur**.

## 7. Un éditeur ne peut pas inviter

`editor@xplor.local` est le compte seedé (rôle EDITOR). Ce n'est pas le compte créé à l'étape 6. Dans la commande, remplacer `SEED_DEFAULT_PASSWORD` par la valeur du `.env`.

```powershell
curl.exe -s -c "$env:TEMP\xplor-editor.txt" -H "Content-Type: application/json" --data-raw '{"email":"editor@xplor.local","password":"SEED_DEFAULT_PASSWORD"}' http://localhost:3000/api/v1/auth/login
```

Puis, avec le `csrfToken` de cette réponse :

```powershell
curl.exe -s -D - -b "$env:TEMP\xplor-editor.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: CSRF_TOKEN" --data-raw '{"email":"autre@xplor.local","name":"Autre","role":"EDITOR","uiLang":"fr"}' http://localhost:3000/api/v1/admin/users/invitations
```

Attendu : **403**. Aucun courriel d'invitation pour `autre@xplor.local`.

`POST /api/v1/auth/login` est limité à **5 requêtes par minute et par adresse IP**, succès compris. Si cette connexion éditeur suit de près d'autres connexions, attendre une minute avant de réessayer.

## 8. Verrouillage après 10 échecs

Utiliser `manager@xplor.local` (rôle gestionnaire d'hôtel). Ne pas verrouiller `admin@xplor.local` ni `editor@xplor.local` : le seed ne remet pas le compteur ni le verrou à zéro.

Le 10e mot de passe faux répond encore **401** (« Identifiants incorrects ») et pose le verrou. La tentative suivante répond **423** et affiche « Compte verrouillé. Réessayez dans 15 minutes. » La limite de 5 connexions par minute s'applique : un 429 dans la même minute affiche « La connexion a échoué. Réessayez. » et **ne compte pas** comme un échec de mot de passe.

1. Attendre 60 secondes après la dernière connexion de l'étape 7.
2. Sur http://localhost:5173, **Se déconnecter** s'il y a une session. Cinq fois : `manager@xplor.local` et un mot de passe faux. Chaque fois : « Identifiants incorrects ».
3. Attendre 60 secondes. Cinq nouveaux échecs. Le dixième affiche encore « Identifiants incorrects ».
4. Attendre 60 secondes. Une onzième tentative, même mot de passe faux.

Attendu : « Compte verrouillé. Réessayez dans 15 minutes. » Le compte reste verrouillé 15 minutes. Un mot de passe correct pendant ce délai affiche le même message.

## Repli — démo sans Docker local (D-62)

Si le moteur Docker ne répond pas, les critères 1, 2 et 7 se lisent sur la CI. Le run de référence est https://github.com/sayoung/DARDEV-/actions/runs/36580207347 (commit `1eaf986`, étape « API smoke » verte). La preuve locale du 29/09/2026 est celle du parcours principal (sections 1 à 8).

1. Ouvrir ce run. L'étape « API smoke » couvre `db:deploy` sur une base PostgreSQL 16 vierge, le seed, `GET /api/health` à 200 (`db`, `redis` et `storage` à `ok`), `openapi.json` à 200, la connexion admin, puis `/auth/me` à 200.
2. Télécharger l'artefact `playwright-results` en bas de la page du run.
3. Ouvrir [`docs/screenshots/login-ar.png`](screenshots/login-ar.png) pour le contrôle RTL (`lang=ar`, `dir=rtl` sur le formulaire de connexion).
4. Navigation du back-office. Dans un terminal :

```bash
pnpm --filter @xplor/admin dev
```

Dans un second terminal, une fois http://localhost:5173 ouvert :

```bash
pnpm test:e2e
```

Hors CI, Playwright réutilise ce serveur (`reuseExistingServer`). Les scénarios de `e2e/` simulent `/api` (D-55) : l'API Nest n'a pas à tourner. Les sections 1 à 8 sont le parcours complet sur le poste local.

## Résultat

Les cases cochées sont des preuves déjà obtenues le 29/09/2026 et revérifiées en local par script E2E le 03/10/2026. La source est `local` (Node 22.23.3) ou `CI` (run `36580207347`, https://github.com/sayoung/DARDEV-/actions/runs/36580207347). La validation du porteur est datée du 29/09/2026.

- [x] Quatre commandes — local et CI. `docker compose up -d` : postgres, redis, minio et mailpit `healthy`, `minio-init` code 0 (local). `pnpm install` : workspace déjà installé, commande non rejouée (local). `pnpm db:migrate` : déjà synchronisé (local) ; `db:deploy` sur base vierge (CI). `pnpm db:seed` : « 4 utilisateurs de démonstration prêts », deux fois (local et CI).
- [x] `pnpm dev` — local. API, back-office et worker démarrés. Résolution confirmée : le proxy Vite ne journalise plus l'erreur ECONNREFUSED dans le test de fumée (l'API répond correctement).
- [x] `GET /api/health` répond 200 avec `{"status":"ok","checks":{"db":"ok","redis":"ok","storage":"ok"}}` — local (via proxy `http://localhost:5173`) et CI.
- [x] `GET /api/v1/openapi.json` répond 200 — local (via proxy `http://localhost:5173`) et CI.
- [x] Login et `/auth/me` 200 — local et CI. Vérifié en local le 03/10/2026 via proxy : `POST /api/v1/auth/login` avec l'adresse `admin@xplor.local` répond 200, en-tête `Set-Cookie` présent avec le cookie `xplor_sid`. `GET /api/v1/auth/me` répond 200 pour ce compte.
- [x] Mot de passe oublié (Mailpit) — local. `POST /api/v1/auth/password/forgot` pour `editor@xplor.local` via proxy : 202. Vérification Mailpit explicite (`GET http://localhost:8025/api/v1/messages`) : un courriel a été reçu, et le corps du message contient bien le lien `/reset/`.
- [x] `pnpm test:int` : 9 verts — local et CI (`auth.int.test.ts` 7, `seed.int.test.ts` 1, `migrations.int.test.ts` 1).
- [x] CI verte — CI, run `36580207347` (commit `1eaf986`, job `ci` `109446061994`).

Contrôles du porteur, validés le 29/09/2026.

- [x] Connexion dans le navigateur (section 3, http://localhost:5173, `admin@xplor.local`)

Retours du porteur : validé le 29/09/2026.

- [x] Bascule en arabe et contrôle visuel RTL de chaque écran : connexion, mot de passe oublié, définition du mot de passe, accueil (section 4)

Retours du porteur : validé le 29/09/2026.

- [x] Clic sur le lien Mailpit (sections 5 et 6)

Retours du porteur : validé le 29/09/2026.

- [x] Invitation d'un éditeur puis acceptation (section 6)

Retours du porteur : validé le 29/09/2026.

- [x] 403 pour `editor@xplor.local` sur `POST /api/v1/admin/users/invitations` (section 7)

Retours du porteur : validé le 29/09/2026.

- [x] Verrouillage après 10 échecs sur `manager@xplor.local` (section 8)

Retours du porteur : validé le 29/09/2026.
