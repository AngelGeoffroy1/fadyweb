-- Ajouter une politique RLS pour permettre aux utilisateurs de mettre à jour leurs propres reviews
CREATE POLICY "Users can update their own reviews" ON reviews
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);;
