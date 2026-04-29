-- 1. Extension btree_gist (indexer uuid + tsrange en GiST)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Colonne duration_minutes dénormalisée (snapshot au moment de la résa)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- 3. Backfill depuis hairdresser_services
UPDATE public.bookings b
SET duration_minutes = s.duration_minutes
FROM public.hairdresser_services s
WHERE b.service_id = s.id
  AND b.duration_minutes IS NULL;

-- 4. NOT NULL (tous backfillés, 0 orphelins vérifié)
ALTER TABLE public.bookings
  ALTER COLUMN duration_minutes SET NOT NULL;

-- 5. Trigger qui auto-remplit duration_minutes depuis hairdresser_services
--    SECURITY DEFINER pour lire hairdresser_services quel que soit le rôle
CREATE OR REPLACE FUNCTION public.set_booking_duration_minutes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.duration_minutes IS NULL THEN
    SELECT duration_minutes INTO NEW.duration_minutes
    FROM hairdresser_services
    WHERE id = NEW.service_id;

    IF NEW.duration_minutes IS NULL THEN
      RAISE EXCEPTION 'Service introuvable (service_id=%)', NEW.service_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Nom alphabétique 'aa_...' pour s'exécuter avant prevent_booking_overlap_trigger
CREATE TRIGGER aa_set_booking_duration_trigger
BEFORE INSERT OR UPDATE OF service_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_booking_duration_minutes();

-- 6. Colonne générée booking_range = [start, start + duration * number_of_cuts)
ALTER TABLE public.bookings
  ADD COLUMN booking_range tsrange
  GENERATED ALWAYS AS (
    tsrange(
      (booking_date + booking_time)::timestamp,
      (booking_date + booking_time)::timestamp
        + make_interval(mins => duration_minutes * number_of_cuts),
      '[)'
    )
  ) STORED;

-- 7. EXCLUDE constraint : impossible d'avoir 2 bookings actifs qui se chevauchent
--    pour le même coiffeur. Partiel : seuls les statuts actifs sont contraints.
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    hairdresser_id WITH =,
    booking_range WITH &&
  ) WHERE (status IN ('pending','confirmed','en_cours'));;
