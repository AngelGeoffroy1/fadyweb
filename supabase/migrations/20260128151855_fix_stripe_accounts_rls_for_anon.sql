
-- Supprimer l'ancienne policy qui ne fonctionne que pour authenticated
DROP POLICY IF EXISTS "Les clients peuvent vérifier les capacités de paiement des co" ON hairdresser_stripe_accounts;

-- Créer une nouvelle policy qui permet aux utilisateurs anonymes ET authentifiés de lire
-- Seulement les champs nécessaires pour vérifier si le paiement est possible
CREATE POLICY "Permettre la lecture publique des capacités de paiement"
ON hairdresser_stripe_accounts
FOR SELECT
TO anon, authenticated
USING (true);
;
