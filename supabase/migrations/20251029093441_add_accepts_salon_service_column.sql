-- Ajouter la colonne accepts_salon_service à la table hairdressers
ALTER TABLE hairdressers 
ADD COLUMN IF NOT EXISTS accepts_salon_service BOOLEAN DEFAULT true NOT NULL;;
