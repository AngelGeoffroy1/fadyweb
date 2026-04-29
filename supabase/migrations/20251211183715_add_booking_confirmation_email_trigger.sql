-- Fonction pour envoyer l'email de confirmation de réservation via l'Edge Function
CREATE OR REPLACE FUNCTION public.send_booking_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email text;
  v_user_name text;
  v_hairdresser_name text;
  v_service_name text;
  project_url text := 'https://sfxmdvdzqasvzujwbbfg.supabase.co';
BEGIN
  -- Récupérer les informations de l'utilisateur
  SELECT email, COALESCE(full_name, 'Client') 
  INTO v_user_email, v_user_name
  FROM public.users 
  WHERE id = NEW.user_id;

  -- Récupérer le nom du coiffeur
  SELECT name 
  INTO v_hairdresser_name
  FROM public.hairdressers 
  WHERE id = NEW.hairdresser_id;

  -- Récupérer le nom du service
  SELECT service_name 
  INTO v_service_name
  FROM public.hairdresser_services 
  WHERE id = NEW.service_id;

  -- Vérifier que toutes les données nécessaires sont présentes
  IF v_user_email IS NULL OR v_hairdresser_name IS NULL THEN
    RAISE WARNING 'Données manquantes pour envoyer l''email de confirmation';
    RETURN NEW;
  END IF;

  -- Appeler l'Edge Function pour envoyer l'email
  PERFORM extensions.http((
    'POST',
    project_url || '/functions/v1/send-booking-confirmation',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    json_build_object(
      'userEmail', v_user_email,
      'userName', v_user_name,
      'hairdresserName', v_hairdresser_name,
      'serviceName', COALESCE(v_service_name, 'Prestation'),
      'bookingDate', NEW.booking_date::text,
      'bookingTime', NEW.booking_time::text,
      'locationType', NEW.location_type,
      'address', NEW.address,
      'totalPrice', NEW.total_price::numeric,
      'numberOfCuts', NEW.number_of_cuts,
      'bookingId', NEW.id::text
    )::text
  )::extensions.http_request);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger qui s'exécute après l'insertion d'une nouvelle réservation
CREATE TRIGGER on_booking_created_send_confirmation_email
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status IN ('pending', 'confirmed'))
  EXECUTE FUNCTION public.send_booking_confirmation_email();

-- Commentaire pour documenter le trigger
COMMENT ON TRIGGER on_booking_created_send_confirmation_email ON public.bookings IS 
'Envoie automatiquement un email de confirmation au client quand une nouvelle réservation est créée avec statut pending ou confirmed';;
