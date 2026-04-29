-- Empêche la création/modification d'une réservation qui chevauche un créneau déjà pris
-- chez le même coiffeur (statuts actifs : pending, confirmed, en_cours).
-- Prend en compte number_of_cuts x duration_minutes du service.

CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_minutes INTEGER;
    v_new_start TIMESTAMP;
    v_new_end TIMESTAMP;
    v_conflict RECORD;
BEGIN
    -- Seuls les statuts actifs réservent un créneau
    IF NEW.status NOT IN ('pending', 'confirmed', 'en_cours') THEN
        RETURN NEW;
    END IF;

    -- Récupérer la durée du service de la nouvelle résa
    SELECT duration_minutes INTO v_duration_minutes
    FROM hairdresser_services
    WHERE id = NEW.service_id;

    IF v_duration_minutes IS NULL THEN
        RAISE EXCEPTION 'Service introuvable pour la réservation (service_id=%)', NEW.service_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Intervalle [start, end) de la nouvelle résa
    v_new_start := (NEW.booking_date + NEW.booking_time)::timestamp;
    v_new_end   := v_new_start + make_interval(mins => v_duration_minutes * NEW.number_of_cuts);

    -- Rechercher un chevauchement avec une résa active existante
    SELECT b.id,
           b.booking_time,
           b.number_of_cuts,
           s.duration_minutes
      INTO v_conflict
    FROM bookings b
    JOIN hairdresser_services s ON s.id = b.service_id
    WHERE b.hairdresser_id = NEW.hairdresser_id
      AND b.booking_date   = NEW.booking_date
      AND b.status IN ('pending', 'confirmed', 'en_cours')
      AND (TG_OP = 'INSERT' OR b.id <> NEW.id)
      AND (b.booking_date + b.booking_time)::timestamp < v_new_end
      AND (b.booking_date + b.booking_time)::timestamp
          + make_interval(mins => s.duration_minutes * b.number_of_cuts) > v_new_start
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
          'Créneau déjà réservé chez ce coiffeur (conflit avec la réservation % à % pour % min).',
          v_conflict.id,
          v_conflict.booking_time,
          v_conflict.duration_minutes * v_conflict.number_of_cuts
          USING ERRCODE = 'exclusion_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;

CREATE TRIGGER prevent_booking_overlap_trigger
BEFORE INSERT OR UPDATE OF
    booking_time, booking_date, service_id, number_of_cuts, status, hairdresser_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION check_booking_overlap();
;
