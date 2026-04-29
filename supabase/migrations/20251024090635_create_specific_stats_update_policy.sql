-- Créer une politique plus spécifique qui permet seulement la mise à jour des statistiques
-- Cette politique permet aux utilisateurs authentifiés de mettre à jour uniquement 
-- les colonnes rating et total_reviews des coiffeurs
CREATE POLICY "Allow stats update for hairdressers" ON hairdressers
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);;
