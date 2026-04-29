-- Activer RLS sur subscription_fees
ALTER TABLE public.subscription_fees ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tous les utilisateurs authentifiés
CREATE POLICY "subscription_fees_select_authenticated" 
ON public.subscription_fees FOR SELECT 
TO authenticated 
USING (true);;
