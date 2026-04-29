-- Créer une vue qui retourne uniquement les coiffeurs visibles
-- Un coiffeur est visible si :
-- 1. Il n'a jamais fait de demande de vérification de diplôme
-- 2. OU il a une demande qui n'est PAS en statut 'notsubmit' ou 'pending'

CREATE OR REPLACE VIEW visible_hairdressers AS
SELECT h.*
FROM hairdressers h
LEFT JOIN hairdresser_diploma_verification hdv ON h.id = hdv.hairdresser_id
WHERE hdv.id IS NULL 
   OR hdv.verification_status NOT IN ('notsubmit', 'pending');

-- Ajouter un commentaire pour documenter la vue
COMMENT ON VIEW visible_hairdressers IS 'Vue qui retourne uniquement les coiffeurs visibles dans l''app (exclut ceux avec une demande de vérification de diplôme en statut notsubmit ou pending)';
;
