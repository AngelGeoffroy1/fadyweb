-- Politique permettant aux admins d'insérer des abonnements
CREATE POLICY "Les admins peuvent insérer des abonnements"
ON public.hairdresser_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- Politique permettant aux admins de mettre à jour des abonnements
CREATE POLICY "Les admins peuvent mettre à jour les abonnements"
ON public.hairdresser_subscriptions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- Politique permettant aux admins de supprimer des abonnements
CREATE POLICY "Les admins peuvent supprimer des abonnements"
ON public.hairdresser_subscriptions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);;
