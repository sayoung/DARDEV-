# Procès-Verbal de Recette Fonctionnelle — Projet Xplor

> **Document de référence :** Plan de recette fonctionnelle globale de bout en bout ([`docs/RECETTE.md`](RECETTE.md)).  
> **Jalon contractuel :** Jalon M8 — Durcissement & pilote (Livrable formel de recette).  
> **Cadre méthodologique :** Cahier des charges Xplor v2.0 (Sections 6, 8, 9 et 10).

---

## 1. En-tête et Identification de la Session

| Paramètre | Valeur / Renseignement |
|---|---|
| **Intitulé du système** | Plateforme Xplor (API NestJS Fastify, Back-office React 19, Kiosque PWA, Visionneuse Web et Worker BullMQ) |
| **Version logicielle / Commit** | `[Version ou hash de commit à compléter, ex. v1.0.0-rc1 / commit: a1b2c3d]` |
| **Date de la recette** | `[Date de déroulement de la recette à compléter : JJ/MM/AAAA]` |
| **Environnement de test** | `[Environnement de recette à compléter : ex. Préproduction VPS (https://api.xplor.ma) ou Recette locale dédiée]` |
| **Lieu d'exécution** | `[Lieu ou modalités à compléter : ex. Siège DARDEV, Rabat / Visioconférence / Laboratoire de test]` |

### Participants à la session de recette

*Les participants mentionnés ci-dessous participent aux opérations de vérification, d'attestation des résultats et à la prise de décision finale.*

| Rôle / Organisation | Nom et Prénom | Fonction / Titre | Émargement / Présence |
|---|---|---|---|
| **Porteur du projet (DARDEV)** | `[Nom à compléter]` | `[Fonction à compléter]` | [ ] Présent &nbsp; [ ] Excusé |
| **Partenaire institutionnel (SMIT)** | `[Nom à compléter]` | `[Fonction à compléter]` | [ ] Présent &nbsp; [ ] Excusé |
| **Maîtrise d'Œuvre / Développement** | `[Nom à compléter]` | `[Fonction à compléter]` | [ ] Présent &nbsp; [ ] Excusé |
| **Responsable Qualité & Tests** | `[Nom à compléter]` | `[Fonction à compléter]` | [ ] Présent &nbsp; [ ] Excusé |

---

## 2. Renvoi au Plan de Recette et Synthèse des Scénarios

L'ensemble des exigences fonctionnelles et non fonctionnelles (M0 à M8) fait l'objet d'un protocole d'exécution pas à pas détaillé dans le document maître :
👉 **[`docs/RECETTE.md`](RECETTE.md)** — *Plan de Recette Fonctionnelle de Bout en Bout*.

Les 12 scénarios d'évaluation exhaustive ont été exécutés conformément à leurs protocoles respectifs. Le tableau ci-dessous synthétise les constats obtenus pour chaque scénario de test.

