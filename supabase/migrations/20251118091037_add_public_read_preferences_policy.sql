-- Créer une politique pour permettre à tout le monde de lire les préférences publiques des coiffeurs
-- Ceci est nécessaire pour que les clients puissent voir si un coiffeur accepte le paiement en liquide
CREATE POLICY "Public can view public preferences"
ON public.preferences
FOR SELECT
TO public
USING (true);

-- Note: Cette politique permet de lire toutes les préférences, mais dans l'application
-- on ne récupère que les champs nécessaires (accept_cash_payment, favorite_transport_mode, etc.);
