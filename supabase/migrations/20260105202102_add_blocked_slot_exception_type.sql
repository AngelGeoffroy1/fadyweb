-- Migration: Ajouter le type 'blocked_slot' pour bloquer des créneaux spécifiques
-- Permet aux coiffeurs de bloquer manuellement des créneaux pour éviter les doubles réservations

-- Supprimer l'ancienne contrainte
ALTER TABLE hairdresser_schedule_exceptions 
DROP CONSTRAINT IF EXISTS hairdresser_schedule_exceptions_exception_type_check;

-- Ajouter la nouvelle contrainte avec 'blocked_slot'
ALTER TABLE hairdresser_schedule_exceptions 
ADD CONSTRAINT hairdresser_schedule_exceptions_exception_type_check 
CHECK (exception_type = ANY (ARRAY['closed'::text, 'modified_hours'::text, 'blocked_slot'::text]));

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN hairdresser_schedule_exceptions.exception_type IS 
'Type d''exception: closed (fermé), modified_hours (horaires modifiés), blocked_slot (créneau bloqué manuellement)';;
