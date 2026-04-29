ALTER TABLE public.hairdressers
ADD COLUMN IF NOT EXISTS available_now_end_at timestamp with time zone;

-- Si tu veux supprimer l'ancienne colonne duration tu peux aussi :
-- ALTER TABLE public.hairdressers DROP COLUMN IF EXISTS available_now_duration;;
