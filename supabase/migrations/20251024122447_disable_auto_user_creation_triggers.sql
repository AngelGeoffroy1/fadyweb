-- Désactiver le trigger automatique de création d'utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Désactiver le trigger automatique de création des préférences de notification
DROP TRIGGER IF EXISTS create_default_notification_preferences_trigger ON public.users;;
