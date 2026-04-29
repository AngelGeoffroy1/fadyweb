-- Ajouter une policy RLS pour permettre aux utilisateurs de supprimer leurs propres messages
CREATE POLICY "Utilisateurs peuvent supprimer leurs propres messages"
ON messages FOR DELETE
USING (sender_id = auth.uid());;
