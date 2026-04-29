-- Fix CRITIQUE #2 : toutes les fonctions SECURITY DEFINER sans SET search_path
-- Cibles identifiées via pg_proc. On fixe search_path = public, pg_temp pour bloquer
-- les injections via schema/fonction homonyme.

ALTER FUNCTION public.is_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_admin_info(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_reviews_with_users(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.add_admin_by_email(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_and_clear_slug(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_booking_status(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_notification_preferences_for_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.send_booking_confirmation_email() SET search_path = public, pg_temp;
ALTER FUNCTION public.send_hairdresser_welcome_email() SET search_path = public, pg_temp;
ALTER FUNCTION public.send_welcome_email_on_signup() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_check_slug_on_diploma_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_check_slug_on_gallery_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_check_slug_on_hairdresser_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_check_slug_on_service_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_check_slug_on_subscription_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_bookings_in_progress_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_hairdresser_status_on_verification() SET search_path = public, pg_temp;;
