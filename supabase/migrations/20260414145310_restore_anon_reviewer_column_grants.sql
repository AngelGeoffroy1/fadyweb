-- Restaurer les column-level grants pour anon sur users
-- Nécessaire pour le join reviews -> users(full_name) sur la page profil coiffeur
-- La policy RLS "Anon can view reviewer profiles" limite déjà aux users ayant laissé une review
GRANT SELECT (id, full_name) ON public.users TO anon;;
