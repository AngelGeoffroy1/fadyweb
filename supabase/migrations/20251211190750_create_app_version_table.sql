-- Table pour stocker les informations de version de l'application
CREATE TABLE IF NOT EXISTS app_version (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    minimum_version VARCHAR(20) NOT NULL,
    latest_version VARCHAR(20) NOT NULL,
    force_update BOOLEAN DEFAULT false,
    update_message TEXT DEFAULT 'Une nouvelle version de Fady est disponible. Veuillez mettre à jour pour profiter des dernières fonctionnalités.',
    app_store_url VARCHAR(255) DEFAULT 'https://apps.apple.com/app/idXXXXXXXXXX',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer la version actuelle (à ajuster selon votre version)
INSERT INTO app_version (minimum_version, latest_version, force_update, update_message)
VALUES ('1.0.0', '1.0.0', false, 'Une nouvelle version de Fady est disponible. Veuillez mettre à jour pour profiter des dernières fonctionnalités.');

-- RLS: Tout le monde peut lire les informations de version
ALTER TABLE app_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app version"
ON app_version FOR SELECT
TO public
USING (true);

-- Fonction pour mettre à jour le timestamp
CREATE OR REPLACE FUNCTION update_app_version_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER app_version_updated_at
BEFORE UPDATE ON app_version
FOR EACH ROW
EXECUTE FUNCTION update_app_version_updated_at();;
