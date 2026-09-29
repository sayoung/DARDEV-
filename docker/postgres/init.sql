-- Bases locales Xplor.
-- « xplor » est créée par POSTGRES_DB au premier démarrage du volume.
-- Ce script ajoute la base de tests (DATABASE_URL_TEST).
-- Il ne s'exécute qu'à l'initialisation d'un volume vide.

CREATE DATABASE xplor_test;
