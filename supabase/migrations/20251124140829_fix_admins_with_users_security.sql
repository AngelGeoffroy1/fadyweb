-- 1. Supprimer la vue non sécurisée
DROP VIEW IF EXISTS public.admins_with_users;

-- 2. Créer une fonction RPC sécurisée qui vérifie que l'utilisateur est admin
CREATE OR REPLACE FUNCTION public.get_admins_with_users()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  created_by uuid,
  email text,
  full_name text,
  user_created_at timestamptz,
  created_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est un admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé : vous devez être administrateur';
  END IF;

  -- Retourner les données uniquement si l'utilisateur est admin
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.role,
    a.created_at,
    a.created_by,
    au.email::text,
    (au.raw_user_meta_data ->> 'full_name')::text AS full_name,
    au.created_at AS user_created_at,
    creator.email::text AS created_by_email
  FROM public.admins a
  LEFT JOIN auth.users au ON a.user_id = au.id
  LEFT JOIN public.admins creator_admin ON a.created_by = creator_admin.id
  LEFT JOIN auth.users creator ON creator_admin.user_id = creator.id;
END;
$$;

-- 3. Accorder les permissions d'exécution uniquement aux utilisateurs authentifiés
REVOKE ALL ON FUNCTION public.get_admins_with_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admins_with_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admins_with_users() TO authenticated;

-- 4. Ajouter un commentaire pour documenter la fonction
COMMENT ON FUNCTION public.get_admins_with_users() IS 'Retourne la liste des administrateurs avec leurs informations utilisateur. Accessible uniquement aux administrateurs.';;
