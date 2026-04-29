-- Corriger la politique pour user_device_tokens
DROP POLICY IF EXISTS "Users can manage their own device tokens" ON user_device_tokens;
CREATE POLICY "Users can manage their own device tokens" ON user_device_tokens
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Corriger la politique pour fady_pro_device_tokens
DROP POLICY IF EXISTS "Users can manage their own Fady Pro device tokens" ON fady_pro_device_tokens;
CREATE POLICY "Users can manage their own Fady Pro device tokens" ON fady_pro_device_tokens
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);;
