-- Permettre à tous les utilisateurs authentifiés de lire les mots interdits
CREATE POLICY "Authenticated users can read chat banned words"
ON chat_banned_words
FOR SELECT
TO authenticated
USING (true);;
