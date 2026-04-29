-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;

-- Créer une nouvelle politique qui permet l'insertion si:
-- 1. L'utilisateur est authentifié et insère pour lui-même (auth.uid() = user_id)
-- 2. OU le user_id existe dans la table users (pour la création initiale lors du signup)
CREATE POLICY "Users can manage their own notification preferences"
ON notification_preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (
        SELECT 1 
        FROM users 
        WHERE users.id = notification_preferences.user_id 
        AND users.id = auth.uid()
    )
);
;
