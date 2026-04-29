-- Table pour stocker les vues de profil des coiffeurs
CREATE TABLE profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    year_month TEXT NOT NULL,
    CONSTRAINT unique_view_per_month UNIQUE (hairdresser_id, client_id, year_month)
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_profile_views_hairdresser ON profile_views(hairdresser_id, year_month);
CREATE INDEX idx_profile_views_client ON profile_views(client_id, year_month);

-- Activer RLS
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre la lecture à tous
CREATE POLICY "Allow read access" ON profile_views FOR SELECT USING (true);

-- Policy pour permettre l'insertion aux utilisateurs authentifiés
CREATE POLICY "Allow insert for authenticated" ON profile_views FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Commentaire
COMMENT ON TABLE profile_views IS 'Suivi des vues de profil des coiffeurs avec système anti-spam mensuel';
COMMENT ON COLUMN profile_views.year_month IS 'Format YYYY-MM pour la période mensuelle (ex: 2025-01)';;
