-- Rendre le champ price optionnel (nullable) dans la table hairdresser_services
ALTER TABLE hairdresser_services 
ALTER COLUMN price DROP NOT NULL;

-- Mettre à jour la contrainte CHECK pour permettre NULL
ALTER TABLE hairdresser_services
DROP CONSTRAINT IF EXISTS hairdresser_services_price_check;

ALTER TABLE hairdresser_services
ADD CONSTRAINT hairdresser_services_price_check 
CHECK (price IS NULL OR price >= 0::numeric);;
