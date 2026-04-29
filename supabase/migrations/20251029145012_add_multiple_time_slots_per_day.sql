-- Supprimer la contrainte unique existante
ALTER TABLE hairdresser_availability 
DROP CONSTRAINT IF EXISTS hairdresser_availability_hairdresser_day_unique;

-- Ajouter une colonne slot_order pour ordonner les créneaux horaires
ALTER TABLE hairdresser_availability 
ADD COLUMN IF NOT EXISTS slot_order INTEGER DEFAULT 0 NOT NULL;

-- Créer une nouvelle contrainte unique avec slot_order
ALTER TABLE hairdresser_availability 
ADD CONSTRAINT hairdresser_availability_hairdresser_day_slot_unique 
UNIQUE (hairdresser_id, day_of_week, slot_order);

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_hairdresser_availability_day_slot 
ON hairdresser_availability(hairdresser_id, day_of_week, slot_order);;
