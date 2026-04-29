-- Corriger la fonction create_default_notification_preferences pour vérifier l'existence
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Vérifier si les préférences existent déjà
  IF NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = NEW.id) THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;;
