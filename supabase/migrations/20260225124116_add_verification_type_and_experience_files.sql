-- Ajouter le type de vérification (diploma ou experience)
ALTER TABLE hairdresser_diploma_verification
ADD COLUMN verification_type text NOT NULL DEFAULT 'diploma'
CHECK (verification_type IN ('diploma', 'experience'));

-- Ajouter le tableau d'URLs pour les justificatifs d'expérience (max 5)
ALTER TABLE hairdresser_diploma_verification
ADD COLUMN experience_file_urls text[] DEFAULT '{}';

-- Contrainte : max 5 fichiers d'expérience
ALTER TABLE hairdresser_diploma_verification
ADD CONSTRAINT max_experience_files CHECK (array_length(experience_file_urls, 1) IS NULL OR array_length(experience_file_urls, 1) <= 5);

-- Commentaires
COMMENT ON COLUMN hairdresser_diploma_verification.verification_type IS 'Type de justificatif: diploma (diplôme) ou experience (3 ans d''expérience professionnelle)';
COMMENT ON COLUMN hairdresser_diploma_verification.experience_file_urls IS 'URLs des justificatifs d''expérience professionnelle (1 à 5 fichiers)';;
