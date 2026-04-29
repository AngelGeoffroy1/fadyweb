-- Créer une fonction pour ajouter un admin par email
CREATE OR REPLACE FUNCTION public.add_admin_by_email(admin_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  current_admin_id UUID;
  result_data jsonb;
BEGIN
  -- Vérifier que l'utilisateur actuel est un admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admins adm
    WHERE adm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé : vous devez être administrateur';
  END IF;

  -- Récupérer l'ID de l'admin actuel
  SELECT id INTO current_admin_id
  FROM public.admins
  WHERE user_id = auth.uid();

  -- Chercher l'utilisateur dans auth.users par email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = admin_email
  AND deleted_at IS NULL;

  -- Si l'utilisateur n'existe pas
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé avec cet email';
  END IF;

  -- Vérifier si l'utilisateur est déjà admin
  IF EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur est déjà administrateur';
  END IF;

  -- Ajouter l'utilisateur à la table admins
  INSERT INTO public.admins (user_id, role, created_by)
  VALUES (target_user_id, 'admin', current_admin_id);

  -- Retourner les informations de l'admin créé
  SELECT jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'email', admin_email,
    'message', 'Administrateur ajouté avec succès'
  ) INTO result_data;

  RETURN result_data;
END;
$$;;
