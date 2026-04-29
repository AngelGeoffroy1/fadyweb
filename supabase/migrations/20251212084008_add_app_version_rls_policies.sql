-- Créer une politique pour permettre aux admins de modifier app_version
CREATE POLICY "Admins can update app version"
ON app_version
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.user_id = auth.uid()
  )
);

-- Créer une politique pour permettre aux admins d'insérer dans app_version
CREATE POLICY "Admins can insert app version"
ON app_version
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.user_id = auth.uid()
  )
);;
