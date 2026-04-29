-- Ajouter une contrainte unique sur (hairdresser_id, day_of_week)
-- Cela permet à upsert de fonctionner correctement
ALTER TABLE hairdresser_availability 
ADD CONSTRAINT hairdresser_availability_hairdresser_day_unique 
UNIQUE (hairdresser_id, day_of_week);;
