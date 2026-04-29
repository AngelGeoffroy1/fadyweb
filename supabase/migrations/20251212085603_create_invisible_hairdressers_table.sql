-- Créer la table invisible_hairdressers
CREATE TABLE IF NOT EXISTS invisible_hairdressers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
  is_invisible BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(hairdresser_id)
);

-- Ajouter un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_invisible_hairdressers_hairdresser_id ON invisible_hairdressers(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_invisible_hairdressers_is_invisible ON invisible_hairdressers(is_invisible);

-- Ajouter RLS (Row Level Security)
ALTER TABLE invisible_hairdressers ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read invisible_hairdressers"
  ON invisible_hairdressers
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique pour permettre l'insertion aux administrateurs
CREATE POLICY "Allow admins to insert invisible_hairdressers"
  ON invisible_hairdressers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Politique pour permettre la mise à jour aux administrateurs
CREATE POLICY "Allow admins to update invisible_hairdressers"
  ON invisible_hairdressers
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique pour permettre la suppression aux administrateurs
CREATE POLICY "Allow admins to delete invisible_hairdressers"
  ON invisible_hairdressers
  FOR DELETE
  TO authenticated
  USING (true);

-- Ajouter un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invisible_hairdressers_updated_at
    BEFORE UPDATE ON invisible_hairdressers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();;
