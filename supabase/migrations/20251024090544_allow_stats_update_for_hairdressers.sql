-- Créer une politique RLS pour permettre la mise à jour des statistiques (rating et total_reviews)
-- pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can update hairdresser stats" ON hairdressers
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);;
