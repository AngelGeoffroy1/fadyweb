-- Fix CRITIQUE #1 : RPC qui contourne RLS pour le check email au signup/login.
-- Remplace les SELECT users WHERE email = ... qui sont désormais bloqués par la policy
-- "restrict_users_select_to_related_parties".
CREATE OR REPLACE FUNCTION public.check_email_status(lookup_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_id uuid;
  is_pro boolean;
BEGIN
  IF lookup_email IS NULL OR length(trim(lookup_email)) = 0 THEN
    RETURN jsonb_build_object('exists', false, 'is_professional', false);
  END IF;

  SELECT id INTO target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(lookup_email))
  LIMIT 1;

  IF target_id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'is_professional', false);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.hairdressers WHERE user_id = target_id
  ) INTO is_pro;

  RETURN jsonb_build_object('exists', true, 'is_professional', is_pro);
END;
$$;

REVOKE ALL ON FUNCTION public.check_email_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_email_status(text) TO anon, authenticated;;
