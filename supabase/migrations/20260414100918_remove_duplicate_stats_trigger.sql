
-- Remove duplicate trigger (existing triggers already handle stats)
DROP TRIGGER IF EXISTS trigger_recalculate_hairdresser_stats ON public.reviews;
;
