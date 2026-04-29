-- Create a function that syncs email from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the email in public.users when it changes in auth.users
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create a trigger on auth.users that fires after email update
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.sync_user_email() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.sync_user_email() TO postgres;;
