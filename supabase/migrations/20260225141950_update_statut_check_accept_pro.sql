-- Supprimer l'ancienne contrainte
ALTER TABLE hairdressers DROP CONSTRAINT hairdressers_statut_check;

-- Ajouter la nouvelle contrainte qui accepte 'Amateur', 'Diplomé' et 'Pro'
ALTER TABLE hairdressers ADD CONSTRAINT hairdressers_statut_check
CHECK (statut::text = ANY (ARRAY['Amateur', 'Diplomé', 'Pro']::text[]));;
