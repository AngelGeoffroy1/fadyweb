-- Ajouter le statut 'notsubmit' aux valeurs possibles
ALTER TABLE hairdresser_diploma_verification 
DROP CONSTRAINT IF EXISTS hairdresser_diploma_verification_verification_status_check;

ALTER TABLE hairdresser_diploma_verification 
ADD CONSTRAINT hairdresser_diploma_verification_verification_status_check 
CHECK (verification_status = ANY (ARRAY['notsubmit'::text, 'pending'::text, 'verified'::text, 'rejected'::text]));

-- Modifier la valeur par défaut de 'pending' à 'notsubmit'
ALTER TABLE hairdresser_diploma_verification 
ALTER COLUMN verification_status SET DEFAULT 'notsubmit'::text;

-- Mettre à jour les enregistrements existants qui sont en 'pending' sans document soumis
UPDATE hairdresser_diploma_verification 
SET verification_status = 'notsubmit'
WHERE verification_status = 'pending' 
AND diploma_file_url IS NULL 
AND submitted_at IS NULL;;
