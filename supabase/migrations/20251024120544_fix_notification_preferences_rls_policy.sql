-- Supprimer la politique existante
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;

-- Créer une nouvelle politique avec WITH CHECK pour les insertions
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);;
