-- Fonction pour envoyer l'email de bienvenue aux coiffeurs via l'Edge Function
CREATE OR REPLACE FUNCTION public.send_hairdresser_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  project_url text := 'https://sfxmdvdzqasvzujwbbfg.supabase.co';
BEGIN
  -- Récupérer l'email de l'utilisateur associé au coiffeur
  SELECT email 
  INTO v_email
  FROM auth.users 
  WHERE id = NEW.user_id;

  -- Si pas d'email trouvé, essayer depuis public.users
  IF v_email IS NULL THEN
    SELECT email 
    INTO v_email
    FROM public.users 
    WHERE id = NEW.user_id;
  END IF;

  -- Vérifier que l'email est présent
  IF v_email IS NULL THEN
    RAISE WARNING 'Email non trouvé pour le coiffeur %', NEW.id;
    RETURN NEW;
  END IF;

  -- Appeler l'Edge Function pour envoyer l'email
  PERFORM extensions.http((
    'POST',
    project_url || '/functions/v1/send-hairdresser-welcome-email',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    json_build_object(
      'email', v_email,
      'name', NEW.name,
      'statut', COALESCE(NEW.statut, 'Amateur'),
      'hairdresserId', NEW.id::text
    )::text
  )::extensions.http_request);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger qui s'exécute après l'insertion d'un nouveau coiffeur
CREATE TRIGGER on_hairdresser_created_send_welcome_email
  AFTER INSERT ON public.hairdressers
  FOR EACH ROW
  EXECUTE FUNCTION public.send_hairdresser_welcome_email();

-- Commentaire pour documenter le trigger
COMMENT ON TRIGGER on_hairdresser_created_send_welcome_email ON public.hairdressers IS 
'Envoie automatiquement un email de bienvenue personnalisé au coiffeur selon son statut (Amateur ou Diplômé)';;
