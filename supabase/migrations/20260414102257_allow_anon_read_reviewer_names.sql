-- Accorder au rôle anon un SELECT limité aux colonnes non-sensibles de users
-- Nécessaire pour le join reviews -> users(full_name) sur la page profil coiffeur
GRANT SELECT (id, full_name) ON public.users TO anon;

-- Policy RLS : anon ne peut voir QUE les utilisateurs ayant laissé au moins une review
-- Cela empêche d'énumérer tous les utilisateurs via la clé anon
CREATE POLICY "Anon can view reviewer profiles"
ON public.users
FOR SELECT
TO anon
USING (id IN (SELECT user_id FROM public.reviews));;
