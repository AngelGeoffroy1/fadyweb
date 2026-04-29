-- Ajout des colonnes pour les frais de déplacement dans la table preferences
ALTER TABLE preferences
ADD COLUMN travel_hourly_rate NUMERIC CHECK (travel_hourly_rate IS NULL OR travel_hourly_rate >= 0),
ADD COLUMN minimum_travel_fee NUMERIC CHECK (minimum_travel_fee IS NULL OR minimum_travel_fee >= 0);

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN preferences.travel_hourly_rate IS 'Tarif horaire pour les déplacements des réservations à domicile (en euros)';
COMMENT ON COLUMN preferences.minimum_travel_fee IS 'Montant minimum de frais de déplacement (en euros)';;
