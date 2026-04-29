-- Supprimer l'ancienne contrainte
ALTER TABLE hairdresser_schedule_exceptions 
DROP CONSTRAINT IF EXISTS valid_modified_hours;

-- Ajouter la nouvelle contrainte qui inclut blocked_slot
ALTER TABLE hairdresser_schedule_exceptions 
ADD CONSTRAINT valid_exception_times CHECK (
    (exception_type = 'closed' AND start_time IS NULL AND end_time IS NULL) 
    OR 
    (exception_type = 'modified_hours' AND start_time IS NOT NULL AND end_time IS NOT NULL)
    OR
    (exception_type = 'blocked_slot' AND start_time IS NOT NULL AND end_time IS NOT NULL)
);;
