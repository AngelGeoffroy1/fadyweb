-- Créer une vue pour faciliter les requêtes sur les admins
CREATE OR REPLACE VIEW public.admins_with_users AS
SELECT 
    a.id,
    a.user_id,
    a.role,
    a.created_at,
    a.created_by,
    au.email,
    au.raw_user_meta_data->>'full_name' as full_name,
    au.created_at as user_created_at,
    creator.email as created_by_email
FROM public.admins a
LEFT JOIN auth.users au ON a.user_id = au.id
LEFT JOIN public.admins creator_admin ON a.created_by = creator_admin.id
LEFT JOIN auth.users creator ON creator_admin.user_id = creator.id;

-- Donner les permissions appropriées
GRANT SELECT ON public.admins_with_users TO authenticated;
GRANT SELECT ON public.admins_with_users TO anon;;
