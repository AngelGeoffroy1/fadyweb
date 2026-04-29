-- Ajouter la colonne minimum_interval_time à la table hairdressers
-- Cette colonne stocke le temps minimum (en minutes) requis entre deux réservations pour le coiffeur
-- Valeur par défaut : 15 minutes

ALTER TABLE hairdressers 
ADD COLUMN minimum_interval_time INTEGER NOT NULL DEFAULT 15 
CHECK (minimum_interval_time > 0);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN hairdressers.minimum_interval_time IS 'Temps minimum requis (en minutes) entre deux réservations pour permettre le déplacement du coiffeur. Valeur par défaut : 15 minutes';;
