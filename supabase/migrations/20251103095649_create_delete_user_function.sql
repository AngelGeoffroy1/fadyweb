-- Créer une fonction pour supprimer complètement un utilisateur
-- Cette fonction supprime l'utilisateur de public.users (ce qui déclenche le CASCADE)
-- et ensuite de auth.users
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_id uuid;
BEGIN
    -- Récupérer l'ID de l'utilisateur authentifié
    user_id := auth.uid();
    
    -- Vérifier que l'utilisateur est authentifié
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifié';
    END IF;
    
    -- Supprimer l'utilisateur de public.users (déclenche CASCADE sur toutes les tables liées)
    DELETE FROM public.users WHERE id = user_id;
    
    -- Supprimer l'utilisateur de auth.users
    DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Commentaire pour la documentation
COMMENT ON FUNCTION public.delete_user_account() IS 
'Supprime complètement le compte de l''utilisateur authentifié de public.users et auth.users. Toutes les données liées sont supprimées en cascade (bookings, reviews, conversations, messages, etc.).';;
