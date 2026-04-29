-- Fix: notify_booking_confirmation tournait sous l'identité du coiffeur (SECURITY INVOKER).
-- La RLS sur notification_preferences (auth.uid() = user_id) empêchait la trigger
-- de lire les prefs du client → user_prefs NULL → push jamais envoyé.
ALTER FUNCTION public.notify_booking_confirmation()
    SECURITY DEFINER
    SET search_path = public, pg_temp;

ALTER FUNCTION public.send_push_notification(uuid, text, text, jsonb)
    SECURITY DEFINER
    SET search_path = public, pg_temp;

-- Verrouiller l'EXECUTE sur send_push_notification : seul le owner/role trigger
-- doit pouvoir l'appeler, sinon un client authentifié pourrait spammer des pushs.
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_push_notification(uuid, text, text, jsonb) FROM anon, authenticated;;
