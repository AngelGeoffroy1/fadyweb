-- Policy pour permettre aux admins de lire les device tokens clients
CREATE POLICY "Admins can read all user device tokens"
ON user_device_tokens
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
  )
);

-- Policy pour permettre aux admins de lire les device tokens coiffeurs
CREATE POLICY "Admins can read all fady pro device tokens"
ON fady_pro_device_tokens
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
  )
);

-- Activer RLS sur notification_logs et ajouter les policies
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent tout faire sur notification_logs
CREATE POLICY "Admins can manage notification logs"
ON notification_logs
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admins WHERE admins.user_id = auth.uid()
  )
);;
