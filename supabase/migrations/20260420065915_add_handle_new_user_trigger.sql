
-- Créer le trigger INSERT manquant sur auth.users pour créer automatiquement le profil dans public.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
;
