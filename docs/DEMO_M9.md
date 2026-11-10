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
