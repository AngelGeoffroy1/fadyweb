-- Activer l'extension http pour faire des requêtes HTTP depuis PostgreSQL
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Fonction pour envoyer l'email de bienvenue via l'Edge Function
CREATE OR REPLACE FUNCTION public.send_welcome_email_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  project_url text := 'https://sfxmdvdzqasvzujwbbfg.supabase.co';
BEGIN
  -- Extraire le prénom et le nom du full_name
  PERFORM extensions.http((
    'POST',
    project_url || '/functions/v1/send-welcome-email',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    json_build_object(
      'email', NEW.email,
      'firstName', SPLIT_PART(NEW.full_name, ' ', 1),
      'lastName', CASE 
        WHEN array_length(string_to_array(NEW.full_name, ' '), 1) > 1 
        THEN SPLIT_PART(NEW.full_name, ' ', 2)
        ELSE NULL 
      END,
      'userId', NEW.id::text
    )::text
  )::extensions.http_request);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger qui s'exécute après l'insertion d'un nouvel utilisateur
CREATE TRIGGER on_user_signup_send_welcome_email
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email_on_signup();

-- Commentaire pour documenter le trigger
COMMENT ON TRIGGER on_user_signup_send_welcome_email ON public.users IS 
'Envoie automatiquement un email de bienvenue via Resend quand un nouvel utilisateur s''inscrit';;
