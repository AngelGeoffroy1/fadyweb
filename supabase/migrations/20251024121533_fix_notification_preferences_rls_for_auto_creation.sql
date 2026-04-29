-- Supprimer la politique existante
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;

-- Créer une politique qui permet l'insertion automatique lors de la création d'utilisateur
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id OR 
  -- Permettre l'insertion automatique lors de la création d'utilisateur
  (auth.uid() IS NULL AND user_id IS NOT NULL)
);;
