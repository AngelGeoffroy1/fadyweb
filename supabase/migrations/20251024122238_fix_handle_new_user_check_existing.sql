-- Corriger la fonction handle_new_user pour vérifier l'existence avant insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Vérifier si l'utilisateur existe déjà dans public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    INSERT INTO public.users (id, email, full_name, phone, avatar_url, email_confirmed)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      NEW.email_confirmed_at IS NOT NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$;;
