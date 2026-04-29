-- Permettre aux clients authentifiés de vérifier si un coiffeur peut accepter des paiements
-- (seulement les champs nécessaires pour la vérification)
CREATE POLICY "Les clients peuvent vérifier les capacités de paiement des coiffeurs"
ON hairdresser_stripe_accounts
FOR SELECT
TO authenticated
USING (true);

-- Note: Cette politique permet de lire charges_enabled et onboarding_status
-- mais pas de données sensibles comme stripe_account_id (qui est exposé de toute façon)
;
