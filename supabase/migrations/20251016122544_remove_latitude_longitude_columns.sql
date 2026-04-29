-- Migration: Supprimer les colonnes latitude et longitude
-- Date: 16/10/2025
-- Description: Supprime les colonnes latitude et longitude de la table hairdressers
--              L'application utilise maintenant uniquement les adresses avec géocodage automatique

-- Supprimer les colonnes latitude et longitude
ALTER TABLE hairdressers 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

-- Vérifier que la colonne address existe et est NOT NULL
ALTER TABLE hairdressers 
  ALTER COLUMN address SET NOT NULL;

-- Ajouter un commentaire pour documenter le changement
COMMENT ON COLUMN hairdressers.address IS 'Adresse complète du coiffeur (utilisée comme unique source de localisation via géocodage)';;