| ID | Domaine & Titre du Scénario | Exigences couvertes | Protocole détaillé | Constat d'exécution | Anomalies associées |
|---|---|---|---|---|---|
| **R-01** | Authentification sécurisée, 2FA TOTP et politique de session | F-90, API-20, NF-01, NF-06 | [`RECETTE.md §4.1`](RECETTE.md#41-scénario-r-01--authentification-sécurisée-2fa-totp-et-politique-de-session) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-02** | Gestion des hôtels, sélections et attribution des gestionnaires | F-50, F-51, API-26, API-28, NF-01 | [`RECETTE.md §4.2`](RECETTE.md#42-scénario-r-02--gestion-des-hôtels-sélection-et-gestionnaires) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-03** | Ingestion des panoramas 360°, worker BullMQ et dérivés tuilés | F-02, F-05, F-10, F-11, F-12, API-24 | [`RECETTE.md §4.3`](RECETTE.md#43-scénario-r-03--pipeline-dingestion-des-médias-360-et-dérivés) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-04** | Édition interactive 360°, hotspots et validation du graphe | F-01 à F-04, F-20 à F-25, API-21 à API-23 | [`RECETTE.md §4.4`](RECETTE.md#44-scénario-r-04--édition-visuelle-dune-visite-et-validation-de-graphe) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-05** | Partage public QR, visionneuse mobile et pile inter-visites | F-30 à F-35, F-40 à F-42, API-11, API-12, NF-05, NF-06 | [`RECETTE.md §4.5`](RECETTE.md#45-scénario-r-05--partage-public-qr-visionneuse-mobile-et-navigation-inter-visites) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-06** | Enrôlement borne kiosque, PWA autonome hors-ligne et PIN | F-52, F-53, F-60 à F-67, API-01 à API-03, NF-04 | [`RECETTE.md §4.6`](RECETTE.md#46-scénario-r-06--enrôlement-kiosque-pwa-et-fonctionnement-autonome-hors-ligne) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-07** | Immersion WebXR casque VR autonome (Quest / manettes) | F-70, F-71, F-72, F-73 | [`RECETTE.md §4.7`](RECETTE.md#47-scénario-r-07--immersion-en-réalité-virtuelle-casque-vr-webxr) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-08** | Ingestion analytique par lots, agrégation et exports (CSV / PDF) | F-80 à F-83, API-04, API-29, NF-02, NF-03 | [`RECETTE.md §4.8`](RECETTE.md#48-scénario-r-08--collecte-analytique-agrégation-et-export-csv) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-09** | Journal d'audit `AuditLog`, occultation et traçabilité admin | F-91, API-30, NF-01 | [`RECETTE.md §4.9`](RECETTE.md#49-scénario-r-09--journal-daudit-et-traçabilité-des-opérations-sensibles) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-10** | Étanchéité multi-tenant hôtel et restrictions d'accès partenaire | F-50, F-51, API-26, API-27, API-29, NF-01 | [`RECETTE.md §4.10`](RECETTE.md#410-scénario-r-10--cloisonnement-strict-et-isolation-multi-tenant) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-11** | Récupération de mot de passe par courriel et anti-bruteforce | F-90, API-20, API-28, NF-01, NF-06 | [`RECETTE.md §4.11`](RECETTE.md#411-scénario-r-11--cycle-de-vie-des-identifiants-et-réinitialisation-de-mot-de-passe) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |
| **R-12** | Santé `/api/health`, sécurité HTTP et accessibilité WCAG AA | NF-01, NF-02, NF-04, NF-05, NF-08 | [`RECETTE.md §4.12`](RECETTE.md#412-scénario-r-12--disponibilité-sécurité-http-et-accessibilité-wcag-21-aa) | [ ] Conforme<br>[ ] Réserve<br>[ ] Non conforme | `[Aucune / Réf. Anomalie]` |

---

## 3. Tableau du Registre des Anomalies

*Ce tableau répertorie l'ensemble des écarts, anomalies ou dysfonctionnements constatés au cours de l'exécution des scénarios de recette.*

### Échelle de sévérité
- **Bloquante :** Anomalie empêchant l'exécution d'un scénario de test, provoquant une perte de données, une faille de sécurité critique ou interdisant l'utilisation d'une fonctionnalité essentielle sans possibilité de contournement.
- **Majeure :** Dysfonctionnement significatif d'une exigence métier ou technique, pour lequel une solution de contournement temporaire est identifiable.
- **Mineure :** Défaut d'ergonomie, imperfection visuelle, écart cosmétique ou textuel mineur n'impactant ni l'intégrité du système ni l'expérience utilisateur globale.

### Registre des anomalies relevées

| ID | Gravité | Description détaillée de l'anomalie | Scénario lié | Statut | Plan de résolution / Commentaire |
|---|---|---|---|---|---|
| `ANO-01` | `[Bloquante / Majeure / Mineure]` | `[Description précise de l'écart constaté]` | `[R-xx]` | `[Ouverte / En cours / Corrigée / Reportée]` | `[Correctif prévu, responsable et échéance]` |
| `ANO-02` | `[Bloquante / Majeure / Mineure]` | `[Description précise de l'écart constaté]` | `[R-xx]` | `[Ouverte / En cours / Corrigée / Reportée]` | `[Correctif prévu, responsable et échéance]` |
| `ANO-03` | `[Bloquante / Majeure / Mineure]` | `[Description précise de l'écart constaté]` | `[R-xx]` | `[Ouverte / En cours / Corrigée / Reportée]` | `[Correctif prévu, responsable et échéance]` |
| `ANO-04` | `[Bloquante / Majeure / Mineure]` | `[Description précise de l'écart constaté]` | `[R-xx]` | `[Ouverte / En cours / Corrigée / Reportée]` | `[Correctif prévu, responsable et échéance]` |
| `ANO-05` | `[Bloquante / Majeure / Mineure]` | `[Description précise de l'écart constaté]` | `[R-xx]` | `[Ouverte / En cours / Corrigée / Reportée]` | `[Correctif prévu, responsable et échéance]` |

*(Ajouter autant de lignes que nécessaire selon les constats réels relevés lors de la session).*

---

## 4. Décision et Conclusion de la Recette

Au terme de l'examen contradictoire des résultats d'essais, des vérifications de sécurité, d'accessibilité et de conformité au cahier des charges Xplor v2.0, les parties prenantes soussignées formulent l'avis suivant :

### Prononcé de la décision

- [ ] **ACCEPTÉ SANS RÉSERVE**  
  La recette fonctionnelle est prononcée avec succès. L'ensemble des 12 scénarios de test est validé conforme aux spécifications du cahier des charges v2.0. Le système est déclaré apte pour le déploiement pilote en hôtel partenaire (M8) et l'engagement du jalon de livraison finale (M9).

- [ ] **ACCEPTÉ AVEC RÉSERVES**  
  La recette fonctionnelle est prononcée sous condition de la levée complète des anomalies répertoriées dans le registre ci-dessus avant la date convenue. Les anomalies constatées ne sont pas bloquantes pour le démarrage du pilote en hôtel.

- [ ] **REFUSÉ**  
  La recette fonctionnelle est ajournée. La présence d'anomalies bloquantes ou d'un nombre excessif d'écarts majeurs ne permet pas de garantir le niveau de fiabilité et de sécurité requis. Une nouvelle session de recette sera planifiée après livraison des correctifs nécessaires.

---

### Conditions et calendrier de levée des réserves (le cas échéant)

- **Date limite d'application des correctifs :** `[Date butoir à compléter : JJ/MM/AAAA]`
- **Modalités de vérification de la levée des réserves :**  
  `[Préciser les modalités : ex. Revue sur pièces des correctifs / Rejeu ciblé des scénarios impactés / Démonstration complémentaire]`
- **Observations et remarques particulières des évaluateurs :**  
  `[Espace réservé aux commentaires éventuels des représentants DARDEV et SMIT]`

---

## 5. Zone de Signatures et Émargement

*En apposant leur signature ci-dessous, les représentants des parties prenantes attestent de l'exactitude des constats consignés dans le présent procès-verbal et entérinent la décision collégiale.*

### Pour le Porteur du Projet — DARDEV

- **Nom et Prénom :** `[à compléter]`  
- **Titre / Qualité :** `[à compléter]`  
- **Date d'émargement :** `[JJ/MM/AAAA]`  
- **Mention manuscrite :** *« Bon pour recette [sans réserve / avec réserves / refusée] »*  

```
Signature :





```

---

### Pour le Partenaire Institutionnel — SMIT

- **Nom et Prénom :** `[à compléter]`  
- **Titre / Qualité :** `[à compléter]`  
- **Date d'émargement :** `[JJ/MM/AAAA]`  
- **Mention manuscrite :** *« Vu et approuvé »*  

```
Signature :





```

---

### Pour la Maîtrise d'Œuvre / Équipe de Développement

- **Nom et Prénom :** `[à compléter]`  
- **Titre / Qualité :** `[à compléter]`  
- **Date d'émargement :** `[JJ/MM/AAAA]`  
- **Mention manuscrite :** *« Reçu pour prise en compte et exécution »*  

```
Signature :





```
