# Démonstration — Jalon M1

## Prérequis
- Environnement démarré (PostgreSQL, Redis, MinIO, Mailpit).
- Base seedée avec les données de démonstration.

## Parcours technique
Étapes du test Playwright rejouables manuellement :
1. Connexion au back-office.
2. Création d'une visite virtuelle.
3. Ajout de 3 scènes à la visite.
4. Création des hotspots pour relier les scènes.
5. Validation de la visite.
6. Publication de la visite.

## Capture d'écran
![Visite publiée](../screenshots/m1-tour-published.png)

## Points de vérification
- [ ] La visite en statut PUBLISHED est visible dans la liste.
- [ ] Les 3 scènes sont bien présentes.
- [ ] Les hotspots sont affichés dans l'écran des hotspots.
- [ ] La validation retourne `issues` vide.
- [ ] OpenAPI `/api/v1/openapi.json` accessible.
