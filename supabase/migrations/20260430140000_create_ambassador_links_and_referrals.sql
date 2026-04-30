-- Migration: Tables ambassador_links et ambassador_referrals
-- Pour le système de parrainage ambassadeur

-- 1. Table ambassador_links (liens de parrainage)
CREATE TABLE IF NOT EXISTS ambassador_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ambassador_links_hairdresser ON ambassador_links(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_links_slug ON ambassador_links(slug);
CREATE INDEX IF NOT EXISTS idx_ambassador_links_active ON ambassador_links(is_active);

-- Contrainte : un seul lien par coiffeur
ALTER TABLE ambassador_links ADD CONSTRAINT unique_ambassador_link_hairdresser UNIQUE(hairdresser_id);

-- RLS
ALTER TABLE ambassador_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hairdressers can view their own ambassador link"
ON ambassador_links FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM hairdressers WHERE id = hairdresser_id
  )
);

CREATE POLICY "Public read active links"
ON ambassador_links FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can select ambassador links"
ON ambassador_links FOR SELECT
USING (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can insert ambassador links"
ON ambassador_links FOR INSERT
WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can update ambassador links"
ON ambassador_links FOR UPDATE
USING (auth.uid() IN (SELECT user_id FROM admins))
WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can delete ambassador links"
ON ambassador_links FOR DELETE
USING (auth.uid() IN (SELECT user_id FROM admins));

-- Commentaires
COMMENT ON TABLE ambassador_links IS 'Liens de parrainage des ambassadeurs';
COMMENT ON COLUMN ambassador_links.hairdresser_id IS 'ID du coiffeur ambassadeur';
COMMENT ON COLUMN ambassador_links.slug IS 'Slug unique pour le lien de parrainage (ex: donoobarber)';
COMMENT ON COLUMN ambassador_links.is_active IS 'Lien actif ou désactivé';

-- 2. Table ambassador_referrals (inscrits via parrainage)
CREATE TABLE IF NOT EXISTS ambassador_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_link_id UUID NOT NULL REFERENCES ambassador_links(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  profile_type VARCHAR(20) CHECK (profile_type IN ('PRO', 'DIPLÔMÉ', 'AMATEUR')),
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_ambassador_referrals_link ON ambassador_referrals(ambassador_link_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_referrals_profile_type ON ambassador_referrals(profile_type);

-- RLS
ALTER TABLE ambassador_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hairdressers can view their own referrals"
ON ambassador_referrals FOR SELECT
USING (
  ambassador_link_id IN (
    SELECT id FROM ambassador_links WHERE hairdresser_id IN (
      SELECT id FROM hairdressers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can select ambassador referrals"
ON ambassador_referrals FOR SELECT
USING (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can insert ambassador referrals"
ON ambassador_referrals FOR INSERT
WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can update ambassador referrals"
ON ambassador_referrals FOR UPDATE
USING (auth.uid() IN (SELECT user_id FROM admins))
WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "Admins can delete ambassador referrals"
ON ambassador_referrals FOR DELETE
USING (auth.uid() IN (SELECT user_id FROM admins));

-- Commentaires
COMMENT ON TABLE ambassador_referrals IS 'Inscrits via les liens de parrainage ambassadeur';
COMMENT ON COLUMN ambassador_referrals.ambassador_link_id IS 'ID du lien de parrainage utilisé';
COMMENT ON COLUMN ambassador_referrals.profile_type IS 'Type de profil : PRO, DIPLÔMÉ ou AMATEUR';

-- Révoquer accès anon (sécurité)
REVOKE ALL ON public.ambassador_links FROM anon;
REVOKE ALL ON public.ambassador_referrals FROM anon;
