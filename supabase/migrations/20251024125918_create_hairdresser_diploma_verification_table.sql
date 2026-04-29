-- Créer la table pour la vérification des diplômes
CREATE TABLE hairdresser_diploma_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    has_accepted_attestation BOOLEAN NOT NULL DEFAULT false,
    diploma_file_url TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Créer un index pour les recherches par hairdresser_id
CREATE INDEX idx_hairdresser_diploma_verification_hairdresser_id ON hairdresser_diploma_verification(hairdresser_id);

-- Activer RLS
ALTER TABLE hairdresser_diploma_verification ENABLE ROW LEVEL SECURITY;

-- Politique RLS : les coiffeurs ne peuvent voir que leurs propres données
CREATE POLICY "Coiffeurs peuvent voir leurs propres vérifications" ON hairdresser_diploma_verification
    FOR ALL USING (hairdresser_id IN (
        SELECT id FROM hairdressers WHERE user_id = auth.uid()
    ));

-- Politique pour les admins (si nécessaire)
CREATE POLICY "Admins peuvent voir toutes les vérifications" ON hairdresser_diploma_verification
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Créer une fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Créer le trigger pour updated_at
CREATE TRIGGER update_hairdresser_diploma_verification_updated_at 
    BEFORE UPDATE ON hairdresser_diploma_verification 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;
