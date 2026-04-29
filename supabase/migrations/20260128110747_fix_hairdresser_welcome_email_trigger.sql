-- Supprimer l'ancien trigger sur INSERT
DROP TRIGGER IF EXISTS on_hairdresser_created_send_welcome_email ON public.hairdressers;

-- Mettre à jour la fonction pour gérer l'UPDATE du statut
CREATE OR REPLACE FUNCTION send_hairdresser_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
  project_url text := 'https://sfxmdvdzqasvzujwbbfg.supabase.co';
BEGIN
  -- Vérifier que le statut vient d'être défini (passage de NULL à une valeur)
  -- Cela assure que l'email est envoyé uniquement quand le statut est sélectionné dans l'onboarding
  IF OLD.statut IS NOT NULL THEN
    -- Le statut était déjà défini, ne pas renvoyer d'email
    RETURN NEW;
  END IF;

  IF NEW.statut IS NULL THEN
    -- Le statut n'est toujours pas défini, ne pas envoyer d'email
    RETURN NEW;
  END IF;

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
      'statut', NEW.statut,
      'hairdresserId', NEW.id::text
    )::text
  )::extensions.http_request);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le nouveau trigger sur UPDATE (quand le statut change)
CREATE TRIGGER on_hairdresser_status_updated_send_welcome_email
  AFTER UPDATE OF statut ON public.hairdressers
  FOR EACH ROW
  EXECUTE FUNCTION send_hairdresser_welcome_email();;
