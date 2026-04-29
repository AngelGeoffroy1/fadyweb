-- Ajouter la colonne statut à la table hairdressers
ALTER TABLE hairdressers 
ADD COLUMN statut VARCHAR(20) DEFAULT 'Amateur' CHECK (statut IN ('Amateur', 'Diplomé'));;
