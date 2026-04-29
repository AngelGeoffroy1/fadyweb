-- Politique pour permettre aux admins de voir tous les tickets
CREATE POLICY "Admins can view all support tickets"
ON public.support_tickets
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = auth.uid()
  )
);

-- Politique pour permettre aux admins de mettre à jour tous les tickets
CREATE POLICY "Admins can update all support tickets"
ON public.support_tickets
FOR UPDATE
TO public
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
);;
