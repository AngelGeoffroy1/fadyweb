
-- Function to look up an auth user's ID by email (used by Edge Functions)
-- Much more efficient than listing all users via the admin API
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE email = lower(lookup_email) LIMIT 1;
$$;

-- Only callable by service role (not by anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) FROM authenticated;
;
