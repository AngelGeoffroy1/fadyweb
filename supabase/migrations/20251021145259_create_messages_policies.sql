-- Policies RLS pour les messages

-- Les utilisateurs peuvent voir les messages de leurs conversations
CREATE POLICY "Utilisateurs peuvent voir leurs messages"
ON messages FOR SELECT
USING (
  sender_id = auth.uid() OR receiver_id = auth.uid()
);

-- Les utilisateurs peuvent envoyer des messages dans leurs conversations
CREATE POLICY "Utilisateurs peuvent envoyer des messages"
ON messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM conversations
    WHERE id = conversation_id
    AND (user_id = auth.uid() OR hairdresser_id IN (
      SELECT id FROM hairdressers WHERE user_id = auth.uid()
    ))
  )
);

-- Les utilisateurs peuvent mettre à jour leurs messages (marquer comme lu)
CREATE POLICY "Utilisateurs peuvent mettre à jour leurs messages"
ON messages FOR UPDATE
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());;
