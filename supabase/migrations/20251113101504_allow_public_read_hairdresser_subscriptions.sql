-- Permettre à tout le monde de lire les abonnements des coiffeurs
-- (nécessaire pour que les clients puissent voir si un coiffeur a l'abonnement boost)
CREATE POLICY "Tout le monde peut voir les abonnements des coiffeurs"
ON hairdresser_subscriptions
FOR SELECT
TO public
USING (true);;
