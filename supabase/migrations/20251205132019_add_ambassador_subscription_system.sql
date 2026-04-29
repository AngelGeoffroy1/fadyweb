-- Migration: Système d'abonnement Ambassadeur avec whitelist

-- 1. Ajouter le type "ambassador" dans subscription_fees
INSERT INTO subscription_fees (subscription_type, commission_percentage)
VALUES ('ambassador', 3.00)
ON CONFLICT (subscription_type) DO NOTHING;

-- 2. Créer la table ambassador_whitelist
CREATE TABLE IF NOT EXISTS ambassador_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
  added_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  reason TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT unique_hairdresser_ambassador UNIQUE(hairdresser_id)
);

-- 3. Index pour performance
CREATE INDEX IF NOT EXISTS idx_ambassador_whitelist_hairdresser ON ambassador_whitelist(hairdresser_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_whitelist_active ON ambassador_whitelist(is_active);

-- 4. Activer RLS (Row Level Security)
ALTER TABLE ambassador_whitelist ENABLE ROW LEVEL SECURITY;

-- 5. Politique : Les coiffeurs peuvent voir leur propre statut ambassadeur
CREATE POLICY "Hairdressers can view their own ambassador status"
ON ambassador_whitelist FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM hairdressers WHERE id = hairdresser_id
  )
);

-- 6. Politique : Seuls les admins peuvent modifier la whitelist
CREATE POLICY "Only admins can modify ambassador whitelist"
ON ambassador_whitelist FOR ALL
USING (
  auth.uid() IN (SELECT user_id FROM admins)
);

-- 7. Commentaire sur la table
COMMENT ON TABLE ambassador_whitelist IS 'Liste des coiffeurs autorisés à avoir un abonnement Ambassadeur (commission 3%)';
COMMENT ON COLUMN ambassador_whitelist.hairdresser_id IS 'ID du coiffeur autorisé';
COMMENT ON COLUMN ambassador_whitelist.added_by_admin_id IS 'ID de l''admin qui a ajouté ce coiffeur';
COMMENT ON COLUMN ambassador_whitelist.reason IS 'Raison de l''ajout (ex: Partenaire VIP, Influenceur)';
COMMENT ON COLUMN ambassador_whitelist.is_active IS 'Statut actif/inactif de l''autorisation';;
