-- Supprimer le trigger sur UPDATE du statut
DROP TRIGGER IF EXISTS on_hairdresser_status_updated_send_welcome_email ON public.hairdressers;

-- Supprimer aussi l'ancien trigger sur INSERT s'il existe encore
DROP TRIGGER IF EXISTS on_hairdresser_created_send_welcome_email ON public.hairdressers;

-- Optionnel: garder la fonction pour d'éventuels appels manuels, ou la supprimer
-- DROP FUNCTION IF EXISTS send_hairdresser_welcome_email();;
