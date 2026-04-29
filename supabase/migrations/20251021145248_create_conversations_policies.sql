-- Policies RLS pour les conversations

-- Les coiffeurs peuvent voir leurs conversations
CREATE POLICY "Coiffeurs peuvent voir leurs conversations"
ON conversations FOR SELECT
USING (
  hairdresser_id IN (
    SELECT id FROM hairdressers WHERE user_id = auth.uid()
  )
);

-- Les clients peuvent voir leurs conversations
CREATE POLICY "Clients peuvent voir leurs conversations"
ON conversations FOR SELECT
USING (user_id = auth.uid());

-- Les conversations sont créées automatiquement via trigger
CREATE POLICY "Système peut créer des conversations"
ON conversations FOR INSERT
WITH CHECK (true);;
