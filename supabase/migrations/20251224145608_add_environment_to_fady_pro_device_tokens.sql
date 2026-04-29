-- Ajouter la colonne environment pour distinguer sandbox (TestFlight/Xcode) vs production (App Store)
ALTER TABLE fady_pro_device_tokens 
ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
CHECK (environment IN ('sandbox', 'production'));

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN fady_pro_device_tokens.environment IS 'Environnement APNs: sandbox (TestFlight/Xcode) ou production (App Store)';;
